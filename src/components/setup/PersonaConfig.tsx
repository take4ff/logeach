"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/components/auth/AuthProvider";
import { uploadAvatarImage, getAvatarUrl } from "@/src/lib/storage";
import type { EmotionType } from "@/src/components/practice/CharacterAvatar";

/**
 * PersonaConfig コンポーネント
 * AIの人物像カスタマイズUIと前提知識アップロードを実装
 */
export default function PersonaConfig({
    sessionId,
    onSaveSuccess
}: {
    sessionId: string;
    onSaveSuccess?: () => void
}) {
    const { user } = useAuth();
    const [name, setName] = useState("");
    const [personality, setPersonality] = useState("");
    const [landmines, setLandmines] = useState("");
    const [background, setBackground] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // アバターアップロード用ステート
    const EMOTIONS: EmotionType[] = ["neutral", "thinking", "satisfied", "skeptical", "angry", "impressed"];
    const EMOTION_LABELS: Record<EmotionType, string> = {
        neutral: "普通",
        thinking: "考え中",
        satisfied: "満足",
        skeptical: "懐疑的",
        angry: "怒り",
        impressed: "感銘",
    };
    const [avatarUploading, setAvatarUploading] = useState<Record<EmotionType, boolean>>({
        neutral: false, thinking: false, satisfied: false,
        skeptical: false, angry: false, impressed: false,
    });
    // 各感情のサムネイルURL（アップロード後に更新）
    const [avatarThumbs, setAvatarThumbs] = useState<Record<EmotionType, string>>(() => {
        const init = {} as Record<EmotionType, string>;
        for (const em of ["neutral", "thinking", "satisfied", "skeptical", "angry", "impressed"] as EmotionType[]) {
            init[em] = getAvatarUrl(sessionId, em);
        }
        return init;
    });
    // サムネイルが実際に存在するか（onError でフォールバック）
    const [avatarExists, setAvatarExists] = useState<Record<EmotionType, boolean>>({
        neutral: false, thinking: false, satisfied: false,
        skeptical: false, angry: false, impressed: false,
    });

    // 初期化時に既存のデータを取得する
    useEffect(() => {
        const fetchPersona = async () => {
            if (!user || !sessionId) return;

            // 1. セッション情報を取得して persona_id を確認
            const { data: sessionData, error: sessionError } = await supabase
                .from("sessions")
                .select("persona_id")
                .eq("id", sessionId)
                .single();

            if (sessionError || !sessionData?.persona_id) return;

            // 2. persona_id に紐づく人物像を取得
            const { data, error } = await supabase
                .from("personas")
                .select("*")
                .eq("id", sessionData.persona_id)
                .single();

            if (data && !error) {
                setName(data.name || "");
                setBackground(data.background || "");
                // traits配列から性格と地雷ポイントを抽出
                const traits = data.traits || [];
                const personalityTrait = traits.find((t: string) => t.startsWith("性格: "));
                const landminesTrait = traits.find((t: string) => t.startsWith("地雷ポイント: "));

                if (personalityTrait) setPersonality(personalityTrait.replace("性格: ", ""));
                if (landminesTrait) setLandmines(landminesTrait.replace("地雷ポイント: ", ""));
            }
        };
        fetchPersona();
    }, [user, sessionId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !name.trim()) return;

        setIsSaving(true);
        try {
            const personaDataToSave = {
                user_id: user.id,
                name: name.trim(),
                traits: [
                    personality.trim() ? `性格: ${personality.trim()}` : "",
                    landmines.trim() ? `地雷ポイント: ${landmines.trim()}` : ""
                ].filter(Boolean),
                background: background.trim()
            };

            // 常に新規ペルソナとして作成する（既存レコードは更新しない）
            const { data: newPersonaData, error: personaInsertError } = await supabase
                .from("personas")
                .insert([personaDataToSave])
                .select()
                .single();

            if (personaInsertError) throw personaInsertError;

            // セッションに新しいペルソナを紐付ける
            if (newPersonaData) {
                const { error: sessionUpdateError } = await supabase
                    .from("sessions")
                    .update({ persona_id: newPersonaData.id })
                    .eq("id", sessionId);

                if (sessionUpdateError) throw sessionUpdateError;
            }

            alert("人物像を保存しました！");
            if (onSaveSuccess) onSaveSuccess();
        } catch (error: any) {
            console.error("保存エラー:", error);
            alert(`保存に失敗しました: ${error.message || "不明なエラー"}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAvatarUpload = async (emotion: EmotionType, file: File) => {
        setAvatarUploading((prev) => ({ ...prev, [emotion]: true }));
        try {
            const url = await uploadAvatarImage(file, sessionId, emotion);
            // キャッシュバスターを付与してサムネイルを更新
            setAvatarThumbs((prev) => ({ ...prev, [emotion]: `${url}?t=${Date.now()}` }));
            setAvatarExists((prev) => ({ ...prev, [emotion]: true }));
        } catch (err: any) {
            console.error("アバターアップロードエラー:", err);
            alert(`アップロードに失敗しました: ${err.message || "不明なエラー"}`);
        } finally {
            setAvatarUploading((prev) => ({ ...prev, [emotion]: false }));
        }
    };

    return (
        <div className="space-y-6">
            <form onSubmit={handleSave} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">名前</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="例: 高橋 健太（面接官）"
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">性格</label>
                    <textarea
                        value={personality}
                        onChange={(e) => setPersonality(e.target.value)}
                        placeholder="例: 穏やかだが、論理の飛躍には厳しい。時折鋭い質問を投げる。"
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm min-h-[80px]"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">地雷ポイント</label>
                    <textarea
                        value={landmines}
                        onChange={(e) => setLandmines(e.target.value)}
                        placeholder="例: 抽象的な回答を嫌う。数字を混ぜて話さないと深堀してくる。"
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm min-h-[80px]"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">背景（専門分野など）</label>
                    <textarea
                        value={background}
                        onChange={(e) => setBackground(e.target.value)}
                        placeholder="例: ソフトウェアエンジニアリング専門の面接官"
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm min-h-[80px]"
                    />
                </div>
                <button
                    type="submit"
                    disabled={isSaving || !name.trim()}
                    className="w-full bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    {isSaving ? "保存中..." : "保存する"}
                </button>
            </form>

            {/* アバター画像アップロードセクション */}
            <div className="border-t border-border pt-4">
                <p className="text-sm font-medium mb-3">感情ごとのアバター画像</p>
                <p className="text-xs text-muted-foreground mb-4">
                    各感情に対応する画像をアップロードすると、デフォルト画像の代わりに使用されます（PNG・JPG推奨）。
                </p>
                <div className="grid grid-cols-2 gap-3">
                    {EMOTIONS.map((emotion) => (
                        <div key={emotion} className="flex flex-col items-center gap-2 p-3 border rounded-lg bg-muted/20">
                            {/* サムネイル */}
                            <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex items-center justify-center shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={avatarThumbs[emotion]}
                                    alt={`${emotion} avatar`}
                                    className="w-full h-full object-cover"
                                    onLoad={() =>
                                        setAvatarExists((prev) => ({ ...prev, [emotion]: true }))
                                    }
                                    onError={(e) => {
                                        setAvatarExists((prev) => ({ ...prev, [emotion]: false }));
                                        (e.currentTarget as HTMLImageElement).style.display = "none";
                                    }}
                                />
                                {!avatarExists[emotion] && (
                                    <span className="text-2xl text-muted-foreground select-none">🖼️</span>
                                )}
                            </div>

                            {/* 感情ラベル */}
                            <span className="text-xs font-medium text-center leading-tight">
                                {EMOTION_LABELS[emotion]}
                                <br />
                                <span className="text-muted-foreground font-normal">({emotion})</span>
                            </span>

                            {/* アップロードボタン */}
                            <label className={`w-full text-center cursor-pointer text-xs px-2 py-1.5 rounded-md border border-border transition-colors ${avatarUploading[emotion] ? "opacity-50 cursor-not-allowed bg-muted" : "hover:bg-muted"}`}>
                                {avatarUploading[emotion] ? "アップロード中..." : avatarExists[emotion] ? "変更" : "選択"}
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={avatarUploading[emotion]}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleAvatarUpload(emotion, file);
                                        e.target.value = "";
                                    }}
                                />
                            </label>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
