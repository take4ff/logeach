import { GoogleGenAI, type ContentListUnion, type Content } from '@google/genai';
import OpenAI from 'openai';
import { saveMessage, fetchMessages } from '@/src/lib/messages';

export interface PersonaData {
    name: string;
    personality: string;
    landmines: string;
    background: string;
}

/** ペルソナ情報からシステムプロンプトを組み立てる */
const ALLOWED_EMOTIONS = ['neutral', 'thinking', 'satisfied', 'skeptical', 'angry', 'impressed'] as const;
type Emotion = typeof ALLOWED_EMOTIONS[number];

function normalizeEmotion(raw: string): Emotion {
    const lower = raw.toLowerCase().trim();
    return (ALLOWED_EMOTIONS as readonly string[]).includes(lower)
        ? (lower as Emotion)
        : 'neutral';
}

/** テキストから "emotion: <感情名>" の行を削除する */
function cleanAssistantText(text: string): string {
    // 正規表現で "emotion: 感情名" の行（前後改行含む）を空文字に置換
    return text.replace(/emotion:\s*.+$/m, '').trim();
}

function buildSystemPrompt(personaData?: PersonaData): string {
    if (!personaData || !personaData.name) {
        return [
            '返答の最後に必ず、あなたの感情を "emotion: <感情名>" の形式で1行追加してください。',
            '感情は必ず次の6つのいずれかを使用してください: neutral / thinking / satisfied / skeptical / angry / impressed',
        ].join('\n');
    }

    const { name, personality, landmines, background } = personaData;

    return [
        `あなたは${name}です。`,
        personality ? `${personality}な性格です。` : '',
        background ? `背景・専門分野: ${background}` : '',
        '',
        landmines
            ? [
                `【地雷ポイント】あなたは以下のことを特に嫌います: ${landmines}`,
                `ユーザーの発言がこの地雷ポイントに触れた場合は、感情として必ず emotion: angry を返してください。`,
            ].join('\n')
            : '',
        '',
        '返答の最後に必ず、あなたの感情を "emotion: <感情名>" の形式で1行追加してください。',
        '感情の例: neutral / satisfied / skeptical / angry / impressed / thinking',
    ]
        .filter((line) => line !== undefined)
        .join('\n')
        .trim();
}

export async function POST(req: Request) {
    try {
        const { sessionId, message, persona, slideUrl, personaData, apiKey, modelProvider = 'gemini' } = await req.json();

        if (!apiKey) {
            return Response.json({ error: 'APIキーが設定されていません。ホーム画面から設定してください。' }, { status: 400 });
        }

        if (!message) {
            return Response.json({ error: 'message は必須です' }, { status: 400 });
        }

        // ユーザーのメッセージを保存
        if (sessionId) {
            await saveMessage(sessionId, 'user', message);
        }

        const systemInstruction = buildSystemPrompt(personaData);

        // ---- Qwen (OpenAI互換API) ----
        if (modelProvider === 'qwen') {
            const qwenClient = new OpenAI({
                apiKey,
                baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
            });

            // 過去の履歴を取得
            const history: OpenAI.Chat.ChatCompletionMessageParam[] = [];
            if (sessionId) {
                const pastMessages = await fetchMessages(sessionId);
                const recent = pastMessages.slice(-15);
                for (const msg of recent) {
                    history.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.text });
                }
            }

            const qwenMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
                { role: 'system', content: systemInstruction },
                ...history,
                { role: 'user', content: message },
            ];

            const qwenStream = await qwenClient.chat.completions.create({
                model: 'qwen-plus',
                messages: qwenMessages,
                stream: true,
            });

            const stream = new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();
                    let fullText = '';
                    try {
                        for await (const chunk of qwenStream) {
                            const text = chunk.choices[0]?.delta?.content ?? '';
                            if (text) {
                                fullText += text;
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                            }
                        }

                        const emotionMatch = fullText.match(/emotion:\s*(.+)/);
                        const emotion = emotionMatch ? normalizeEmotion(emotionMatch[1]) : 'neutral';
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ emotion })}\n\n`));

                        if (sessionId) {
                            const cleanText = cleanAssistantText(fullText); // 感情行をカット
                            await saveMessage(sessionId, 'assistant', cleanText, emotion);
                        }

                        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    } catch (err) {
                        console.error('Qwen stream error:', err);
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`));
                    } finally {
                        controller.close();
                    }
                },
            });

            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });
        }

        // ---- Gemini ----
        const client = new GoogleGenAI({ apiKey });

        const slideInstruction = slideUrl
            ? 'ユーザーが添付したスライドの内容を踏まえて反論・コメントしてください。'
            : '';

        // 過去のメッセージ履歴を取得して Gemini のフォーマットに変換
        let historyContents: Content[] = [];
        if (sessionId) {
            const pastMessages = await fetchMessages(sessionId);
            // トークン節約のため、直近の最大15件のメッセージのみをコンテキストとして保持する
            const recentMessages = pastMessages.slice(-15);
            historyContents = recentMessages.map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.text }]
            }));
        }

        // 今回のメッセージを組み立てる
        let currentMessageContent: Content;
        if (slideUrl) {
            // fileData.fileUri は Gemini Files API の URI 専用のため、
            // 任意の公開URL（Supabase 等）は fetch して base64 に変換して渡す
            const pdfRes = await fetch(slideUrl);
            if (!pdfRes.ok) throw new Error(`PDF fetch failed: ${pdfRes.status}`);
            const pdfBuffer = await pdfRes.arrayBuffer();
            const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
            currentMessageContent = {
                role: 'user',
                parts: [
                    { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
                    { text: slideInstruction + '\n' + message },
                ]
            };
        } else {
            currentMessageContent = {
                role: 'user',
                parts: [{ text: message }]
            };
        }

        // 履歴と今回のメッセージを結合して Gemini に渡す contents を作成
        const contents: Content[] = [...historyContents, currentMessageContent];


        const result = await client.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents,
            config: {
                systemInstruction,
            },
        });

        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                let fullText = '';
                try {
                    for await (const chunk of result) {
                        const text = chunk.text ?? '';
                        if (text) {
                            fullText += text;
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                        }
                    }

                    const emotionMatch = fullText.match(/emotion:\s*(.+)/);
                    const emotion = emotionMatch ? normalizeEmotion(emotionMatch[1]) : 'neutral';
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ emotion })}\n\n`));

                    // AIの応答をDBに保存
                    if (sessionId) {
                        const cleanText = cleanAssistantText(fullText); // 感情行をカット
                        await saveMessage(sessionId, 'assistant', cleanText, emotion);
                    }

                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                } catch (err) {
                    console.error('Stream error:', err);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`));
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (error: any) {
        console.error('Gemini/Qwen API エラー:', error);

        let status = 500;
        let message = 'Internal Server Error';

        if (error?.status === 429 || error?.code === 429) {
            status = 429;
            message = 'APIの利用制限（上限または一時的なリクエスト過多）に達しました。しばらく待ってからもう一度お試しください。無料枠の場合はAPIキーのクォータを確認してください。';
        } else if (error?.message) {
            message = error.message;
        }

        return Response.json({ error: message }, { status });
    }
}
