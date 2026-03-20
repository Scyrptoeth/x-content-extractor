"use client";

import { useState } from "react";
import { saveAs } from "file-saver";
import type { TweetData, ThreadData, ExportFormat } from "@/lib/types";

interface ExportButtonsProps {
  tweet?: TweetData | null;
  thread?: ThreadData | null;
}

export default function ExportButtons({ tweet, thread }: ExportButtonsProps) {
  const [generating, setGenerating] = useState<ExportFormat | null>(null);

  const hasData = !!(tweet || thread);

  const getFilename = (ext: string) => {
    const author = thread
      ? thread.author.username
      : tweet
        ? tweet.author.username
        : "unknown";
    const id = thread
      ? thread.tweets[0]?.id || "thread"
      : tweet
        ? tweet.id
        : "tweet";
    return `x-extract-${author}-${id}.${ext}`;
  };

  const handleExport = async (format: ExportFormat) => {
    if (!hasData || generating) return;

    setGenerating(format);

    try {
      const data = thread || tweet;

      if (format === "pdf") {
        const { generatePDF } = await import("@/lib/pdf-generator");
        const blob = await generatePDF(data!);
        saveAs(blob, getFilename("pdf"));
      } else {
        const { generateDOCX } = await import("@/lib/docx-generator");
        const blob = await generateDOCX(data!);
        saveAs(blob, getFilename("docx"));
      }
    } catch (error) {
      console.error(`Failed to generate ${format}:`, error);
      alert(`Failed to generate ${format.toUpperCase()}. Please try again.`);
    } finally {
      setGenerating(null);
    }
  };

  if (!hasData) return null;

  return (
    <div className="animate-fade-in-up-delay space-y-3">
      <h2 className="text-lg font-semibold text-white">Export</h2>
      <div className="flex gap-3">
        {/* PDF Button */}
        <button
          onClick={() => handleExport("pdf")}
          disabled={!!generating}
          className="flex-1 py-3.5 px-5 bg-mongo-green text-mongo-ink font-semibold rounded-xl
            hover:bg-mongo-green/90 active:scale-[0.98]
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200 flex items-center justify-center gap-2.5"
        >
          {generating === "pdf" ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Download PDF
            </>
          )}
        </button>

        {/* DOCX Button */}
        <button
          onClick={() => handleExport("docx")}
          disabled={!!generating}
          className="flex-1 py-3.5 px-5 bg-mongo-slate border border-mongo-green/40 text-mongo-green
            font-semibold rounded-xl
            hover:bg-mongo-green/10 hover:border-mongo-green/60 active:scale-[0.98]
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200 flex items-center justify-center gap-2.5"
        >
          {generating === "docx" ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download DOCX
            </>
          )}
        </button>
      </div>
    </div>
  );
}
