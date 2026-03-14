import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { saveMessage } from '@/src/lib/messages';

// App Router のルートセグメント設定: 大きな音声ファイルのアップロードに対応
export const runtime = 'edge';
export const maxDuration = 60; // タイムアウトを 60 秒に延長

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const sessionId = formData.get('sessionId') as string;
        const slideUrl = formData.get('slideUrl') as string | null;
        const slideTextRaw = formData.get('slideText') as string | null;
        const slideText = slideTextRaw ? JSON.parse(slideTextRaw) as string[] : [];
        const modelProvider = (formData.get('modelProvider') as string) || 'gemini';
        let apiKey = '';

        if (modelProvider === 'qwen') {
            apiKey = (formData.get('qwenApiKey') as string) || process.env.QWEN_API_KEY || '';
            if (!apiKey) {
                return Response.json({ error: 'Qwen APIキーが設定されていません。ホーム画面から設定してください。' }, { status: 400 });
            }
        } else {
            apiKey = (formData.get('geminiApiKey') as string) || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
            if (!apiKey) {
                return Response.json({ error: 'Gemini APIキーが設定されていません。ホーム画面から設定してください。' }, { status: 400 });
            }
        }

        if (!sessionId) {
            return Response.json({ error: 'sessionId は必須です' }, { status: 400 });
        }

        // ① FormData からすべての音声ファイル（Blob）とCanvas画像（Base64）を抽出
        const audioEntries: { page: number; blob: Blob }[] = [];
        const imageEntries: { page: number; base64: string }[] = [];
        for (const [key, value] of Array.from(formData.entries())) {
            if (key.startsWith('audio_page_') && value instanceof Blob) {
                const pageNumStr = key.replace('audio_page_', '');
                const pageNum = parseInt(pageNumStr, 10);
                if (!isNaN(pageNum)) {
                    audioEntries.push({ page: pageNum, blob: value });
                }
            } else if (key.startsWith('image_page_') && typeof value === 'string') {
                const pageNumStr = key.replace('image_page_', '');
                const pageNum = parseInt(pageNumStr, 10);
                if (!isNaN(pageNum)) {
                    imageEntries.push({ page: pageNum, base64: value });
                }
            }
        }
        audioEntries.sort((a, b) => a.page - b.page);
        imageEntries.sort((a, b) => a.page - b.page);

        // ② 各ページの音声を文字起こし（ページ順に処理）
        const transcriptions: { page: number; text: string }[] = [];

        // API クライアントの初期化
        const geminiBaseUrl = process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_GATEWAY_ID
            ? `https://gateway.ai.cloudflare.com/v1/${process.env.CLOUDFLARE_ACCOUNT_ID}/${process.env.CLOUDFLARE_GATEWAY_ID}/google-ai-studio/v1`
            : undefined;

        const geminiClient = modelProvider === 'gemini' ? new GoogleGenAI({ 
            apiKey,
            httpOptions: geminiBaseUrl ? { baseUrl: geminiBaseUrl } : undefined
        }) : null;

        const qwenBaseUrl = process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_GATEWAY_ID
            ? `https://gateway.ai.cloudflare.com/v1/${process.env.CLOUDFLARE_ACCOUNT_ID}/${process.env.CLOUDFLARE_GATEWAY_ID}/openai`
            : 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

        const qwenClient = modelProvider === 'qwen' ? new OpenAI({
            apiKey,
            baseURL: qwenBaseUrl,
        }) : null;

        for (const { page, blob } of audioEntries) {
            // 無音録音（コンテナヘッダーのみ）はスキップ: 10KB 未満は音声なしとみなす
            if (blob.size < 10240) {
                console.warn(`[analyze-presentation] page ${page}: blob が小さすぎるためスキップ (${blob.size} bytes)`);
                continue;
            }

            const base64Audio = Buffer.from(await blob.arrayBuffer()).toString('base64');
            const mimeType = (blob.type && blob.type !== '') ? blob.type : 'audio/webm';
            let text = '';

            if (modelProvider === 'gemini') {
                const result = await geminiClient!.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: [
                        { inlineData: { mimeType, data: base64Audio } },
                        { text: 'この音声を日本語で文字起こしてください。明確な発話が含まれない場合（無音・雑音のみ・聞き取れない場合）は "SILENT" とだけ返してください。' },
                    ],
                });
                text = (result.text ?? '').trim();
            } else if (modelProvider === 'qwen') {
                // Qwen Audio Inference (using native DashScope API for qwen-omni-turbo)
                const dashScopeAudioUrl = 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

                const qwenAudioResponse = await fetch(dashScopeAudioUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'qwen-omni-turbo',
                        input: {
                            messages: [
                                {
                                    role: 'user',
                                    content: [
                                        { audio: `data:${mimeType};base64,${base64Audio}` },
                                        { text: 'この音声を日本語で文字起こしてください。明確な発話が含まれない場合（無音・雑音のみ・聞き取れない場合）は "SILENT" とだけ返してください。' }
                                    ]
                                }
                            ]
                        },
                        parameters: {}
                    })
                });

                if (!qwenAudioResponse.ok) {
                    const errStatus = qwenAudioResponse.status;
                    const errBody = await qwenAudioResponse.text();
                    console.error(`DashScope Audio API Error ${errStatus}:`, errBody);
                    throw new Error(`DashScope Audio API Error: ${errStatus}`);
                }

                const qwenData = await qwenAudioResponse.json();
                text = (qwenData.output?.choices?.[0]?.message?.content?.[0]?.text || '').trim();
            }

            // SILENT と返ってきた場合は有効な発話なしとみなしてスキップ
            if (text.toUpperCase().includes('SILENT') || text === '') {
                console.log(`[analyze-presentation] page ${page}: 発話なし（SILENT検出）: "${text}"`);
                continue;
            }

            transcriptions.push({ page, text });
        }


        // ③ 全ページの文字起こしをまとめて AI でスライド別フィードバック生成
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contentsArray: any[] = [];
        const qwenMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

        // 音声もスライドもない場合はエラー
        if (transcriptions.length === 0 && !slideUrl && slideText.length === 0) {
            return Response.json(
                { error: '音声データもスライドもありません。スライドをアップロードするか、録音してから再試行してください。' },
                { status: 400 }
            );
        }

        // Base64 PDF Data
        let pdfBase64Data = '';
        if (slideUrl) {
            try {
                const pdfRes = await fetch(slideUrl);
                if (pdfRes.ok) {
                    pdfBase64Data = Buffer.from(await pdfRes.arrayBuffer()).toString('base64');
                    if (modelProvider === 'gemini') {
                        contentsArray.push({
                            inlineData: { mimeType: 'application/pdf', data: pdfBase64Data },
                        });
                    }
                }
            } catch (e) {
                console.warn('[analyze-presentation] PDF の取得に失敗しました。スキップします:', e);
            }
        }

        let promptText = '';

        if (transcriptions.length > 0) {
            promptText = `以下はスライド発表の録音を文字起こしたものです。${slideUrl ? 'また、発表に使用したスライドの内容も（PDFまたはテキストとして）提供します。スライドの内容と照らし合わせながら' : ''}スライドごとに以下の観点で評価してください：

各スライドについて：
i. 論理構成（主張・根拠・結論の流れ）
ii. 説明の明瞭さ
iii. 改善すべき点（具体的に1〜2つ）

最後に総合評価（100点満点）と全体を通じた改善アドバイスを追加してください。日本語で回答してください。

${slideText.length > 0 ? `【スライドのテキスト内容】\n${slideText.map((t, i) => `[スライド${i + 1}] ${t}`).join('\n')}\n\n` : ''}
【文字起こし】
${transcriptions.map((t) => `[スライド${t.page}]\n${t.text}`).join('\n\n')}`;
        } else {
            promptText = `提供されたスライド資料の内容を確認し、スライドごとに以下の観点で評価・アドバイスを行ってください：

各スライドについて：
i. 論理構成（主張・根拠・結論の流れ）
ii. 説明の明瞭さ（視覚的なわかりやすさ、情報量の適切さ）
iii. 改善すべき点（具体的に1〜2つ）

最後に総合評価（100点満点）と全体を通じた改善アドバイスを追加してください。日本語で回答してください。

${slideText.length > 0 ? `【スライドのテキスト内容】\n${slideText.map((t, i) => `[スライド${i + 1}] ${t}`).join('\n')}\n\n` : ''}
※ 今回は音声録音がなかったため、スライドの記載内容のみに基づいて評価してください。`;
        }

        let feedback = '';

        try {
            if (modelProvider === 'gemini') {
                contentsArray.push({ text: promptText });
                const feedbackResult = await geminiClient!.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: contentsArray,
                });
                feedback = feedbackResult.text ?? '';
            } else if (modelProvider === 'qwen') {
                // Qwen Vision Inference (using qwen-vl-max)
                // フロントエンドでキャプチャした各スライドのCanvas画像 (Base64 JPEG) を送信
                const contentBlocks: any[] = [];
                if (imageEntries.length > 0) {
                    for (const { page, base64 } of imageEntries) {
                        contentBlocks.push({ type: 'image_url', image_url: { url: base64 } });
                    }
                }

                contentBlocks.push({ type: 'text', text: promptText });

                const qwenMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
                    {
                        role: 'user',
                        content: contentBlocks
                    }
                ];

                const feedbackResult = await qwenClient!.chat.completions.create({
                    model: 'qwen-vl-max',
                    messages: qwenMessages,
                });
                feedback = feedbackResult.choices[0]?.message.content || '';
            }
        } catch (error) {
            console.error(`[analyze-presentation] ${modelProvider} フィードバック生成中にエラーが発生しました:`, error);
            if (error instanceof Error) {
                console.error('Error Details:', error.message, error.stack);
            } else {
                console.error('Unknown Error:', error);
            }
        }

        if (!feedback) {
            console.error('[analyze-presentation] Gemini が空のレスポンスを返しました (Safety Filter等)');
            return Response.json(
                { error: 'AIが回答を生成できませんでした（内容がブロックされた可能性があります）。別のスライドで試してください。' },
                { status: 500 }
            );
        }

        await saveMessage(sessionId, 'assistant', feedback);

        return Response.json({
            feedback,
            slideCount: transcriptions.length,
            sessionId,
        });
    } catch (error: unknown) {
        // Gemini API のエラーを判別してわかりやすいメッセージを返す
        const apiError = error as { status?: number; message?: string };
        const status = apiError?.status;

        if (status === 429) {
            console.warn('[analyze-presentation] Gemini API レート制限:', error);
            return Response.json(
                { error: 'AIの利用制限に達しました。しばらく待ってから再試行してください。' },
                { status: 429 }
            );
        }

        if (status && status >= 400 && status < 500) {
            console.error('[analyze-presentation] Gemini API クライアントエラー:', error);
            return Response.json(
                { error: `AIへのリクエストに失敗しました (${status})。内容を確認して再試行してください。` },
                { status: 400 }
            );
        }

        console.error('[analyze-presentation] エラー:', error);
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
