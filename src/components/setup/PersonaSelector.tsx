"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/components/auth/AuthProvider";

interface PersonaRow {
    id: string;
    name: string;
    traits: string[];
    background: string;
}

interface PersonaSelectorProps {
    sessionId: string;
    currentPersonaId?: string | null;
    onSelect: () => void; // 選択後に親に再取得を依頼
}

export default function PersonaSelector({
    sessionId,
    currentPersonaId,
    onSelect,
}: PersonaSelectorProps) {
    const { user } = useAuth();
    const [personas, setPersonas] = useState<PersonaRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(currentPersonaId ?? null);
    const [saving, setSaving] = useState(false);

    // ログインユーザーのペルソナ一覧を取得
    useEffect(() => {
        async function fetchPersonas() {
            if (!user) return;
            const { data } = await supabase
                .from("personas")
                .select("id, name, traits, background")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });
            setPersonas((data as PersonaRow[]) ?? []);
            setLoading(false);
        }
        fetchPersonas();
    }, [user]);

    // ペルソナを選択してセッションに紐付ける
    const handleApply = async () => {
        if (!selectedId) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from("sessions")
                .update({ persona_id: selectedId })
                .eq("id", sessionId);
            if (error) throw error;
            onSelect(); // 親で loadPersona() を呼んでもらう
        } catch (err: unknown) {
            console.error("ペルソナの適用に失敗しました:", err);
            alert("ペルソナの適用に失敗しました。もう一度お試しください。");
        } finally {
            setSaving(false);
        }
    };

    // ペルソナを削除する
    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation(); // 行のクリック（選択）を発火させない
        if (!confirm("本当にこのペルソナを削除しますか？")) return;

        try {
            // 現在選択中のものを削除したら選択状態をクリア
            if (selectedId === id) setSelectedId(null);

            // このペルソナを参照しているセッションを先に解除（外部キー制約対策）
            const { error: unlinkError } = await supabase
                .from("sessions")
                .update({ persona_id: null })
                .eq("persona_id", id);

            if (unlinkError) throw unlinkError;

            // Supabaseから削除
            const { error: deleteError } = await supabase
                .from("personas")
                .delete()
                .eq("id", id);

            if (deleteError) throw deleteError;

            // ローカルステートから除外
            setPersonas((prev) => prev.filter((p) => p.id !== id));

            // 削除したペルソナが現在のセッションに適用されていた場合は親に通知
            if (id === currentPersonaId) {
                onSelect();
            }
        } catch (err: unknown) {
            const msg = err instanceof Error
                ? err.message
                : (err as { message?: string })?.message ?? JSON.stringify(err);
            console.error("ペルソナの削除に失敗しました:", msg);
            alert(`削除に失敗しました。\n${msg}`);
        }
    };

    if (loading) {
        return <p className="text-sm text-muted-foreground">読み込み中...</p>;
    }

    if (personas.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                登録済みのペルソナがありません。<br />
                「AIの人物像をカスタマイズ」から先に作成してください。
            </p>
        );
    }

    return (
        <div className="space-y-3">
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {personas.map((p) => {
                    const personalityTrait = p.traits?.find((t) => t.startsWith("性格: "));
                    const landmineTrait = p.traits?.find((t) => t.startsWith("地雷ポイント: "));
                    const isSelected = selectedId === p.id;

                    return (
                        <div
                            key={p.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedId(p.id)}
                            onKeyDown={(e) => e.key === 'Enter' && setSelectedId(p.id)}
                            className={`w-full text-left rounded-xl border px-4 py-3 transition-all cursor-pointer ${isSelected
                                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                                    : "border-border hover:border-primary/40 hover:bg-muted/40"
                                }`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <p className="font-medium text-sm truncate">{p.name}</p>
                                    {isSelected && (
                                        <span className="text-primary text-xs font-semibold shrink-0">✓ 選択中</span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => handleDelete(e, p.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors shrink-0"
                                    title="削除"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 6h18"></path>
                                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                        <line x1="10" y1="11" x2="10" y2="17"></line>
                                        <line x1="14" y1="11" x2="14" y2="17"></line>
                                    </svg>
                                </button>
                            </div>
                            {personalityTrait && (
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                    性格: {personalityTrait.replace("性格: ", "")}
                                </p>
                            )}
                            {landmineTrait && (
                                <p className="text-xs text-red-500 mt-0.5 truncate">
                                    地雷: {landmineTrait.replace("地雷ポイント: ", "")}
                                </p>
                            )}
                            {p.background && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                    背景: {p.background}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            <button
                type="button"
                onClick={handleApply}
                disabled={!selectedId || saving || selectedId === currentPersonaId}
                className="w-full bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
                {saving ? "適用中..." : "このペルソナを適用"}
            </button>
        </div>
    );
}
