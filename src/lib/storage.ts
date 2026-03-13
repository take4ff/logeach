import { supabase } from "./supabase";

/**
 * Supabase Storage の "slides" バケットに PDF をアップロードし、
 * 公開 URL を返す。
 *
 * @param file - アップロードする PDF ファイル
 * @param sessionId - 練習セッション ID（ファイル名のプレフィックスに使用）
 * @returns 公開 URL（string）
 * @throws アップロード失敗時に Error をスロー
 */
export async function uploadSlidePdf(
    file: File,
    sessionId: string
): Promise<string> {
    const ext = file.name.split(".").pop() ?? "pdf";
    const path = `${sessionId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
        .from("slides")
        .upload(path, file, { upsert: true });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from("slides").getPublicUrl(path);
    return data.publicUrl;
}

/**
 * Supabase Storage の "avatars" バケットに感情別アバター画像をアップロードし、
 * 公開 URL を返す。
 *
 * @param file - アップロードする画像ファイル
 * @param sessionId - 練習セッション ID
 * @param emotion - 感情名（neutral / thinking / satisfied / skeptical / angry / impressed）
 * @returns 公開 URL（string）
 * @throws アップロード失敗時に Error をスロー
 */
export async function uploadAvatarImage(
    file: File,
    sessionId: string,
    emotion: string
): Promise<string> {
    const path = `${sessionId}/${emotion}.png`;
    const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl;
}

/**
 * ユーザーがアップロードしたカスタムアバター画像の公開 URL を返す。
 * カスタム画像が存在しない場合のフォールバックは呼び出し側で制御する。
 *
 * @param sessionId - 練習セッション ID
 * @param emotion - 感情名
 * @returns 公開 URL（string）
 */
export function getAvatarUrl(sessionId: string, emotion: string): string {
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars`;
    return `${base}/${sessionId}/${emotion}.png`;
}
