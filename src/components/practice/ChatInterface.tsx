"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { PersonaData } from "@/app/api/chat/route";

export interface Message {
    role: "user" | "assistant";
    text: string;
    emotion?: string;
}

interface ChatInterfaceProps {
    sessionId: string;
    persona?: string;
    slideUrl?: string;
    personaData?: PersonaData;
    onUserMessage?: (text: string) => void;
    onAssistantChunk?: (chunk: string) => void;
    onAssistantDone?: (fullText: string, emotion?: string) => void;
}

export default function ChatInterface({
    sessionId,
    personaData,
    persona,
    slideUrl,
    onUserMessage,
    onAssistantChunk,
    onAssistantDone,
}: ChatInterfaceProps) {
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [userApiKey, setUserApiKey] = useState("");
    const [modelProvider, setModelProvider] = useState<'gemini' | 'qwen'>('gemini');
    const abortControllerRef = useRef<AbortController | null>(null);

    // 初回マウント時にlocalStorageからAPIキーとモデル設定を取得
    useEffect(() => {
        const preferred = (localStorage.getItem("preferred_model") ?? 'gemini') as 'gemini' | 'qwen';
        setModelProvider(preferred);
        const key = preferred === 'qwen'
            ? localStorage.getItem("qwen_api_key")
            : localStorage.getItem("gemini_api_key");
        if (key) setUserApiKey(key);
    }, []);

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
                    body: JSON.stringify({ sessionId, message: trimmed, persona, slideUrl, personaData, apiKey: userApiKey, modelProvider }),
                    signal: controller.signal,
                });

                if (!res.ok) {
                    const errBody = await res.json().catch(() => ({}));
                    onAssistantDone?.(errBody.error || `HTTP error: ${res.status}`);
                    return;
                }

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
                // emotion: xxx 行を表示テキストから除去する
                const cleanedText = accumulated.replace(/\n?emotion:\s*.+$/m, '').trimEnd();
                onAssistantDone?.(cleanedText, emotion);
            } catch (err: unknown) {
                if (err instanceof Error && err.name !== "AbortError") {
                    console.error("Chat API エラー:", err);
                    onAssistantDone?.(err.message || "エラーが発生しました。もう一度お試しください。");
                }
            } finally {
                setIsLoading(false);
            }
        },
        [input, isLoading, sessionId, persona, slideUrl, personaData, userApiKey, modelProvider, onUserMessage, onAssistantChunk, onAssistantDone]
    );

    // APIキーが設定されていない場合のエラー表示
    if (!userApiKey) {
        const label = modelProvider === 'qwen' ? 'Qwen' : 'Gemini';
        return (
            <div className="flex flex-col items-center justify-center p-4 bg-orange-50 border border-orange-200 rounded-lg text-orange-800 text-sm">
                <p className="font-medium mb-1">⚠️ APIキーが設定されていません</p>
                <p>ホーム画面の「⚙️設定」から{label} APIキーを登録してください。</p>
            </div>
        );
    }


    return (
        <div className="flex gap-2">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="反論を入力..."
                disabled={isLoading}
                className="flex-1 border border-border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
            />
            <button
                type="button"
                onClick={handleSubmit as unknown as React.MouseEventHandler}
                disabled={isLoading || !input.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                {isLoading ? "送信中" : "送信"}
            </button>
        </div>
    );
}
