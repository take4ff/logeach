"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/components/auth/AuthProvider";

/**
 * KnowledgeUpload コンポーネント
 * AIの前提知識（ファイル）のアップロードを専用に行う
 */
export default function KnowledgeUpload({ 
    sessionId,
    onSaveSuccess 
}: { 
    sessionId: string;
    onSaveSuccess?: () => void 
}) {
    const { user } = useAuth();
    const [files, setFiles] = useState<File[]>([]);
    const [existingFiles, setExistingFiles] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 初期化時に既存のデータを取得する
    useEffect(() => {
        const fetchExistingKnowledge = async () => {
            if (!user || !sessionId) return;
            
            // 1. セッション情報を取得して persona_id を確認
            const { data: sessionData, error: sessionError } = await supabase
                .from("sessions")
                .select("persona_id")
                .eq("id", sessionId)
                .single();

            if (sessionError || !sessionData?.persona_id) return;

            // 2. persona_id に紐づく人物像の前提知識を取得
            const { data, error } = await supabase
                .from("personas")
                .select("knowledge_files")
                .eq("id", sessionData.persona_id)
                .single();

            if (data && !error && data.knowledge_files) {
                setExistingFiles(data.knowledge_files);
            }
        };
        fetchExistingKnowledge();
    }, [user, sessionId]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...newFiles]);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const removeFile = (indexToRemove: number) => {
        setFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || files.length === 0) return;

        setIsUploading(true);
        try {
            const uploadedFilePaths: string[] = [];
            
            for (const file of files) {
                // ユーザーの要望により、ファイル名をランダムな英数字に変更して保存する（Invalid keyエラー回避のため）
                const fileExt = file.name.split('.').pop() || '';
                const safeFileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
                const filePath = `${user.id}/${Date.now()}_${safeFileName}`;
                
                const { data: storageData, error: storageError } = await supabase.storage
                    .from('personas-knowledge')
                    .upload(filePath, file);
                    
                if (storageError) {
                    throw new Error(`ファイル「${file.name}」のアップロードに失敗しました: ${storageError.message}`);
                }
                
                if (storageData) {
                    uploadedFilePaths.push(storageData.path);
                }
            }

            // 1. まず現在のセッションに紐付いている persona_id を取得
            const { data: sessionData, error: sessionFetchError } = await supabase
                .from("sessions")
                .select("persona_id")
                .eq("id", sessionId)
                .single();

            if (sessionFetchError) throw sessionFetchError;

            const existingPersonaId = sessionData?.persona_id;

            if (existingPersonaId) {
                // 既存の人物像の前提知識のみを更新
                const { error: personaUpdateError } = await supabase
                    .from("personas")
                    .update({
                        knowledge_files: uploadedFilePaths
                    })
                    .eq("id", existingPersonaId);

                if (personaUpdateError) throw personaUpdateError;
            } else {
                // 新規作成
                const { data: newPersonaData, error: personaInsertError } = await supabase
                    .from("personas")
                    .insert([
                        {
                            user_id: user.id,
                            name: "前提知識", // 名前必須カラムのため固定値を入れる
                            knowledge_files: uploadedFilePaths
                        }
                    ])
                    .select()
                    .single();

                if (personaInsertError) throw personaInsertError;

                // セッションと新規人物像を紐付ける
                if (newPersonaData) {
                    const { error: sessionUpdateError } = await supabase
                        .from("sessions")
                        .update({ persona_id: newPersonaData.id })
                        .eq("id", sessionId);

                    if (sessionUpdateError) throw sessionUpdateError;
                }
            }

            alert("前提知識をアップロードしました！");
            
            // 成功時のコールバックを呼ぶ（モーダルを閉じるなど）
            if (onSaveSuccess) onSaveSuccess();
            
            // 既存ファイルリストを更新（擬似的に追加）
            setExistingFiles(prev => [...prev, ...uploadedFilePaths]);
            // フォーム（新規選択分）をリセット
            setFiles([]);
        } catch (error: any) {
            console.error("アップロードエラー:", error);
            alert(`アップロードに失敗しました: ${error.message || "不明なエラー"}`);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-6">
            <form onSubmit={handleUpload} className="space-y-4">
                <div className="pt-2">
                    <input
                        type="file"
                        multiple
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full border border-border rounded-lg px-4 py-3 text-sm text-left hover:bg-muted font-medium transition-colors flex items-center justify-between"
                    >
                        <span>ファイルを選択（複数選択可）</span>
                        <span className="text-muted-foreground">+</span>
                    </button>

                    {/* 選択されたファイルのリスト表示 */}
                    {files.length > 0 && (
                        <div className="mt-3 space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground">追加されたファイル</p>
                            <ul className="space-y-1">
                                {files.map((file, index) => (
                                    <li key={index} className="flex items-center justify-between text-sm bg-muted/50 px-3 py-2 rounded">
                                        <span className="truncate mr-2">{file.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeFile(index)}
                                            className="text-red-500 hover:text-red-700 font-bold px-2"
                                            aria-label="削除"
                                        >
                                            ×
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* すでにアップロード済みのファイルのリスト表示 */}
                    {existingFiles.length > 0 && (
                        <div className="mt-4 space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground">アップロード済みのファイル</p>
                            <ul className="space-y-1">
                                {existingFiles.map((path, index) => {
                                    // パスからファイル名を抽出（タイムスタンプ以降の部分）
                                    const fileName = path.split('_').slice(1).join('_') || path;
                                    const decodedName = decodeURIComponent(fileName);
                                    
                                    return (
                                        <li key={index} className="flex items-center text-sm bg-blue-50/50 px-3 py-2 rounded text-blue-700 border border-blue-100">
                                            <span className="truncate">{decodedName}</span>
                                            <span className="ml-auto text-[10px] bg-blue-100 px-1.5 py-0.5 rounded leading-none">保存済み</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={isUploading || files.length === 0}
                    className="w-full bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    {isUploading ? "アップロード中..." : "アップロードして保存"}
                </button>
            </form>
        </div>
    );
}
