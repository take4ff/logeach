import { GoogleGenAI, type ContentListUnion } from '@google/genai';
import { saveMessage } from '@/src/lib/messages';

const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '' });

export async function POST(req: Request) {
    try {
        const { sessionId, message, persona, slideUrl } = await req.json();

        if (!message) {
            return Response.json({ error: 'message は必須です' }, { status: 400 });
        }

        // ユーザーのメッセージを保存
        if (sessionId) {
            await saveMessage(sessionId, 'user', message);
        }

        const slideInstruction = slideUrl
            ? 'ユーザーが添付したスライドの内容を踏まえて反論・コメントしてください。'
            : '';

        const systemInstruction = persona
            ? `あなたは${persona}として振る舞ってください。${slideInstruction}返答の最後に必ず、あなたの感情を "emotion: <感情名>" の形式で1行追加してください（例: emotion: 興味深い）。`
            : `${slideInstruction}返答の最後に必ず、あなたの感情を "emotion: <感情名>" の形式で1行追加してください（例: emotion: 興味深い）。`;


        let contents: ContentListUnion;
        if (slideUrl) {
            // fileData.fileUri は Gemini Files API の URI 専用のため、
            // 任意の公開URL（Supabase 等）は fetch して base64 に変換して渡す
            const pdfRes = await fetch(slideUrl);
            if (!pdfRes.ok) throw new Error(`PDF fetch failed: ${pdfRes.status}`);
            const pdfBuffer = await pdfRes.arrayBuffer();
            const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
            contents = [
                { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
                { text: message },
            ];
        } else {
            contents = message;
        }


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
                    const emotion = emotionMatch ? emotionMatch[1].trim() : 'neutral';
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ emotion })}\n\n`));

                    // AIの応答をDBに保存
                    if (sessionId) {
                        await saveMessage(sessionId, 'assistant', fullText, emotion);
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
    } catch (error) {
        console.error('Gemini API エラー:', error);
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
