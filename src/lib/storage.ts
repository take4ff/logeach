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
): Promise<{ path: string; publicUrl: string }> {
    const ext = file.name.split(".").pop() ?? "pdf";
    const path = `${sessionId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
        .from("slides")
        .upload(path, file, { upsert: true });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from("slides").getPublicUrl(path);
    return { path, publicUrl: data.publicUrl };
}

/**
 * slide_url（パス or URL）から Storage のパスを抽出する
 */
export function extractSlidePath(slideRef: string): string | null {
    if (!slideRef) return null;

    if (!slideRef.startsWith("http")) {
        return slideRef;
    }

    const publicMarker = "/storage/v1/object/public/slides/";
    const signedMarker = "/storage/v1/object/sign/slides/";

    const publicIdx = slideRef.indexOf(publicMarker);
    if (publicIdx >= 0) {
        return decodeURIComponent(slideRef.slice(publicIdx + publicMarker.length).split("?")[0]);
    }

    const signedIdx = slideRef.indexOf(signedMarker);
    if (signedIdx >= 0) {
        return decodeURIComponent(slideRef.slice(signedIdx + signedMarker.length).split("?")[0]);
    }

    return null;
}

export async function resolveSlideUrl(slideRef: string): Promise<string> {
    const path = extractSlidePath(slideRef);
    if (!path) return slideRef;

    const { data: signedData, error: signedError } = await supabase.storage
        .from("slides")
        .createSignedUrl(path, 60 * 60);

    if (!signedError && signedData?.signedUrl) {
        return signedData.signedUrl;
    }


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
