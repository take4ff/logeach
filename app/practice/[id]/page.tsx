"use client";

import { use, useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
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
import KnowledgeUpload from "@/src/components/setup/KnowledgeUpload";

export default function PracticePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
    const [isKnowledgeModalOpen, setIsKnowledgeModalOpen] = useState(false);

    // スライドの現在ページ・総ページ数（SlideRecorder との共有）
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);

    const handleFeedbackReady = useCallback(
        (slideAudios: { page: number; blob: Blob }[]) => {
            // TODO: 録音データを AI フィードバック API に送信する
            console.log("[Logeach] フィードバック依頼:", slideAudios);
        },
        []
    );

    const [messages, setMessages] = useState<Message[]>([]);
    const [streamingText, setStreamingText] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);

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

    // ストリーミング完了
    const handleAssistantDone = useCallback((fullText: string, emotion?: string) => {
        setStreamingText(null);
        setMessages((prev) => [
            ...prev,
            { role: "assistant" as const, text: fullText, emotion },
        ]);
    }, []);

    return (
        <div className="h-screen flex flex-col">
            {/* ヘッダー */}
            <header className="bg-white border-b border-border px-4 py-2 flex items-center justify-between">
                <Link href="/" className="text-sm text-foreground-muted hover:text-foreground">
                    ← 戻る
                </Link>
                <span className="font-semibold">Logeach</span>
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
                            onUserMessage={handleUserMessage}
                            onAssistantChunk={handleAssistantChunk}
                            onAssistantDone={handleAssistantDone}
                        />
                    </div>
                </div>

                {/* 右カラム: AIコメント + 設定 */}
                <div className="w-[420px] flex flex-col bg-white">
                    {/* AIコメント表示エリア（スクロール） */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {messages.length === 0 && streamingText === null ? (
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
                                            {msg.emotion && (
                                                <p className="mt-1 text-xs text-gray-500 italic">
                                                    😊 {msg.emotion}
                                                </p>
                                            )}
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
                            onSaveSuccess={() => setIsPersonaModalOpen(false)}
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
        </div>
    );
}