"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, Upload, FileText, Loader2 } from "lucide-react";
import { uploadSlidePdf } from "@/src/lib/storage";

// react-pdf のワーカーを CDN から読み込む
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const storageKey = (sessionId: string) => `slide_pdf_${sessionId}`;

interface SlideViewerProps {
    /** 練習セッション ID（Supabase Storage のパスに使用） */
    sessionId?: string;
    /** ページが変わったときに呼ばれるコールバック */
    onPageChange?: (newPage: number) => void;
    /** PDF の総ページ数が確定したときに呼ばれるコールバック */
    onNumPagesReady?: (totalPages: number) => void;
    /** PDF の公開 URL が確定したときに呼ばれるコールバック */
    onPdfUrlReady?: (url: string) => void;
    /** PDF のテキスト内容が確定したときに呼ばれるコールバック */
    onTextReady?: (text: string[]) => void;
}

export default function SlideViewer({
    sessionId = "default",
    onPageChange,
    onNumPagesReady,
    onPdfUrlReady,
    onTextReady,
}: SlideViewerProps) {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [pdfFileName, setPdfFileName] = useState<string | null>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [pageRenderHeight, setPageRenderHeight] = useState<number>(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pdfViewportRef = useRef<HTMLDivElement>(null);

    // マウント時に localStorage から復元
    useEffect(() => {
        const stored = localStorage.getItem(storageKey(sessionId));
        if (stored) {
            try {
                const { url, name } = JSON.parse(stored);
                setPdfUrl(url);
                setPdfFileName(name);
                onPdfUrlReady?.(url);
            } catch {
                localStorage.removeItem(storageKey(sessionId));
            }
        }
    }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ファイルを選択・ドロップしたときの共通処理
    const handleFile = useCallback(
        async (file: File) => {
            if (file.type !== "application/pdf") {
                setUploadError("PDFファイルのみアップロードできます。");
                return;
            }
            setUploadError(null);
            setPdfFileName(file.name);
            setCurrentPage(1);

            // ローカルプレビュー用の ObjectURL を生成（アップロード完了前のプレビュー）
            const localUrl = URL.createObjectURL(file);
            setPdfUrl(localUrl);

            // Supabase Storage へアップロードし、公開URLをlocalStorageに保存
            setIsUploading(true);
            try {
                const publicUrl = await uploadSlidePdf(file, sessionId);
                setPdfUrl(publicUrl);
                localStorage.setItem(
                    storageKey(sessionId),
                    JSON.stringify({ url: publicUrl, name: file.name })
                );
                onPdfUrlReady?.(publicUrl);
            } catch (err) {
                console.warn("Supabase upload failed:", err);
                // アップロード失敗はプレビュー表示には影響させない
                setUploadError("クラウド保存に失敗しました（ローカルプレビューは表示されます）。");
            } finally {
                setIsUploading(false);
            }
        },
        [sessionId]
    );

    // ドラッグ＆ドロップ
    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };
    const onDragLeave = () => setIsDragging(false);
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    // ボタン経由のファイル選択
    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    };

    // ページナビゲーション
    const prevPage = () => {
        const next = Math.max(1, currentPage - 1);
        setCurrentPage(next);
        if (next !== currentPage) onPageChange?.(next);
    };
    const nextPage = () => {
        const next = Math.min(numPages, currentPage + 1);
        setCurrentPage(next);
        if (next !== currentPage) onPageChange?.(next);
    };

    // ← / → キーによるページ切り替え
    useEffect(() => {
        if (!pdfUrl) return; // PDF未表示時は無効
        const handleKeyDown = (e: KeyboardEvent) => {
            // テキスト入力中はスキップ
            const tag = (e.target as HTMLElement).tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;
            if (e.key === "ArrowLeft") prevPage();
            if (e.key === "ArrowRight") nextPage();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    // prevPage/nextPage は currentPage/numPages に依存するため deps に含める
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pdfUrl, currentPage, numPages]);

    // PDF表示領域の高さに合わせてページ描画サイズを更新
    useEffect(() => {
        const el = pdfViewportRef.current;
        if (!el) return;

        const updateSize = () => {
            const h = Math.max(120, Math.floor(el.clientHeight - 16));
            setPageRenderHeight(h);
        };

        updateSize();

        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", updateSize);
            return () => window.removeEventListener("resize", updateSize);
        }

        const observer = new ResizeObserver(updateSize);
        observer.observe(el);
        return () => observer.disconnect();
    }, [pdfUrl]);

    // ---- 未アップロード時の UI ----
    if (!pdfUrl) {
        return (
            <div
                className={`h-full flex flex-col items-center justify-center gap-4 transition-colors duration-200 cursor-pointer select-none
                    ${isDragging
                        ? "bg-blue-50 border-2 border-dashed border-blue-400"
                        : "bg-gray-50 border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                    }`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                aria-label="PDFファイルをアップロード"
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={onFileChange}
                />
                <div className={`p-4 rounded-full transition-colors duration-200 ${isDragging ? "bg-blue-100" : "bg-gray-100"}`}>
                    <FileText
                        size={40}
                        className={`transition-colors duration-200 ${isDragging ? "text-blue-500" : "text-gray-400"}`}
                    />
                </div>
                <div className="text-center">
                    <p className={`font-semibold text-sm transition-colors duration-200 ${isDragging ? "text-blue-600" : "text-gray-600"}`}>
                        {isDragging ? "ここにドロップ" : "スライド（PDF）をアップロード"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        ドラッグ＆ドロップ、またはクリックして選択
                    </p>
                </div>
                <button
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:scale-95 transition-all duration-150 shadow-sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                    }}
                >
                    <Upload size={16} />
                    ファイルを選択
                </button>
                {uploadError && (
                    <p className="text-xs text-red-500 max-w-xs text-center px-4">{uploadError}</p>
                )}
            </div>
        );
    }

    // ---- PDF 表示 UI ----
    return (
        <div className="h-full flex flex-col bg-gray-800">
            {/* PDF 表示エリア */}
            <div ref={pdfViewportRef} className="flex-1 overflow-auto flex items-center justify-center p-2">
                <Document
                    file={pdfUrl}
                    onLoadSuccess={async ({ numPages }) => {
                        setNumPages(numPages);
                        setCurrentPage(1);
                        onNumPagesReady?.(numPages);

                        // テキスト抽出
                        try {
                            const loadingTask = pdfjs.getDocument(pdfUrl);
                            const pdf = await loadingTask.promise;
                            const texts: string[] = [];
                            for (let i = 1; i <= numPages; i++) {
                                const page = await pdf.getPage(i);
                                const content = await page.getTextContent();
                                const strings = content.items.map((item: any) => item.str);
                                texts.push(strings.join(" "));
                            }
                            onTextReady?.(texts);
                        } catch (err) {
                            console.error("PDF text extraction failed:", err);
                        }
                    }}
                    loading={
                        <div className="flex flex-col items-center gap-2 text-gray-300">
                            <Loader2 size={28} className="animate-spin" />
                            <span className="text-sm">PDF を読み込み中...</span>
                        </div>
                    }
                    error={
                        <div className="text-red-400 text-sm text-center px-4">
                            PDF の読み込みに失敗しました。
                        </div>
                    }
                >
                    <Page
                        pageNumber={currentPage}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        className="shadow-lg"
                        height={pageRenderHeight || undefined}
                    />
                </Document>
            </div>

            {/* ナビゲーションバー */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-900 text-white">
                {/* 左: ファイル名 + アップロード状態 */}
                <div className="flex items-center gap-2 min-w-0">
                    <FileText size={14} className="text-gray-400 shrink-0" />
                    <span className="text-xs text-gray-300 truncate max-w-[180px]">
                        {pdfFileName ?? ""}
                    </span>
                    {isUploading && (
                        <span className="flex items-center gap-1 text-xs text-blue-400 shrink-0">
                            <Loader2 size={10} className="animate-spin" />
                            保存中...
                        </span>
                    )}
                    {uploadError && !isUploading && (
                        <span className="text-xs text-yellow-400 shrink-0" title={uploadError}>
                            ⚠ 保存失敗
                        </span>
                    )}
                </div>

                {/* 中央: ページナビゲーション */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={prevPage}
                        disabled={currentPage <= 1}
                        aria-label="前のページ"
                        className="p-1.5 rounded-md hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <span className="text-sm font-mono tabular-nums min-w-[70px] text-center">
                        {currentPage} / {numPages || "-"}
                    </span>
                    <button
                        onClick={nextPage}
                        disabled={currentPage >= numPages}
                        aria-label="次のページ"
                        className="p-1.5 rounded-md hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>

                {/* 右: 差し替えボタン */}
                <div>
                    <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        id="slide-replace-input"
                        onChange={onFileChange}
                    />
                    <label
                        htmlFor="slide-replace-input"
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-white cursor-pointer transition-colors duration-150"
                    >
                        <Upload size={13} />
                        差し替え
                    </label>
                </div>
            </div>
        </div>
    );
}
