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
import { Plus, Settings, LogOut, Trash2, ArrowRight, User, Mic, ChevronRight, X, Sun, Moon } from "lucide-react";
import { useTheme } from "@/src/components/common/ThemeProvider";

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
  const { theme, toggleTheme } = useTheme();

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

  // セッション削除処理
  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!confirm("このセッションを削除しますか？削除したデータは元に戻せません。")) return;
    try {
      // 外部キー制約のため、先に関連する chat_logs を削除する
      const { error: logsError } = await supabase
        .from("chat_logs")
        .delete()
        .eq("session_id", sessionId);
      if (logsError) throw logsError;

      const { error } = await supabase
        .from("sessions")
        .delete()
        .eq("id", sessionId);
      if (error) throw error;
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err: any) {
      console.error("セッションの削除に失敗しました:", err);
      alert(`削除に失敗しました。\n詳細: ${err.message || "不明なエラー"}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <header className="bg-surface border-b border-border sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Logo size="small" />
          <div className="flex items-center gap-1">
            <span className="text-sm text-foreground-muted hidden sm:inline mr-3">
              {user.displayName ?? user.email}
            </span>
            <button
              onClick={toggleTheme}
              className="flex items-center p-2 rounded-lg text-foreground-secondary hover:text-primary hover:bg-primary-bg transition-colors"
              title={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 text-foreground-secondary hover:text-primary hover:bg-primary-bg rounded-lg transition-colors"
            >
              <Settings size={15} />
              <span className="hidden sm:inline">設定</span>
            </button>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 text-foreground-secondary hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* ウェルカムバナー */}
        <div className="mb-8 sm:mb-10 p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-primary to-primary-light text-white shadow-md relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 0%, transparent 60%)" }} />
          <div className="relative">
            <p className="text-sm font-medium opacity-80 mb-1">おかえりなさい 👋</p>
            <h1 className="text-xl sm:text-2xl font-bold mb-2">{user.displayName ?? user.email?.split("@")[0]} さん</h1>
            <p className="text-sm opacity-75">今日も発表練習でプレゼン力を磨きましょう</p>
          </div>
          <button
            onClick={() => { setIsModalOpen(true); setNewSessionTitle(""); }}
            className="mt-4 inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-white text-primary font-semibold rounded-full text-sm hover:shadow-md transition-all hover:scale-105 active:scale-100"
          >
            <Plus size={16} />
            新しい練習を始める
          </button>
        </div>

        {/* セクションヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Mic size={16} className="text-primary" />
            練習履歴
            {!loadingSessions && sessions.length > 0 && (
              <span className="text-xs font-normal text-foreground-muted bg-surface-hover px-2 py-0.5 rounded-full">
                {sessions.length} 件
              </span>
            )}
          </h2>
        </div>

        {/* セッション一覧 */}
        {loadingSessions ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[160px] rounded-xl bg-surface border border-border animate-pulse" />
            ))}
          </div>
        ) : sessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => handleOpenSession(session.id)}
                className="relative flex flex-col p-5 rounded-xl border border-border bg-surface hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group animate-fade-in"
              >
                {/* 削除ボタン */}
                <button
                  onClick={(e) => handleDeleteSession(e, session.id)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-foreground-muted hover:text-red-500 hover:bg-red-50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all z-10"
                  title="削除"
                >
                  <Trash2 size={14} />
                </button>

                {/* 上部: 日付 */}
                <span className="text-xs text-foreground-muted mb-3">
                  {new Date(session.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>

                {/* タイトル */}
                <h3 className="text-sm font-semibold text-foreground line-clamp-2 mb-2 pr-6" title={session.title || "無題のセッション"}>
                  {session.title || "無題のセッション"}
                </h3>

                {/* ペルソナ */}
                <div className="flex items-center gap-1.5 text-xs text-foreground-muted mt-auto">
                  <User size={12} className="shrink-0" />
                  <span className="truncate">{session.personas?.name ?? "ペルソナ未設定"}</span>
                </div>

                {/* フッター */}
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-end text-xs font-medium text-primary gap-1 group-hover:gap-2 transition-all">
                  <span>開く</span>
                  <ChevronRight size={13} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-border bg-surface text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary-bg flex items-center justify-center">
              <Mic size={24} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">まだ練習記録がありません</p>
              <p className="text-sm text-foreground-muted">上の「新しい練習を始める」から最初のセッションを作成しましょう</p>
            </div>
            <button
              onClick={() => { setIsModalOpen(true); setNewSessionTitle(""); }}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-semibold rounded-full text-sm hover:bg-primary-dark transition-colors shadow-sm"
            >
              <Plus size={16} />
              新しい練習を始める
            </button>
          </div>
        )}
      </main>

      {/* 新規作成モーダル */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-surface rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">新しい練習セッション</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X size={18} className="text-foreground-muted" />
              </button>
            </div>
            <form onSubmit={handleCreateSession}>
              <div className="mb-5">
                <label htmlFor="sessionTitle" className="block text-sm font-medium mb-1.5">
                  セッション名（発表テーマなど）
                </label>
                <input
                  id="sessionTitle"
                  type="text"
                  autoFocus
                  required
                  placeholder="例: IT企業の面接練習 第1回"
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isCreating}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-foreground-secondary hover:bg-muted transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newSessionTitle.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-dark disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isCreating ? (
                    <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />作成中...</>
                  ) : (
                    <><ArrowRight size={15} />作成して開始</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 設定モーダル */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="bg-surface rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold flex items-center gap-2"><Settings size={18} className="text-primary" /> 設定</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X size={18} className="text-foreground-muted" />
              </button>
            </div>
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
                <div className="flex gap-3">
                  {(["gemini", "qwen"] as const).map((model) => (
                    <label
                      key={model}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium cursor-pointer transition-all ${
                        preferredModel === model
                          ? "border-primary bg-primary-bg text-primary"
                          : "border-border text-foreground-secondary hover:border-primary/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="model"
                        value={model}
                        checked={preferredModel === model}
                        onChange={() => setPreferredModel(model)}
                        className="hidden"
                      />
                      {model === "gemini" ? "✦ Gemini" : "◈ Qwen"}
                    </label>
                  ))}
                </div>
              </div>

              {/* Gemini APIキー */}
              <div className="mb-4">
                <label htmlFor="apiKey" className="block text-sm font-medium mb-1.5">Gemini API キー</label>
                <div className="text-xs text-foreground-muted mb-2">
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Google AI Studioから取得 →
                  </a>
                </div>
                <input
                  id="apiKey"
                  type="password"
                  placeholder="AIzaSy..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                />
              </div>

              {/* Qwen APIキー */}
              <div className="mb-5">
                <label htmlFor="qwenApiKey" className="block text-sm font-medium mb-1.5">Qwen API キー</label>
                <div className="text-xs text-foreground-muted mb-2">
                  <a href="https://bailian.console.aliyun.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Alibaba Cloudバイリアンから取得 →
                  </a>
                </div>
                <input
                  id="qwenApiKey"
                  type="password"
                  placeholder="sk-..."
                  value={qwenApiKeyInput}
                  onChange={(e) => setQwenApiKeyInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                />
              </div>

              <p className="text-xs text-foreground-muted mb-4 bg-surface-hover rounded-lg px-3 py-2">
                🔒 APIキーはブラウザにのみ保存され、サーバーには送信されません。
              </p>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setApiKeyInput(localStorage.getItem("gemini_api_key") || "");
                    setQwenApiKeyInput(localStorage.getItem("qwen_api_key") || "");
                    setPreferredModel((localStorage.getItem("preferred_model") as 'gemini' | 'qwen') || 'gemini');
                    setIsSettingsOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-foreground-secondary hover:bg-muted transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={preferredModel === 'gemini' ? !apiKeyInput.trim() : !qwenApiKeyInput.trim()}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-dark disabled:opacity-50 transition-colors shadow-sm"
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

