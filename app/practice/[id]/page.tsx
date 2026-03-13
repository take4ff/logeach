"use client";

import { use, useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
const SlideViewer = dynamic(
    () => import("@/src/components/practice/SlideViewer"),
    { ssr: false }
);
const SlideRecorder = dynamic(
    () => import("@/src/components/practice/SlideRecorder"),
    { ssr: false }
);
import ChatInterface, { Message } from "@/src/components/practice/ChatInterface";
import PersonaConfig from "@/src/components/setup/PersonaConfig";
import PersonaSelector from "@/src/components/setup/PersonaSelector";
import KnowledgeUpload from "@/src/components/setup/KnowledgeUpload";
import CharacterAvatar, { EmotionType } from "@/src/components/practice/CharacterAvatar";
import TutorialOverlay from "@/src/components/practice/TutorialOverlay";
import FeedbackModal from "@/src/components/practice/FeedbackModal";
import { supabase } from "@/src/lib/supabase";
import Logo from "@/src/components/common/Logo";
import type { PersonaData } from "@/app/api/chat/route";
import { Users, Sliders, BookOpen, ChevronLeft, Sun, Moon } from "lucide-react";
import { useTheme } from "@/src/components/common/ThemeProvider";

export default function PracticePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const [currentEmotion, setCurrentEmotion] = useState<EmotionType>("neutral");
    const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
    const [isPersonaSelectorOpen, setIsPersonaSelectorOpen] = useState(false);
    const [isKnowledgeModalOpen, setIsKnowledgeModalOpen] = useState(false);

    // スライドの現在ページ・総ページ数（SlideRecorder との共有）
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);

    // localStorage からスライドURLを読み取る（SlideViewer の onPdfUrlReady で更新）
    const [slideUrl, setSlideUrl] = useState<string | null>(null);

    const handleFeedbackReady = useCallback(
        async (slideAudios: { page: number; blob: Blob; imageBase64?: string }[]) => {
            setIsFeedbackModalOpen(true);
            setIsFeedbackLoading(true);
            setFeedbackResult(null);
            setFeedbackError(null);

            try {
                const formData = new FormData();
                formData.append('sessionId', id);
                if (slideUrl) formData.append('slideUrl', slideUrl);
                for (const { page, blob, imageBase64 } of slideAudios) {
                    formData.append(`audio_page_${page}`, blob);
                    if (imageBase64) {
                        formData.append(`image_page_${page}`, imageBase64);
                    }
                }

                // localStorage から設定を読み込んで付与
                const preferredModel = localStorage.getItem('preferred_model') || 'gemini';
                const geminiApiKey = localStorage.getItem('gemini_api_key') || '';
                const qwenApiKey = localStorage.getItem('qwen_api_key') || '';
                formData.append('modelProvider', preferredModel);
                formData.append('geminiApiKey', geminiApiKey);
                formData.append('qwenApiKey', qwenApiKey);

                const res = await fetch('/api/analyze-presentation', {
                    method: 'POST',
                    body: formData,
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error ?? `HTTP error: ${res.status}`);
                }

                const data = await res.json();
                const feedbackText = data.feedback ?? 'フィードバックを取得できませんでした。';
                setFeedbackResult(feedbackText);
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant" as const, text: feedbackText },
                ]);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : '不明なエラー';
                setFeedbackError(`フィードバックの取得に失敗しました: ${msg}`);
            } finally {
                setIsFeedbackLoading(false);
            }
        },
        [id, slideUrl]
    );

    const [messages, setMessages] = useState<Message[]>([]);
    const [streamingText, setStreamingText] = useState<string | null>(null);
    const [expandedMessages, setExpandedMessages] = useState<Record<number, boolean>>({});
    const [historyLoading, setHistoryLoading] = useState(true);
    const [currentPersona, setCurrentPersona] = useState<PersonaData | null>(null);
    const [sessionPersonaId, setSessionPersonaId] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);

    // フィードバックモーダル
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [feedbackResult, setFeedbackResult] = useState<string | null>(null);
    const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
    const [feedbackError, setFeedbackError] = useState<string | null>(null);
    const { theme, toggleTheme } = useTheme();

    // チュートリアル（新規セッション＝メッセージ履歴が空の場合のみ表示）
    const [isTutorialOpen, setIsTutorialOpen] = useState(false);

    /** sessions.persona_id → personas テーブルからペルソナ情報を取得 */
    const loadPersona = useCallback(async () => {
        const { data: sessionData } = await supabase
            .from("sessions")
            .select("persona_id")
            .eq("id", id)
            .single();
        if (!sessionData?.persona_id) return;
        setSessionPersonaId(sessionData.persona_id);

        const { data } = await supabase
            .from("personas")
            .select("name, traits, background")
            .eq("id", sessionData.persona_id)
            .single();
        if (!data) return;

        const traits: string[] = data.traits ?? [];
        const personalityTrait = traits.find((t: string) => t.startsWith("性格: "));
        const landminesTrait = traits.find((t: string) => t.startsWith("地雷ポイント: "));

        setCurrentPersona({
            name: data.name ?? "",
            personality: personalityTrait?.replace("性格: ", "") ?? "",
            landmines: landminesTrait?.replace("地雷ポイント: ", "") ?? "",
            background: data.background ?? "",
        });
    }, [id]);

    // セッション開始時にDBから過去のメッセージ履歴を取得
    useEffect(() => {
        async function loadHistory() {
            try {
                const res = await fetch(`/api/chat_logs/${id}`);
                if (res.ok) {
                    const { messages: history } = await res.json();
                    const loaded: Message[] = history ?? [];
                    setMessages(loaded);

                    // 履歴が空 = 新規セッション → チュートリアルを表示（1度のみ）
                    const tutorialKey = `tutorial_shown_${id}`;
                    if (loaded.length === 0 && !localStorage.getItem(tutorialKey)) {
                        setIsTutorialOpen(true);
                        localStorage.setItem(tutorialKey, "1");
                    }
                }
            } catch (err) {
                console.error("履歴の取得に失敗しました:", err);
            } finally {
                setHistoryLoading(false);
            }
        }
        loadHistory();
    }, [id]);

    // セッション開始時にペルソナ情報を取得
    useEffect(() => {
        loadPersona();
    }, [loadPersona]);

    // 新しいメッセージ・ストリーミング更新のたびに自動スクロール
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, streamingText]);

    // user がメッセージを送信したとき
    const handleUserMessage = useCallback((text: string) => {
        setMessages((prev) => [...prev, { role: "user" as const, text }]);
        setStreamingText("考え中...");
    }, []);

    // ストリーミング中（chunk が届くたびに呼ばれる）
    const handleAssistantChunk = useCallback((chunk: string) => {
        setStreamingText(chunk);
    }, []);

    const handleAssistantDone = useCallback((fullText: string, emotion?: string) => {
        setStreamingText(null);

        // AIから emotion が届いていればそれを使い、なければ neutral に戻す
        const nextEmotion = (emotion as EmotionType) || "neutral";
        setCurrentEmotion(nextEmotion);

        setMessages((prev) => [
            ...prev,
            { role: "assistant" as const, text: fullText, emotion: nextEmotion },
        ]);
    }, []);

    return (
        <div className="h-screen flex flex-col bg-background">
            {/* チュートリアル（セッション初回のみ） */}
            {isTutorialOpen && (
                <TutorialOverlay onClose={() => setIsTutorialOpen(false)} />
            )}
            {/* ヘッダー */}
            <header className="bg-surface border-b border-border px-4 py-2 flex items-center justify-between shadow-sm z-10">
                <Link
                    href="/"
                    className="flex items-center gap-1 text-sm text-foreground-muted hover:text-primary transition-colors rounded-lg px-2 py-1 hover:bg-primary-bg"
                >
                    <ChevronLeft size={16} />
                    <span>戻る</span>
                </Link>
                <Logo size="small" withLink={false} />
                <div className="flex items-center gap-1">
                    <button
                        onClick={toggleTheme}
                        className="flex items-center p-1.5 rounded-lg text-foreground-secondary hover:text-primary hover:bg-primary-bg transition-colors"
                        title={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
                    >
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                    <div className="w-14" />
                </div>
            </header>

            {/* メインコンテンツ */}
            <div className="flex-1 flex overflow-hidden">
                {/* 左カラム */}
                <div className="flex-1 flex flex-col border-r border-border">
                    {/* 左上: スライド */}
                    <div className="flex-1 border-b border-border">
                        <SlideViewer
                            sessionId={id}
                            onPageChange={setCurrentPage}
                            onNumPagesReady={setTotalPages}
                            onPdfUrlReady={setSlideUrl}
                        />
                    </div>
                    {/* 左中: 録音コントローラー */}
                    <div className="px-4 py-2 bg-gray-950">
                        <SlideRecorder
                            totalPages={totalPages}
                            currentPage={currentPage}
                            sessionId={id}
                            onFeedbackReady={handleFeedbackReady}
                        />
                    </div>
                    {/* 左下: AIに反論 */}
                    <div className="p-4 bg-surface border-t border-border">
                        <label className="block text-sm font-medium mb-2">AIに反論</label>
                        <ChatInterface
                            sessionId={id}
                            personaData={currentPersona ?? undefined}
                            slideUrl={slideUrl ?? undefined}
                            onUserMessage={handleUserMessage}
                            onAssistantChunk={handleAssistantChunk}
                            onAssistantDone={handleAssistantDone}
                        />
                    </div>
                </div>

                {/* 右カラム: AIコメント + 設定 */}
                <div className="w-[260px] sm:w-[300px] md:w-[360px] lg:w-[420px] flex flex-col bg-surface shadow-[-2px_0_8px_rgba(0,0,0,0.04)]">
                    {/* アバター表示 */}
                    <div className="border-b border-border bg-surface-hover">
                        <CharacterAvatar emotion={currentEmotion} sessionId={id} />
                    </div>

                    {/* チャット表示エリア */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {historyLoading ? (
                            <div className="flex items-center justify-center py-8 gap-2">
                                <span className="typing-dot w-2 h-2 rounded-full bg-foreground-muted inline-block" />
                                <span className="typing-dot w-2 h-2 rounded-full bg-foreground-muted inline-block" />
                                <span className="typing-dot w-2 h-2 rounded-full bg-foreground-muted inline-block" />
                            </div>
                        ) : messages.length === 0 && streamingText === null ? (
                            <div className="flex flex-col items-center justify-center h-full py-10 gap-3 text-center">
                                <div className="w-12 h-12 rounded-full bg-primary-bg flex items-center justify-center text-2xl">
                                    💬
                                </div>
                                <p className="text-sm text-foreground-muted leading-relaxed">
                                    録音して発表を始めると<br />AIのコメントがここに届きます
                                </p>
                            </div>
                        ) : (
                            <>
                                {messages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex animate-fade-in ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                    >
                                        {(() => {
                                            const isLong = msg.text.length > 220 || msg.text.split("\n").length > 6;
                                            const isExpanded = expandedMessages[idx] ?? false;
                                            return (
                                                <div className={`max-w-[88%] flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                                                    <div
                                                        className={`w-full text-sm px-4 py-2.5 ${
                                                            !isExpanded && isLong ? "max-h-32 overflow-hidden" : ""
                                                        } ${
                                                            msg.role === "user"
                                                                ? "bg-primary text-white rounded-2xl rounded-br-sm shadow-sm"
                                                                : "bg-surface-hover text-foreground rounded-2xl rounded-bl-sm shadow-sm"
                                                        }`}
                                                    >
                                                        <div className="markdown-content">
                                                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                                                        </div>
                                                    </div>
                                                    {isLong && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setExpandedMessages((prev) => ({
                                                                    ...prev,
                                                                    [idx]: !isExpanded,
                                                                }))
                                                            }
                                                            className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                                                                msg.role === "user"
                                                                    ? "text-primary-light hover:bg-primary-bg"
                                                                    : "text-foreground-muted hover:bg-surface-hover"
                                                            }`}
                                                        >
                                                            {isExpanded ? "▲ 折りたたむ" : "▼ 続きを読む"}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                ))}

                                {/* ストリーミング中: タイピングアニメーション or テキスト */}
                                {streamingText !== null && (
                                    <div className="flex justify-start animate-fade-in">
                                        <div className="max-w-[88%] bg-surface-hover text-foreground text-sm rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm">
                                            {streamingText === "考え中..." ? (
                                                <span className="flex items-center gap-1.5 py-0.5">
                                                    <span className="typing-dot w-2 h-2 rounded-full bg-foreground-secondary inline-block" />
                                                    <span className="typing-dot w-2 h-2 rounded-full bg-foreground-secondary inline-block" />
                                                    <span className="typing-dot w-2 h-2 rounded-full bg-foreground-secondary inline-block" />
                                                </span>
                                            ) : (
                                                <div className="markdown-content">
                                                    <ReactMarkdown>{streamingText}</ReactMarkdown>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div ref={bottomRef} />
                            </>
                        )}
                    </div>

                    {/* 右カラム下部: ペルソナ情報 + 操作ボタン */}
                    <div className="border-t border-border bg-surface-hover p-3 space-y-2">
                        {/* 現在のペルソナ表示 */}
                        {currentPersona ? (
                            <div className="flex items-center gap-2 px-3 py-2 bg-primary-bg rounded-lg border border-[#b8d4e8]">
                                <span className="text-lg leading-none">👤</span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-primary truncate">{currentPersona.name}</p>
                                    {currentPersona.landmines && (
                                        <p className="text-[11px] text-primary-dark/70 truncate">地雷: {currentPersona.landmines}</p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-center text-foreground-muted py-1">ペルソナ未設定</p>
                        )}
                        <div className="grid grid-cols-3 gap-1.5">
                            <button
                                onClick={() => setIsPersonaSelectorOpen(true)}
                                className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg bg-surface border border-border hover:border-primary/40 hover:bg-primary-bg text-foreground-secondary hover:text-primary transition-all text-center"
                            >
                                <Users size={16} />
                                <span className="text-[11px] font-medium leading-tight">ペルソナ<br/>選択</span>
                            </button>
                            <button
                                onClick={() => setIsPersonaModalOpen(true)}
                                className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg bg-surface border border-border hover:border-primary/40 hover:bg-primary-bg text-foreground-secondary hover:text-primary transition-all text-center"
                            >
                                <Sliders size={16} />
                                <span className="text-[11px] font-medium leading-tight">人物像<br/>設定</span>
                            </button>
                            <button
                                onClick={() => setIsKnowledgeModalOpen(true)}
                                className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg bg-surface border border-border hover:border-primary/40 hover:bg-primary-bg text-foreground-secondary hover:text-primary transition-all text-center"
                            >
                                <BookOpen size={16} />
                                <span className="text-[11px] font-medium leading-tight">前提<br/>知識</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ペルソナ選択モーダル */}
            {isPersonaSelectorOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 sm:p-6 overflow-y-auto"
                    onClick={() => setIsPersonaSelectorOpen(false)}
                >
                    <div
                        className="bg-background rounded-xl shadow-lg w-full max-w-md p-6 my-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-bold mb-4">ペルソナを選択</h2>

                        <PersonaSelector
                            sessionId={id}
                            currentPersonaId={sessionPersonaId}
                            onSelect={() => {
                                setIsPersonaSelectorOpen(false);
                                loadPersona();
                            }}
                        />

                        <div className="mt-6 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsPersonaSelectorOpen(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 人物像設定モーダル */}
            {isPersonaModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 sm:p-6 overflow-y-auto"
                    onClick={() => setIsPersonaModalOpen(false)}
                >
                    <div
                        className="bg-background rounded-xl shadow-lg w-full max-w-md p-6 my-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-bold mb-4">AIの人物像設定</h2>

                        <PersonaConfig
                            sessionId={id}
                            onSaveSuccess={() => {
                                setIsPersonaModalOpen(false);
                                loadPersona(); // 保存後にペルソナ情報を再取得
                            }}
                        />

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setIsPersonaModalOpen(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 前提知識アップロードモーダル */}
            {isKnowledgeModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 sm:p-6 overflow-y-auto"
                    onClick={() => setIsKnowledgeModalOpen(false)}
                >
                    <div
                        className="bg-background rounded-xl shadow-lg w-full max-w-md p-6 my-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-bold mb-4">前提知識のアップロード</h2>

                        <KnowledgeUpload
                            sessionId={id}
                            onSaveSuccess={() => setIsKnowledgeModalOpen(false)}
                        />

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setIsKnowledgeModalOpen(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* フィードバックモーダル */}
            <FeedbackModal
                isOpen={isFeedbackModalOpen}
                onClose={() => setIsFeedbackModalOpen(false)}
                isLoading={isFeedbackLoading}
                feedback={feedbackResult}
                error={feedbackError}
            />
        </div>
    );
}
