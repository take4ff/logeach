import { createClient } from "@supabase/supabase-js";

// ビルドエラー防止のため、環境変数がない場合はダミーの文字列を使用する
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

/** ブラウザ用 Supabase クライアント（シングルトン） */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
