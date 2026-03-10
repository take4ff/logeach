"use client";

import { useState, useRef, useCallback } from "react";
import type { PersonaData } from "@/app/api/chat/route";

export interface Message {
    role: "user" | "assistant";
    text: string;
    emotion?: string;
}

interface ChatInterfaceProps {
    sessionId: string;
    personaData?: PersonaData;
    onUserMessage?: (text: string) => void;
    onAssistantChunk?: (chunk: string) => void;
    onAssistantDone?: (fullText: string, emotion?: string) => void;
}

export default function ChatInterface({
    sessionId,
    personaData,
    onUserMessage,
    onAssistantChunk,
    onAssistantDone,
}: ChatInterfaceProps) {
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            const trimmed = input.trim();
            if (!trimmed || isLoading) return;

            abortControllerRef.current?.abort();
            const controller = new AbortController();
            abortControllerRef.current = controller;

            setInput("");
            setIsLoading(true);
            onUserMessage?.(trimmed);

            try {
                const res = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sessionId, message: trimmed, personaData }),
                    signal: controller.signal,
                });

                if (!res.ok) throw new Error(`HTTP error: ${res.status}`);

                const reader = res.body?.getReader();
                const decoder = new TextDecoder();
                if (!reader) throw new Error("No response body");

                let accumulated = "";
                let emotion: string | undefined;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    for (const line of chunk.split("\n")) {
                        if (!line.startsWith("data: ")) continue;
                        const data = line.slice(6).trim();
                        if (data === "[DONE]") break;
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.text) {
                                accumulated += parsed.text;
                                onAssistantChunk?.(accumulated);
                            }
                            if (parsed.emotion) emotion = parsed.emotion;
                        } catch { /* ignore */ }
                    }
                }
                onAssistantDone?.(accumulated, emotion);
            } catch (err: unknown) {
                if (err instanceof Error && err.name !== "AbortError") {
                    console.error("Chat API エラー:", err);
                    onAssistantDone?.("エラーが発生しました。もう一度お試しください。");
                }
            } finally {
                setIsLoading(false);
            }
        },
        [input, isLoading, sessionId, personaData, onUserMessage, onAssistantChunk, onAssistantDone]
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as unknown as React.FormEvent);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="反論を入力..."
                disabled={isLoading}
                className="flex-1 border border-border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
            />
            <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                {isLoading ? "送信中" : "送信"}
            </button>
        </form>
    );
}
