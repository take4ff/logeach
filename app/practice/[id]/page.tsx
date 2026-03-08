"use client";

/**
 * 練習セッション画面
 *
 * レイアウト:
 * 左上: SlideViewer（スライド表示）   右: AIのコメント表示
 * 左下: AIに反論（入力フォーム）      右下: 設定ボタン
 */

import { use } from "react";
import Link from "next/link";
import SlideViewer from "@/src/components/practice/SlideViewer";
import ChatInterface from "@/src/components/practice/ChatInterface";
import PersonaConfig from "@/src/components/setup/PersonaConfig";

export default function PracticePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);

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
                    <div className="border-t border-border p-4">
                        <PersonaConfig />
                    </div>
                </div>
            </div>
        </div>
    );
}
