import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
  try {
    const { sessionId, slideAudios, slideUrl, apiKey } = await req.json();

    if (!apiKey) {
      return Response.json({ error: "APIキーが必要です" }, { status: 400 });
    }

    // ここで本来は音声をSttしてGeminiに投げるが、まずはモックでUIを確認できるようにする
    // 実際の実装では SlideAudios (Base64) を処理するロジックが必要

    // 2秒ほどディレイを入れてローディングを表示させる
    await new Promise(resolve => setTimeout(resolve, 2500));

    const mockFeedback = {
      totalScore: 78,
      overallAdvice: "全体として非常に論理的で分かりやすい発表でした。スライド間のつながりもスムーズですが、後半のスライドで少し早口になる傾向があったため、重要なポイントでは一呼吸置くことを意識するとさらに良くなります。また、専門用語の解説を少し加えることで、より幅広い聴衆に届く発表になります。",
      slideFeedbacks: slideAudios.map((sa: any) => ({
        page: sa.page,
        score: Math.floor(Math.random() * 20) + 70, // 70-90の間でランダム
        goodPoints: [
          "結論から述べており、主張が明確です。",
          "視覚的な説明と音声のタイミングが合致しています。"
        ],
        improvementPoints: [
          "具体例をもう一つ加えると、説得力が増します。",
          "語尾をもう少しはっきりさせると、自信が伝わります。"
        ],
        comment: `スライド${sa.page}は非常にクリアでした。`
      }))
    };

    return Response.json(mockFeedback);
  } catch (error) {
    console.error("Feedback API error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
