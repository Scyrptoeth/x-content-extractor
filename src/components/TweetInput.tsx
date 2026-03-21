"use client";

import { useState, useRef, useEffect } from "react";

interface TweetInputProps {
  onFetch: (urls: string[], mode: "single" | "thread") => void;
  isLoading: boolean;
}

const URL_PATTERN = /(?:twitter\.com|x\.com)\/\w+\/status\/\d+/;

function isValidUrl(url: string): boolean {
  return URL_PATTERN.test(url.trim());
}

export default function TweetInput({ onFetch, isLoading }: TweetInputProps) {
  const [mode, setMode] = useState<"single" | "thread">("single");
  const [urls, setUrls] = useState<string[]>([""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // When switching to single mode, keep only the first URL
  useEffect(() => {
    if (mode === "single" && urls.length > 1) {
      setUrls([urls[0]]);
    }
  }, [mode]);

  const updateUrl = (index: number, value: string) => {
    const next = [...urls];
    next[index] = value;
    setUrls(next);
  };

  const addUrl = () => {
    setUrls((prev) => [...prev, ""]);
    // Focus the new input after render
    setTimeout(() => {
      const lastIdx = urls.length; // will be the new index after state update
      inputRefs.current[lastIdx]?.focus();
    }, 50);
  };

  const removeUrl = (index: number) => {
    if (urls.length <= 1) return;
    setUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const validUrls = urls.filter((u) => isValidUrl(u));
  const canSubmit =
    !isLoading &&
    (mode === "single" ? isValidUrl(urls[0]) : validUrls.length >= 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    if (mode === "single") {
      onFetch([urls[0].trim()], "single");
    } else {
      onFetch(
        validUrls.map((u) => u.trim()),
        "thread"
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-5">
      {/* URL Input(s) */}
      <div className="space-y-3">
        {urls.map((url, index) => (
          <div key={index} className="relative flex items-center gap-2">
            {/* Thread number badge */}
            {mode === "thread" && (
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-mongo-green/15 border border-mongo-green/30 flex items-center justify-center text-mongo-green text-xs font-bold">
                {index + 1}
              </span>
            )}

            <div className="relative flex-1">
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
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                value={url}
                onChange={(e) => updateUrl(index, e.target.value)}
                placeholder={
                  mode === "thread" && index > 0
                    ? `Paste tweet #${index + 1} URL from the thread...`
                    : "Paste X/Twitter link here... (e.g. https://x.com/user/status/123456)"
                }
                className="w-full pl-12 pr-20 py-4 bg-mongo-slate/80 border border-mongo-mist/10 rounded-xl
                  text-white placeholder:text-mongo-mist/40 font-sans text-[15px]
                  focus:outline-none focus:ring-2 focus:ring-mongo-green/50 focus:border-mongo-green/30
                  transition-all duration-200"
                disabled={isLoading}
              />
              {/* Validation + remove button */}
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-2">
                {url && (
                  <>
                    {isValidUrl(url) ? (
                      <span className="text-mongo-green text-sm font-medium flex items-center gap-1">
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
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
                  </>
                )}
                {mode === "thread" && urls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeUrl(index)}
                    className="p-1 rounded-md text-mongo-mist/40 hover:text-red-400 hover:bg-red-400/10 transition-all"
                    title="Remove this URL"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Add more URLs button (thread mode only) */}
        {mode === "thread" && (
          <button
            type="button"
            onClick={addUrl}
            disabled={isLoading}
            className="w-full py-3 border-2 border-dashed border-mongo-mist/15 rounded-xl
              text-mongo-mist/50 text-sm font-medium
              hover:border-mongo-green/30 hover:text-mongo-green/70 hover:bg-mongo-green/5
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-200 flex items-center justify-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add another tweet from this thread
          </button>
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
        {mode === "thread" && validUrls.length > 0 && (
          <span className="text-mongo-green/70 text-sm">
            {validUrls.length} tweet{validUrls.length !== 1 ? "s" : ""} ready
          </span>
        )}
      </div>

      {/* Thread mode helper text */}
      {mode === "thread" && (
        <p className="text-mongo-mist/40 text-xs leading-relaxed">
          Paste each tweet URL from the thread in order. The app will fetch all
          tweets and combine them into a single document sorted by posting time.
        </p>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!canSubmit}
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
            {mode === "thread"
              ? `Extracting ${validUrls.length} tweet${validUrls.length !== 1 ? "s" : ""}...`
              : "Extracting content..."}
          </>
        ) : (
          <>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
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
