"use client";

import ReactMarkdown from "react-markdown";
import { Award } from "lucide-react";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  feedback: string | null;
  error?: string | null;
}

export default function FeedbackModal({ isOpen, onClose, isLoading, feedback, error }: FeedbackModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={() => { if (!isLoading) onClose(); }}
    >
      <div
        className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-border animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="p-6 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
          <h2 className="text-2xl font-bold text-center flex items-center justify-center gap-2">
            <Award className="w-8 h-8 text-primary" />
            発表フィードバック
          </h2>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-lg font-medium text-muted-foreground animate-pulse">
                AIが発表を分析中...
              </p>
            </div>
          ) : error ? (
            <p className="text-red-500 text-sm whitespace-pre-wrap py-6">{error}</p>
          ) : feedback ? (
            <div className="prose prose-sm max-w-none text-foreground leading-relaxed">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 className="text-xl font-bold mt-6 mb-2">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-lg font-bold mt-5 mb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-base font-bold mt-4 mb-1">{children}</h3>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  hr: () => <hr className="my-4 border-border" />,
                  p: ({ children }) => <p className="mb-3">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 mb-3">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 mb-3">{children}</ol>,
                  li: ({ children }) => <li className="text-sm">{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary/40 pl-4 italic text-muted-foreground my-3">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {feedback}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              フィードバックデータが見つかりません。
            </div>
          )}
        </div>

        {/* フッター */}
        {!isLoading && (
          <div className="p-6 border-t border-border bg-muted/10 flex justify-center">
            <button
              onClick={onClose}
              className="px-10 py-3 bg-primary text-white rounded-full font-bold hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
            >
              閉じる
            </button>
          </div>
        )}
      </div>
    </div>
  );
}