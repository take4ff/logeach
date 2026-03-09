import { GoogleGenAI } from '@google/genai';

const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '' });

export async function POST(req: Request) {
    try {
        const { sessionId: _sessionId, message, persona } = await req.json();

        if (!message) {
            return Response.json({ error: 'message は必須です' }, { status: 400 });
        }

        const systemInstruction = persona
            ? `あなたは${persona}として振る舞ってください。返答の最後に必ず、あなたの感情を "emotion: <感情名>" の形式で1行追加してください（例: emotion: 興味深い）。`
            : '返答の最後に必ず、あなたの感情を "emotion: <感情名>" の形式で1行追加してください（例: emotion: 興味深い）。';


        const result = await client.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: message,
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
