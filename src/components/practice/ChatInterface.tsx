"use client";

/**
 * ChatInterface コンポーネント
 * TODO: メンバー2 - AIとの対話UIとAPI連携を実装
 */

export default function ChatInterface({ sessionId }: { sessionId: string }) {
    return (
        <div>
            <label className="block text-sm font-medium mb-2">AIに反論</label>
            <input
                type="text"
                placeholder="反論を入力..."
                className="w-full border border-border rounded px-4 py-2 text-sm"
            />
        </div>
    );
}
