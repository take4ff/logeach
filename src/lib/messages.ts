import { createClient } from "@supabase/supabase-js";
import type { Message } from "@/src/components/practice/ChatInterface";

/**
 * サーバーサイド用 Supabase クライアント。
 * サービスロールキーがあればそちらを使い、なければ anonキーで代替する。
 */
function getServerClient() {
    // ビルドエラー防止のため、環境変数がない場合はダミーの文字列を使用する
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
    const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        "placeholder-key";
    return createClient(url, key);
}

export type MessageRole = "user" | "assistant";

/**
 * messages テーブルに1件のメッセージを保存する。
 *
 * @param sessionId - 練習セッション ID
 * @param role      - "user" または "assistant"
 * @param content   - メッセージ本文
 * @param emotion   - AI の感情（assistant の場合のみ）
 */
export async function saveMessage(
    sessionId: string,
    role: MessageRole,
    content: string,
    emotion?: string
): Promise<void> {
    const supabase = getServerClient();

    const { error } = await supabase.from("chat_logs").insert({
        session_id: sessionId,
        role,
        content,
        emotion: emotion ?? null,
    });

    if (error) {
        // 保存失敗はログに出すが、チャットの応答は止めない
        console.error("[messages] 保存失敗:", error.message);
    }
}

/**
 * messages テーブルから指定セッションの履歴を取得する。
 *
 * @param sessionId - 練習セッション ID
 * @returns Message の配列（作成日時昇順）
 */
export async function fetchMessages(sessionId: string): Promise<Message[]> {
    const supabase = getServerClient();

    const { data, error } = await supabase
        .from("chat_logs")
        .select("role, content, emotion")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("[messages] 履歴取得失敗:", error.message);
        return [];
    }

    return (data ?? []).map((row) => ({
        role: row.role as Message["role"],
        text: row.content as string,
        emotion: row.emotion ?? undefined,
    }));
}
