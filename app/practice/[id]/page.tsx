"use client";

/**
 * 練習セッション画面
 *
 * レイアウト:
 * 左上: SlideViewer（スライド表示）   右: AIのコメント表示
 * 左下: AIに反論（入力フォーム）      右下: 設定ボタン
 */

import { use, useState } from "react";
import Link from "next/link";
import SlideViewer from "@/src/components/practice/SlideViewer";
import ChatInterface from "@/src/components/practice/ChatInterface";
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
                        <ChatInterface sessionId={id} />
                    </div>
                </div>

                {/* 右カラム: AIコメント + 設定 */}
                <div className="w-[420px] flex flex-col bg-white">
                    <div className="flex-1 p-4">
                        {/* TODO: メンバー2 - AIのコメント表示エリア */}
                        <p className="text-foreground-muted text-sm">AIのコメントがここに表示されます</p>
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
