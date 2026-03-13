"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import Logo from "@/src/components/common/Logo";

type Mode = "login" | "signup";

/** 名前を内部用の仮メールに変換 */
function nameToEmail(name: string) {
    return `${name.trim().toLowerCase().replace(/\s+/g, "_")}@logeach.app`;
}

export default function LoginPage() {
    const router = useRouter();
    const [mode, setMode] = useState<Mode>("login");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const email = nameToEmail(name);

        if (mode === "login") {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                setError("名前またはパスワードが正しくありません");
            } else {
                router.push("/");
            }
        } else {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { display_name: name.trim() } },
            });
            if (error) {
                setError(error.message);
            } else {
                // メール認証なしの場合はそのままログイン済みになる
                router.push("/");
            }
        }

        setLoading(false);
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="w-full max-w-md p-8 rounded-2xl border border-border bg-card shadow-sm flex flex-col items-center">
                <Logo size="medium" className="mb-8" withLink={false} />

                {/* タブ切り替え */}
                <div className="flex w-full rounded-lg border border-border mb-6 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => { setMode("login"); setError(null); }}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                            mode === "login"
                                ? "bg-primary text-white"
                                : "hover:bg-muted text-black"
                        }`}
                    >
                        ログイン
                    </button>
                    <button
                        type="button"
                        onClick={() => { setMode("signup"); setError(null); }}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                            mode === "signup"
                                ? "bg-primary text-white"
                                : "hover:bg-muted text-black"
                        }`}
                    >
                        アカウント作成
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
                    <div className="flex flex-col gap-1">
                        <label htmlFor="name" className="text-sm font-medium">
                            名前
                        </label>
                        <input
                            id="name"
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Example: John Smith"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label htmlFor="password" className="text-sm font-medium">
                            パスワード
                        </label>
                        <input
                            id="password"
                            type="password"
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="6文字以上"
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-red-500">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-2 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {loading ? "処理中..." : mode === "login" ? "ログイン" : "アカウントを作成"}
                    </button>
                </form>
            </div>
        </div>
    );
}
