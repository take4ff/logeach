"use client";

/**
 * ホーム画面
 * TODO: セッション一覧と新規作成ボタンを実装
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/components/auth/AuthProvider";

export default function HomePage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">読み込み中...</p>
      </div>
    );
  }

  const handleNewSession = () => {
    const sessionId = `session-${Date.now()}`;
    router.push(`/practice/${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-bold">Logeach</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user.displayName ?? user.email}
            </span>
            <button
              onClick={() => signOut()}
              className="text-sm px-4 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <button
            onClick={handleNewSession}
            className="card flex flex-col items-center justify-center p-8 min-h-[180px] cursor-pointer"
          >
            <span className="text-2xl mb-2">＋</span>
            <span>新規作成</span>
          </button>
        </div>
      </main>
    </div>
  );
}
