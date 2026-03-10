"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface SlideRecorderProps {
    totalPages: number;
    currentPage: number;
    sessionId: string;
    onFeedbackReady: (slideAudios: { page: number; blob: Blob }[]) => void;
}

type RecordingState = "idle" | "recording" | "done";

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function SlideRecorder({
    totalPages,
    currentPage,
    sessionId,
    onFeedbackReady,
}: SlideRecorderProps) {
    const [recordingState, setRecordingState] = useState<RecordingState>("idle");
    const [pageElapsed, setPageElapsed] = useState(0);
    const [slideAudios, setSlideAudios] = useState<{ page: number; blob: Blob }[]>([]);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const mediaStreamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // 現在「録音中」のページ番号を追跡する ref
    // （currentPage の useEffect と競合しないよう手動で管理する）
    const recordingPageRef = useRef(currentPage);

    // タイマーをリセット・開始
    const startTimer = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        setPageElapsed(0);
        timerRef.current = setInterval(() => {
            setPageElapsed((prev) => prev + 1);
        }, 1000);
    }, []);

    const stopTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // 現在の MediaRecorder を停止し、blob を slideAudios に追加する
    // 追加後に onStarted() コールバックを呼ぶことで新しい録音を連鎖できる
    const stopCurrentRecording = useCallback(
        (page: number, onStopped?: (audios: { page: number; blob: Blob }[]) => void) => {
            const mr = mediaRecorderRef.current;
            if (!mr || mr.state === "inactive") {
                onStopped?.(slideAudios);
                return;
            }

            mr.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };
            mr.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
                chunksRef.current = [];
                setSlideAudios((prev) => {
                    const updated = [...prev, { page, blob }];
                    onStopped?.(updated);
                    return updated;
                });
            };
            mr.stop();
        },
        [slideAudios]
    );

    // MediaRecorder を新規作成して録音開始
    const startNewRecording = useCallback((stream: MediaStream) => {
        chunksRef.current = [];
        const mr = new MediaRecorder(stream);
        mr.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        mr.start();
        mediaRecorderRef.current = mr;
    }, []);

    // 「録音開始」クリック
    const handleStart = useCallback(async () => {
        setErrorMsg(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            recordingPageRef.current = currentPage; // 録音開始時のページを記録
            startNewRecording(stream);
            setRecordingState("recording");
            startTimer();
        } catch {
            setErrorMsg("マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。");
        }
    }, [currentPage, startNewRecording, startTimer]);

    // 「録音終了」クリック
    const handleStop = useCallback(() => {
        stopTimer();
        const page = recordingPageRef.current; // 現在録音中だったページ
        const mr = mediaRecorderRef.current;
        if (!mr || mr.state === "inactive") {
            setRecordingState("done");
            return;
        }

        mr.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        mr.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
            chunksRef.current = [];
            setSlideAudios((prev) => {
                const updated = [...prev, { page, blob }];
                return updated;
            });
            // ストリームを解放
            mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
            mediaStreamRef.current = null;
            mediaRecorderRef.current = null;
            setRecordingState("done");
        };
        mr.stop();
    }, [stopTimer]);

    // 「AIにフィードバックを依頼する」クリック
    const handleFeedback = useCallback(() => {
        onFeedbackReady(slideAudios);
    }, [onFeedbackReady, slideAudios]);

    // currentPage が変わったら区切りを入れる（録音中のみ）
    useEffect(() => {
        if (recordingState !== "recording") return;

        const stream = mediaStreamRef.current;
        if (!stream) return;

        // この時点で recordingPageRef には「前のページ」が入っている
        const pageJustFinished = recordingPageRef.current;
        // 次のページを記録してから前のページの録音を止める
        recordingPageRef.current = currentPage;
        stopCurrentRecording(pageJustFinished, () => {
            startNewRecording(stream);
            startTimer();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage]);

    // アンマウント時にクリーンアップ
    useEffect(() => {
        return () => {
            stopTimer();
            mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        };
    }, [stopTimer]);

    // ---- UI ----
    return (
        <div className="border border-gray-700 rounded-lg p-3 bg-gray-900 text-white font-mono text-sm select-none">
            {recordingState === "idle" && (
                <div className="flex flex-col gap-2">
                    {errorMsg && (
                        <p className="text-red-400 text-xs">{errorMsg}</p>
                    )}
                    <button
                        onClick={handleStart}
                        disabled={totalPages === 0}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-md text-sm font-semibold transition-colors duration-150"
                    >
                        <span className="text-base leading-none">⏺</span>
                        録音開始
                    </button>
                    {totalPages === 0 && (
                        <p className="text-gray-400 text-xs text-center">
                            スライドをアップロードしてから録音できます
                        </p>
                    )}
                </div>
            )}

            {recordingState === "recording" && (
                <div className="flex flex-col gap-2">
                    {/* REC インジケーター */}
                    <div className="flex items-center gap-2">
                        <span className="animate-pulse text-red-500 text-base leading-none">●</span>
                        <span className="text-red-400 font-bold">REC</span>
                        <span className="text-gray-300">
                            スライド {currentPage}
                            {totalPages > 0 ? `/${totalPages}` : ""}
                        </span>
                    </div>
                    {/* タイマー + 録音終了ボタン */}
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-200 tabular-nums">{formatTime(pageElapsed)}</span>
                        <button
                            onClick={handleStop}
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-xs font-semibold transition-colors duration-150 border border-gray-600"
                        >
                            録音終了
                        </button>
                    </div>
                </div>
            )}

            {recordingState === "done" && (
                <div className="flex flex-col gap-2">
                    <p className="text-green-400 text-xs">
                        ✓ 録音完了（{slideAudios.length} ページ分）
                    </p>
                    <button
                        onClick={handleFeedback}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-semibold transition-colors duration-150"
                    >
                        AIにフィードバックを依頼する
                    </button>
                </div>
            )}
        </div>
    );
}
