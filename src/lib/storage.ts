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
