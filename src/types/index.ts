// ==========================================
// Logeach 共通型定義
// ==========================================

/** AIの感情タイプ */
export type EmotionType =
    | "neutral"    // 通常
    | "thinking"   // 考え中
    | "satisfied"  // 満足
    | "skeptical"  // 懐疑的
    | "angry"      // 怒り（地雷を踏んだ）
    | "impressed"; // 感心

/** ペルソナ（先生の設定） */
export interface Persona {
    id: string;
    name: string;
    personality: "strict" | "gentle" | "logical"; // こわめ / やさしめ / 論理的
    specialization: string;   // 専門分野
    landmines: string[];      // 地雷ポイント（特に嫌うもの）
    systemPrompt?: string;    // カスタムシステムプロンプト
    createdAt: string;
    userId: string;
}

/** 練習セッション */
export interface Session {
    id: string;
    title: string;
    personaId: string;
    persona?: Persona;
    slideUrl?: string;        // アップロードされたPDFのURL
    knowledgeUrls?: string[]; // 前提知識PDFのURL配列
    createdAt: string;
    userId: string;
}

/** チャットメッセージ */
export interface ChatMessage {
    id: string;
    sessionId: string;
    role: "user" | "assistant";
    content: string;
    emotion?: EmotionType;    // AIの感情（assistantのみ）
    timestamp: string;
}

/** 認証ユーザー */
export interface AppUser {
    id: string;
    email: string;
    displayName?: string;
}
