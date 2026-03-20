"use client";

import { useState } from "react";

interface TweetInputProps {
  onFetch: (url: string, mode: "single" | "thread") => void;
  isLoading: boolean;
}

export default function TweetInput({ onFetch, isLoading }: TweetInputProps) {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"single" | "thread">("single");

  const isValidUrl =
    /(?:twitter\.com|x\.com)\/\w+\/status\/\d+/.test(url.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidUrl && !isLoading) {
      onFetch(url.trim(), mode);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-5">
      {/* URL Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg
            className="w-5 h-5 text-mongo-green/60"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </div>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste X/Twitter link here... (e.g. https://x.com/user/status/123456)"
          className="w-full pl-12 pr-4 py-4 bg-mongo-slate/80 border border-mongo-mist/10 rounded-xl
            text-white placeholder:text-mongo-mist/40 font-sans text-[15px]
            focus:outline-none focus:ring-2 focus:ring-mongo-green/50 focus:border-mongo-green/30
            transition-all duration-200"
          disabled={isLoading}
        />
        {url && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
            {isValidUrl ? (
              <span className="text-mongo-green text-sm font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Valid
              </span>
            ) : (
              <span className="text-red-400 text-sm">Invalid URL</span>
            )}
          </div>
        )}
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center gap-3">
        <span className="text-mongo-mist/60 text-sm">Mode:</span>
        <div className="flex bg-mongo-slate/60 rounded-lg p-1 border border-mongo-mist/10">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              mode === "single"
                ? "bg-mongo-green text-mongo-ink"
                : "text-mongo-mist/60 hover:text-white"
            }`}
          >
            Single Tweet
          </button>
          <button
            type="button"
            onClick={() => setMode("thread")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              mode === "thread"
                ? "bg-mongo-green text-mongo-ink"
                : "text-mongo-mist/60 hover:text-white"
            }`}
          >
            Thread
          </button>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!isValidUrl || isLoading}
        className="w-full py-4 bg-mongo-green text-mongo-ink font-semibold text-[15px] rounded-xl
          hover:bg-mongo-green/90 active:scale-[0.99]
          disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-mongo-green
          transition-all duration-200 flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Extracting content...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Extract Content
          </>
        )}
      </button>
    </form>
  );
}
