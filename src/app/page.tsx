"use client";

import { useState } from "react";
import TweetInput from "@/components/TweetInput";
import TweetPreview from "@/components/TweetPreview";
import ExportButtons from "@/components/ExportButtons";
import type { TweetData, ThreadData } from "@/lib/types";

export default function Home() {
  const [tweet, setTweet] = useState<TweetData | null>(null);
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async (urls: string[], mode: "single" | "thread") => {
    setIsLoading(true);
    setError(null);
    setTweet(null);
    setThread(null);

    try {
      if (mode === "thread") {
        const res = await fetch("/api/fetch-thread", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch thread");
        }

        setThread(data.thread);
      } else {
        const res = await fetch("/api/fetch-tweet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: urls[0] }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch tweet");
        }

        setTweet(data.tweet);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8 sm:py-16">
      {/* Header */}
      <div className="w-full max-w-2xl text-center mb-10 animate-fade-in-up">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-mongo-green/10 border border-mongo-green/20 mb-6">
          <svg className="w-8 h-8 text-mongo-green" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
          X Content Extractor
        </h1>
        <p className="text-mongo-mist/60 text-base sm:text-lg max-w-md mx-auto leading-relaxed">
          Paste a link to any X tweet or thread. Get a clean PDF or DOCX document ready for Claude.
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-2xl">
        <div className="bg-mongo-ink/80 backdrop-blur-sm border border-mongo-mist/10 rounded-2xl p-6 sm:p-8 space-y-8 shadow-2xl shadow-mongo-green/5">
          {/* Input */}
          <TweetInput onFetch={handleFetch} isLoading={isLoading} />

          {/* Error */}
          {error && (
            <div className="animate-fade-in-up bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-red-400 font-medium text-sm">Failed to extract content</p>
                <p className="text-red-400/70 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Preview */}
          <TweetPreview tweet={tweet} thread={thread} />

          {/* Export */}
          <ExportButtons tweet={tweet} thread={thread} />
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-center text-mongo-mist/30 text-sm">
        <p>
          Built for extracting X content into documents that Claude can process.
        </p>
        <p className="mt-1">
          Uses FXTwitter API · No authentication required
        </p>
      </footer>
    </main>
  );
}
