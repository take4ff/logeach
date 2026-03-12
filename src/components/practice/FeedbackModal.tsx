"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Award } from "lucide-react";

export interface SlideFeedback {
  page: number;
  score: number;
  goodPoints: string[];
  improvementPoints: string[];
  comment: string;
}

export interface FeedbackData {
  totalScore: number;
  overallAdvice: string;
  slideFeedbacks: SlideFeedback[];
}

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  data: FeedbackData | null;
}

export default function FeedbackModal({ isOpen, onClose, isLoading, data }: FeedbackModalProps) {
  const [openAccordion, setOpenAccordion] = useState<number | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
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
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-lg font-medium text-muted-foreground animate-pulse">
                AIが発表を分析中...
              </p>
            </div>
          ) : data ? (
            <>
              {/* 総合評価スコア */}
              <div className="flex flex-col items-center justify-center p-8 bg-primary/5 rounded-3xl border border-primary/10">
                <span className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Total Score</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-7xl font-black text-primary">{data.totalScore}</span>
                  <span className="text-2xl font-semibold text-muted-foreground">/ 100</span>
                </div>
              </div>

              {/* スライド別フィードバック */}
              <div className="space-y-3">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <span className="w-1 h-6 bg-primary rounded-full"></span>
                  スライド別フィードバック
                </h3>
                {data.slideFeedbacks.map((fb) => (
                  <div 
                    key={fb.page} 
                    className="border border-border rounded-xl overflow-hidden bg-card hover:border-primary/30 transition-colors"
                  >
                    <button
                      onClick={() => setOpenAccordion(openAccordion === fb.page ? null : fb.page)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted font-bold text-sm">
                          {fb.page}
                        </span>
                        <span className="font-semibold text-base">スライド {fb.page}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-bold text-primary px-2 py-1 bg-primary/10 rounded-md">
                          Score: {fb.score}
                        </span>
                        {openAccordion === fb.page ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </button>
                    
                    {openAccordion === fb.page && (
                      <div className="p-5 border-t border-border bg-muted/20 space-y-4 animate-in slide-in-from-top-2 duration-200">
                        {/* 良い点 */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-bold text-green-600 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            論理構成 / 良い点
                          </h4>
                          <ul className="list-disc list-inside text-sm text-foreground/80 pl-2 space-y-1">
                            {fb.goodPoints.map((point, i) => (
                              <li key={i}>{point}</li>
                            ))}
                          </ul>
                        </div>
                        {/* 改善点 */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-bold text-amber-600 flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4" />
                            改善点
                          </h4>
                          <ul className="list-disc list-inside text-sm text-foreground/80 pl-2 space-y-1">
                            {fb.improvementPoints.map((point, i) => (
                              <li key={i}>{point}</li>
                            ))}
                          </ul>
                        </div>
                        {/* 総評 */}
                        <p className="text-xs text-muted-foreground border-t border-border/10 pt-3 italic">
                          {fb.comment}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 全体アドバイス */}
              <div className="p-6 bg-secondary/30 rounded-2xl border border-secondary/50">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  全体アドバイス
                </h3>
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {data.overallAdvice}
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              フィードバックデータが見つかりません。
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-6 border-t border-border bg-muted/10 flex justify-center">
          <button
            onClick={onClose}
            className="px-10 py-3 bg-primary text-white rounded-full font-bold hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
