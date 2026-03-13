import { GoogleGenAI, type ContentListUnion, type Content } from '@google/genai';
import OpenAI from 'openai';
import { saveMessage, fetchMessages } from '@/src/lib/messages';

export interface PersonaData {
    name: string;
    personality: string;
    landmines: string;
    background: string;
}

const ALLOWED_EMOTIONS = ['neutral', 'thinking', 'satisfied', 'skeptical', 'angry', 'impressed'] as const;
type Emotion = typeof ALLOWED_EMOTIONS[number];

function normalizeEmotion(raw: string): Emotion {
    const lower = raw.toLowerCase().trim();
    return (ALLOWED_EMOTIONS as readonly string[]).includes(lower)
        ? (lower as Emotion)
        : 'neutral';
}

function cleanAssistantText(text: string): string {
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

/** 100字要約を作る（簡易版: 文字トリム＋prefix） */
function buildSummaryText(messages: { role: string; text: string }[]): string {
    const joined = messages
        .map((m) => (m.role === 'assistant' ? `AI:${m.text}` : `User:${m.text}`))
        .join(' / ');
    const summaryBody = joined.slice(0, 100);
    return `【これまでの会話概要（100字）】${summaryBody}`;
}

/**
 * 履歴から「要約メッセージ + 直近の生メッセージ」を作る
 * - 10件超えていたら先頭側を要約1件に圧縮し、その要約もDBに保存
 * - モデルには「要約1件 + 直近数件」を渡す
 */
async function buildLogicalHistoryForSession(sessionId: string) {
    const pastMessages = await fetchMessages(sessionId);

    // すでに存在する要約メッセージ（prefixで判定）
    const existingSummary = pastMessages.find((m: any) =>
        m.text?.startsWith('【これまでの会話概要（100字）】')
    );

    // まず通常の履歴（全件）をベースにする
    let logicalMessages = [...pastMessages];

    if (pastMessages.length > 10 && !existingSummary) {
        // まだ要約が無い & 10件超えたタイミングで要約を作る
        const summaryText = buildSummaryText(pastMessages);

        // 要約をDBに1メッセージとして保存（roleはassistantにしておく）
        await saveMessage(sessionId, 'assistant', summaryText);

        // 「論理履歴」としては「要約 + 直近数件」で組み立て直す
        const recent = pastMessages.slice(-5); // 直近5件はそのまま残すなど適宜
        logicalMessages = [
            {
                id: 'summary', // 仮ID（fetchMessagesの型に合わせる必要があれば調整）
                role: 'assistant',
                text: summaryText,
            } as any,
            ...recent,
        ];
    } else if (existingSummary) {
        // 既に要約がある場合は、その要約 + 直近の生メッセージだけを使う
        const summaryIndex = pastMessages.indexOf(existingSummary);
        const recent = pastMessages.slice(Math.max(summaryIndex + 1, pastMessages.length - 5));
        logicalMessages = [existingSummary, ...recent];
    }

    return logicalMessages;
}

export async function POST(req: Request) {
    try {
        const { sessionId, message, persona, slideUrl, personaData, apiKey, modelProvider = 'gemini' } =
            await req.json();

        if (!apiKey) {
            return Response.json(
                { error: 'APIキーが設定されていません。ホーム画面から設定してください。' },
                { status: 400 },
            );
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

            // 要約ロジックを考慮した「論理履歴」を取得
            let history: OpenAI.Chat.ChatCompletionMessageParam[] = [];
            if (sessionId) {
                const logicalMessages = await buildLogicalHistoryForSession(sessionId);
                const recent = logicalMessages.slice(-15);
                for (const msg of recent) {
                    history.push({
                        role: msg.role === 'assistant' ? 'assistant' : 'user',
                        content: msg.text,
                    });
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
                            const cleanText = cleanAssistantText(fullText);
                            await saveMessage(sessionId, 'assistant', cleanText, emotion);
                        }

                        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    } catch (err) {
                        console.error('Qwen stream error:', err);
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`),
                        );
                    } finally {
                        controller.close();
                    }
                },
            });

            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    Connection: 'keep-alive',
                },
            });
        }

        // ---- Gemini ----

        const client = new GoogleGenAI({ apiKey });

        const slideInstruction = slideUrl
            ? 'ユーザーが添付したスライドの内容を踏まえて反論・コメントしてください。'
            : '';

        // 要約ロジックを考慮した履歴を Gemini 形式に変換
        let historyContents: Content[] = [];
        if (sessionId) {
            const logicalMessages = await buildLogicalHistoryForSession(sessionId);
            const recentMessages = logicalMessages.slice(-15);
            historyContents = recentMessages.map((msg: any) => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.text }],
            }));
        }

        // 今回のメッセージ
        let currentMessageContent: Content;
        if (slideUrl) {
            const pdfRes = await fetch(slideUrl);
            if (!pdfRes.ok) throw new Error(`PDF fetch failed: ${pdfRes.status}`);
            const pdfBuffer = await pdfRes.arrayBuffer();
            const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
            currentMessageContent = {
                role: 'user',
                parts: [
                    { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
                    { text: slideInstruction + '\n' + message },
                ],
            };
        } else {
            currentMessageContent = {
                role: 'user',
                parts: [{ text: message }],
            };
        }

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

                    if (sessionId) {
                        const cleanText = cleanAssistantText(fullText);
                        await saveMessage(sessionId, 'assistant', cleanText, emotion);
                    }

                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                } catch (err) {
                    console.error('Stream error:', err);
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`),
                    );
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });
    } catch (error: any) {
        console.error('Gemini/Qwen API エラー:', error);

        let status = 500;
        let message = 'Internal Server Error';

        if (error?.status === 429 || error?.code === 429) {
            status = 429;
            message =
                'APIの利用制限（上限または一時的なリクエスト過多）に達しました。しばらく待ってからもう一度お試しください。無料枠の場合はAPIキーのクォータを確認してください。';
        } else if (error?.message) {
            message = error.message;
        }

        return Response.json({ error: message }, { status });
    }
}
