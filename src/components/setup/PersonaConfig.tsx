"use client";

/**
 * PersonaConfig コンポーネント
 * TODO: メンバー3 - AIの人物像カスタマイズUIと前提知識アップロードを実装
 */

export default function PersonaConfig() {
    return (
        <div className="space-y-3">
            <button className="w-full border border-border rounded px-4 py-3 text-sm text-left hover:bg-surface-hover">
                AIの人物像カスタマイズ
            </button>
            <button className="w-full border border-border rounded px-4 py-3 text-sm text-left hover:bg-surface-hover">
                フォルダを選択（前提知識をアップロード）
            </button>
        </div>
    );
}
