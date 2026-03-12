"use client";

import { use, useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import dynamic from "next/dynamic";
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
import { supabase } from "@/src/lib/supabase";
import Logo from "@/src/components/common/Logo";
import type { PersonaData } from "@/app/api/chat/route";

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
                setFeedbackResult(data.feedback ?? 'フィードバックを取得できませんでした。');
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
    const [historyLoading, setHistoryLoading] = useState(true);
    const [currentPersona, setCurrentPersona] = useState<PersonaData | null>(null);
    const [sessionPersonaId, setSessionPersonaId] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);

    // フィードバックモーダル
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [feedbackResult, setFeedbackResult] = useState<string | null>(null);
    const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
    const [feedbackError, setFeedbackError] = useState<string | null>(null);

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
                    setMessages(history ?? []);
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
        <div className="h-screen flex flex-col">
            {/* ヘッダー */}
            <header className="bg-white border-b border-border px-4 py-2 flex items-center justify-between">
                <Link href="/" className="text-sm text-foreground-muted hover:text-foreground">
                    ← 戻る
                </Link>
                <Logo size="small" withLink={false} />
                <div className="w-16" />
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
                    <div className="p-4 bg-white">
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
                <div className="w-[260px] sm:w-[300px] md:w-[360px] lg:w-[420px] flex flex-col bg-white">
                    {/* 右カラム: アバター表示 */}
                    <div className="border-b border-border bg-gray-50/30">
                        <CharacterAvatar emotion={currentEmotion} />
                    </div>
                    {/* AIコメント表示エリア（スクロール） */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {historyLoading ? (
                            <p className="text-foreground-muted text-sm">履歴を読み込み中...</p>
                        ) : messages.length === 0 && streamingText === null ? (
                            <p className="text-foreground-muted text-sm">
                                AIのコメントがここに表示されます
                            </p>
                        ) : (
                            <>
                                {messages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                    >
                                        <div
                                            className={`max-w-[85%] text-sm rounded-2xl px-4 py-2 whitespace-pre-wrap ${msg.role === "user"
                                                ? "bg-blue-600 text-white rounded-br-sm"
                                                : "bg-gray-100 text-gray-800 rounded-bl-sm"
                                                }`}
                                        >
                                            {msg.text}

                                        </div>
                                    </div>
                                ))}

                                {/* ストリーミング中のアシスタントメッセージ */}
                                {streamingText !== null && (
                                    <div className="flex justify-start">
                                        <div className="max-w-[85%] bg-gray-100 text-gray-800 text-sm rounded-2xl rounded-bl-sm px-4 py-2 whitespace-pre-wrap">
                                            {streamingText}
                                        </div>
                                    </div>
                                )}

                                <div ref={bottomRef} />
                            </>
                        )}
                    </div>
                    <div className="border-t border-border p-4 space-y-3">
                        {/* 現在のペルソナ表示 */}
                        {currentPersona && (
                            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 flex items-center gap-2">
                                <span className="text-base">👤</span>
                                <div className="min-w-0">
                                    <p className="font-medium text-foreground truncate">{currentPersona.name}</p>
                                    {currentPersona.landmines && (
                                        <p className="truncate">地雷: {currentPersona.landmines}</p>
                                    )}
                                </div>
                            </div>
                        )}
                        <button
                            onClick={() => setIsPersonaSelectorOpen(true)}
                            className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-4 py-2 text-sm font-medium transition-colors border border-border"
                        >
                            ペルソナを選択
                        </button>
                        <button
                            onClick={() => setIsPersonaModalOpen(true)}
                            className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-4 py-2 text-sm font-medium transition-colors border border-border"
                        >
                            AIの人物像をカスタマイズ
                        </button>
                        <button
                            onClick={() => setIsKnowledgeModalOpen(true)}
                            className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg px-4 py-2 text-sm font-medium transition-colors border border-border"
                        >
                            前提知識をアップロード
                        </button>
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
            {isFeedbackModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 sm:p-6 overflow-y-auto"
                    onClick={() => { if (!isFeedbackLoading) setIsFeedbackModalOpen(false); }}
                >
                    <div
                        className="bg-background rounded-xl shadow-lg w-full max-w-2xl p-6 my-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-bold mb-4">AIフィードバック</h2>

                        {isFeedbackLoading && (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                                <span className="animate-spin text-3xl">⏳</span>
                                <p className="text-sm">音声を文字起こして分析中です。しばらくお待ちください…</p>
                            </div>
                        )}

                        {feedbackError && (
                            <p className="text-red-500 text-sm whitespace-pre-wrap">{feedbackError}</p>
                        )}

                        {feedbackResult && (
                            <div className="text-sm text-foreground leading-relaxed max-h-[60vh] overflow-y-auto border border-border rounded-lg p-4 bg-muted/30 prose prose-sm max-w-none">
                                <ReactMarkdown
                                    components={{
                                        h3: ({ children }) => <h3 className="text-base font-bold mt-4 mb-1">{children}</h3>,
                                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                        hr: () => <hr className="my-3 border-border" />,
                                        p: ({ children }) => <p className="mb-2">{children}</p>,
                                        ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
                                        li: ({ children }) => <li>{children}</li>,
                                    }}
                                >
                                    {feedbackResult}
                                </ReactMarkdown>
                            </div>
                        )}

                        {!isFeedbackLoading && (
                            <div className="mt-6 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setIsFeedbackModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted"
                                >
                                    閉じる
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
