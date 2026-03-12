"use client";

/**
 * ホーム画面
 * セッション一覧と新規作成機能を提供
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/components/auth/AuthProvider";
import { supabase } from "@/src/lib/supabase";
import Logo from "@/src/components/common/Logo";

// データベースからの取得結果の型定義
type SessionWithPersona = {
  id: string;
  title: string | null;
  created_at: string;
  personas: {
    name: string;
  } | null;
};

export default function HomePage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  const [sessions, setSessions] = useState<SessionWithPersona[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // 新規作成モーダル用ステート
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // 設定モーダル（APIキー）用ステート
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [qwenApiKeyInput, setQwenApiKeyInput] = useState("");
  const [preferredModel, setPreferredModel] = useState<'gemini' | 'qwen'>('gemini');

  // 認証チェック
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // ローカルストレージからAPIキーを読み込む
  useEffect(() => {
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) setApiKeyInput(savedKey);
    const savedQwenKey = localStorage.getItem("qwen_api_key");
    if (savedQwenKey) setQwenApiKeyInput(savedQwenKey);
    const savedModel = localStorage.getItem("preferred_model") as 'gemini' | 'qwen' | null;
    if (savedModel) setPreferredModel(savedModel);
  }, []);

  // セッション一覧の取得
  useEffect(() => {
    async function fetchSessions() {
      if (!user) return;

      try {
        setLoadingSessions(true);
        // sessionsテーブルから自身のデータを取得。※titleカラムが追加されている前提
        const { data, error } = await supabase
          .from("sessions")
          .select(`
            id,
            title,
            created_at,
            personas (
              name
            )
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("セッションの取得に失敗しました:", error);
          return;
        }

        // 期待する型にキャスト
        setSessions((data as unknown as SessionWithPersona[]) || []);
      } catch (error) {
        console.error("エラーが発生しました:", error);
      } finally {
        setLoadingSessions(false);
      }
    }

    if (user) {
      fetchSessions();
    }
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">読み込み中...</p>
      </div>
    );
  }

  // 新規作成の実行処理（DB保存 -> 遷移）
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionTitle.trim() || isCreating) return;

    setIsCreating(true);
    try {
      // セッションを新規作成してDBに保存
      const { data, error } = await supabase
        .from("sessions")
        .insert([
          {
            user_id: user.id,
            title: newSessionTitle.trim(),
            // persona_id は後から練習画面で設定する想定なら null のまま
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // 作成されたセッションのIDへ遷移
      if (data && data.id) {
        setIsModalOpen(false);
        router.push(`/practice/${data.id}`);
      }
    } catch (err: any) {
      console.error("セッションの作成に失敗しました:", err);
      // ユーザーにエラー内容を通知する
      alert(`セッションの作成に失敗しました。\n詳細: ${err.message || "不明なエラー"}`);
      setIsCreating(false);
    }
  };

  const handleOpenSession = (sessionId: string) => {
    router.push(`/practice/${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-background relative">
      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="flex justify-between items-center mb-12">
          <Logo size="large" />
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user.displayName ?? user.email}
            </span>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="text-sm px-4 py-2 text-muted-foreground hover:bg-muted rounded transition-colors flex items-center gap-1"
            >
              <span>⚙️</span> 設定
            </button>
            <button
              onClick={() => signOut()}
              className="text-sm px-4 py-2 text-muted-foreground hover:bg-muted rounded transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 新規作成カード */}
          <button
            onClick={() => { setIsModalOpen(true); setNewSessionTitle(""); }}
            className="flex flex-col items-center justify-center p-8 min-h-[180px] rounded-xl border border-dashed border-border hover:bg-muted/50 hover:border-solid transition-all cursor-pointer"
          >
            <span className="text-3xl mb-3 text-muted-foreground">＋</span>
            <span className="font-medium">新しい練習を始める</span>
          </button>

          {/* セッション一覧 */}
          {loadingSessions ? (
            <div className="col-span-2 flex items-center justify-center p-8 border rounded-xl bg-card">
              <p className="text-muted-foreground">履歴を読み込み中...</p>
            </div>
          ) : sessions.length > 0 ? (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => handleOpenSession(session.id)}
                className="flex flex-col items-start text-left p-6 min-h-[180px] rounded-xl border border-border bg-card hover:border-primary/50 transition-all cursor-pointer shadow-sm hover:shadow-md"
              >
                <div className="flex items-center gap-2 mb-3 w-full">
                  <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                    練習セッション
                  </span>
                  <span className="text-sm text-muted-foreground ml-auto whitespace-nowrap">
                    {new Date(session.created_at).toLocaleDateString('ja-JP')}
                  </span>
                </div>

                {/* タイトル (DBのtitleカラムを利用) */}
                <h3 className="text-lg font-semibold mb-2 line-clamp-1 w-full" title={session.title || "無題のセッション"}>
                  {session.title || "無題のセッション"}
                </h3>

                {/* ペルソナ名 */}
                <div className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0"></div>
                  <span className="truncate">使用ペルソナ: {session.personas?.name ? session.personas.name : "未設定"}</span>
                </div>

                <div className="mt-auto pt-4 border-t border-border w-full flex justify-end items-center text-sm font-medium text-primary">
                  <span>詳細を見る &rarr;</span>
                </div>
              </button>
            ))
          ) : (
            <div className="col-span-1 md:col-span-2 flex items-center justify-center p-8 border border-dashed rounded-xl bg-card/50 text-muted-foreground">
              <p>過去の練習記録はまだありません</p>
            </div>
          )}
        </div>
      </main>

      {/* 新規作成モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl shadow-lg w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">新しい練習セッション</h2>
            <form onSubmit={handleCreateSession}>
              <div className="mb-6">
                <label htmlFor="sessionTitle" className="block text-sm font-medium mb-2">
                  セッション名（テーマなど）
                </label>
                <input
                  id="sessionTitle"
                  type="text"
                  autoFocus
                  required
                  placeholder="例: IT企業の面接練習 第1回"
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isCreating}
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newSessionTitle.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isCreating ? "作成中..." : "作成して開始"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 設定モーダル */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl shadow-lg w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">設定</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              localStorage.setItem("gemini_api_key", apiKeyInput);
              localStorage.setItem("qwen_api_key", qwenApiKeyInput);
              localStorage.setItem("preferred_model", preferredModel);
              setIsSettingsOpen(false);
              alert("APIキーを保存しました。");
            }}>
              {/* 使用モデル選択 */}
              <div className="mb-5">
                <p className="text-sm font-medium mb-2">使用するAIモデル</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="model"
                      value="gemini"
                      checked={preferredModel === 'gemini'}
                      onChange={() => setPreferredModel('gemini')}
                    />
                    <span className="text-sm">Gemini (Google)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="model"
                      value="qwen"
                      checked={preferredModel === 'qwen'}
                      onChange={() => setPreferredModel('qwen')}
                    />
                    <span className="text-sm">Qwen (Alibaba)</span>
                  </label>
                </div>
              </div>

              {/* Gemini APIキー */}
              <div className="mb-4">
                <label htmlFor="apiKey" className="block text-sm font-medium mb-1">
                  Gemini API キー
                </label>
                <div className="text-xs text-muted-foreground mb-2">
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                    Google AI Studioから取得
                  </a>
                </div>
                <input
                  id="apiKey"
                  type="password"
                  placeholder="AIzaSy..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>

              {/* Qwen APIキー */}
              <div className="mb-6">
                <label htmlFor="qwenApiKey" className="block text-sm font-medium mb-1">
                  Qwen API キー
                </label>
                <div className="text-xs text-muted-foreground mb-2">
                  <a href="https://bailian.console.aliyun.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                    Alibaba Cloudバイリアンから取得
                  </a>
                </div>
                <input
                  id="qwenApiKey"
                  type="password"
                  placeholder="sk-..."
                  value={qwenApiKeyInput}
                  onChange={(e) => setQwenApiKeyInput(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>

              <div className="text-xs text-muted-foreground mb-4">
                APIキーはブラウザにのみ保存され、サーバーには送信・蓄積されません。
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setApiKeyInput(localStorage.getItem("gemini_api_key") || "");
                    setQwenApiKeyInput(localStorage.getItem("qwen_api_key") || "");
                    setPreferredModel((localStorage.getItem("preferred_model") as 'gemini' | 'qwen') || 'gemini');
                    setIsSettingsOpen(false);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={preferredModel === 'gemini' ? !apiKeyInput.trim() : !qwenApiKeyInput.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

