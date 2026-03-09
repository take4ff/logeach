"use client";


import { use, useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import SlideViewer from "@/src/components/practice/SlideViewer";
import ChatInterface, { Message } from "@/src/components/practice/ChatInterface";
import PersonaConfig from "@/src/components/setup/PersonaConfig";

export default function PracticePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);

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
                        <SlideViewer />
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

                    {/* 設定 */}
                    <div className="border-t border-border p-4">
                        <PersonaConfig />
                    </div>
                </div>
            </div>
        </div>
    );
}