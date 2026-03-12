"use client";

interface TutorialOverlayProps {
    onClose: () => void;
}

export default function TutorialOverlay({ onClose }: TutorialOverlayProps) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="flex items-center gap-2">
                    <span className="text-2xl">👋</span>
                    <h2 className="text-lg font-bold text-gray-800">Logeachへようこそ！</h2>
                </div>

                {/* AIの設定 */}
                <section>
                    <h3 className="text-sm font-semibold text-blue-600 mb-2">⚙️ AIの設定</h3>
                    <ol className="text-sm text-gray-700 space-y-1.5 list-none">
                        <li>
                            <span className="font-medium">1.</span>【AIの人物像をカスタマイズ】からAIの性格や専門分野を設定
                        </li>
                        <li>
                            <span className="font-medium">2.</span>【前提知識をアップロード】からAIに学ばせたい資料をアップロード
                        </li>
                        <li>
                            <span className="font-medium">3.</span>【ペルソナを選択】からプリセットのキャラクターを選ぶことも可能
                        </li>
                    </ol>
                </section>

                <hr className="border-gray-100" />

                {/* 使い方 */}
                <section>
                    <h3 className="text-sm font-semibold text-green-600 mb-2">🎤 Logeachの使い方</h3>
                    <ol className="text-sm text-gray-700 space-y-1.5 list-none">
                        <li>
                            <span className="font-medium">1.</span>【スライド（PDF）をアップロード】からプレゼン資料をアップロード
                        </li>
                        <li>
                            <span className="font-medium">2.</span>【録音開始】でスライドに合わせてプレゼンを練習
                        </li>
                        <li>
                            <span className="font-medium">3.</span>【録音終了】後、AIにフィードバックをもらう
                        </li>
                        <li>
                            <span className="font-medium">4.</span>【AIに反論】欄からAIと議論して理解を深める
                        </li>
                    </ol>
                </section>

                <p className="text-xs text-gray-400 text-center">← / → キーでスライドを切り替えられます</p>

                {/* 閉じるボタン */}
                <button
                    onClick={onClose}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors duration-150"
                >
                    はじめる！
                </button>
            </div>
        </div>
    );
}
