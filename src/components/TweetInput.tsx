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
    setTimeout(() => {
      const lastIdx = urls.length;
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
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      {/* URL Input(s) */}
      <div className="space-y-3">
        {urls.map((url, index) => (
          <div key={index} className="relative flex items-center gap-2">
            {/* Thread number badge */}
            {mode === "thread" && (
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-xd-blue/15 border border-xd-blue/30 flex items-center justify-center text-xd-blue text-xs font-bold">
                {index + 1}
              </span>
            )}

            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <svg
                  className="w-[18px] h-[18px] text-xd-text-secondary"
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
                    ? `Paste post #${index + 1} URL from the thread...`
                    : "Paste X post link here..."
                }
                className="w-full pl-11 pr-20 py-3 bg-xd-black border border-xd-border rounded-xl
                  text-xd-text-primary placeholder:text-xd-text-secondary/60 text-[15px]
                  focus:outline-none focus:ring-1 focus:ring-xd-blue focus:border-xd-blue
                  transition-colors duration-150"
                disabled={isLoading}
              />
              {/* Validation + remove button */}
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-2">
                {url && (
                  <>
                    {isValidUrl(url) ? (
                      <span className="text-xd-green text-[13px] font-medium flex items-center gap-1">
                        <svg
                          className="w-3.5 h-3.5"
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
                      <span className="text-xd-red text-[13px]">Invalid</span>
                    )}
                  </>
                )}
                {mode === "thread" && urls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeUrl(index)}
                    className="p-1 rounded-full text-xd-text-secondary hover:text-xd-red hover:bg-xd-red-faded transition-colors"
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
            className="w-full py-2.5 border border-dashed border-xd-border rounded-xl
              text-xd-text-secondary text-[13px] font-medium
              hover:border-xd-blue/40 hover:text-xd-blue hover:bg-xd-blue/5
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors duration-150 flex items-center justify-center gap-2"
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
            Add another post from this thread
          </button>
        )}
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center gap-3">
        <span className="text-xd-text-secondary text-[13px]">Mode:</span>
        <div className="flex bg-xd-black rounded-full p-0.5 border border-xd-border">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors duration-150 ${
              mode === "single"
                ? "bg-xd-blue text-white"
                : "text-xd-text-secondary hover:text-xd-text-primary"
            }`}
          >
            Single Post / Article
          </button>
          <button
            type="button"
            onClick={() => setMode("thread")}
            className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors duration-150 ${
              mode === "thread"
                ? "bg-xd-blue text-white"
                : "text-xd-text-secondary hover:text-xd-text-primary"
            }`}
          >
            Thread
          </button>
        </div>
        {mode === "thread" && validUrls.length > 0 && (
          <span className="text-xd-blue text-[13px]">
            {validUrls.length} post{validUrls.length !== 1 ? "s" : ""} ready
          </span>
        )}
      </div>

      {/* Thread mode helper text */}
      {mode === "thread" && (
        <p className="text-xd-text-secondary/70 text-[13px] leading-relaxed">
          Paste each post URL from the thread. They will be fetched in parallel
          and sorted by posting time.
        </p>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-3 bg-xd-blue text-white font-bold text-[15px] rounded-full
          hover:bg-xd-blue-hover active:scale-[0.98]
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-xd-blue
          transition-all duration-150 flex items-center justify-center gap-2"
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
              ? `Extracting ${validUrls.length} post${validUrls.length !== 1 ? "s" : ""}...`
              : "Extracting..."}
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
