"use client";

import type { TweetData, TweetMedia, ThreadData } from "@/lib/types";

interface TweetPreviewProps {
  tweet?: TweetData | null;
  thread?: ThreadData | null;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

/**
 * Render article content with inline images at their original positions.
 * Text contains {{IMG:N}} markers that map to media[N].
 */
function renderArticleContent(text: string, media: TweetMedia[]) {
  const segments = text.split(/(\{\{IMG:\d+\}\})/);
  return segments.map((segment, i) => {
    const match = segment.match(/\{\{IMG:(\d+)\}\}/);
    if (match) {
      const imgIndex = parseInt(match[1]);
      const img = media[imgIndex];
      if (img && img.type === "photo") {
        return (
          <div key={`img-${i}`} className="rounded-lg overflow-hidden border border-mongo-mist/10 my-1">
            <img
              src={img.url}
              alt={`Article image ${imgIndex + 1}`}
              className="w-full h-auto"
            />
          </div>
        );
      }
      return null;
    }
    const trimmed = segment.trim();
    if (trimmed) {
      return (
        <p key={`text-${i}`} className="text-white/90 text-[15px] leading-relaxed whitespace-pre-wrap">
          {trimmed}
        </p>
      );
    }
    return null;
  });
}

function SingleTweetCard({ tweet, index }: { tweet: TweetData; index?: number }) {
  const isInlineArticle = tweet.isArticle && tweet.text.includes("{{IMG:");

  return (
    <div className="bg-mongo-slate/50 rounded-xl border border-mongo-mist/10 p-5 space-y-4">
      {/* Author Row */}
      <div className="flex items-center gap-3">
        {tweet.author.profileImageUrl && (
          <img
            src={tweet.author.profileImageUrl}
            alt={tweet.author.name}
            className="w-10 h-10 rounded-full border-2 border-mongo-green/30"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {index !== undefined && (
              <span className="text-mongo-green font-mono text-xs mr-1">
                #{index + 1}
              </span>
            )}
            <span className="font-semibold text-white truncate">
              {tweet.author.name}
            </span>
            {tweet.author.verified && (
              <svg className="w-4 h-4 text-mongo-green flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <span className="text-mongo-mist/50 text-sm">@{tweet.author.username}</span>
        </div>
        <span className="text-mongo-mist/40 text-xs flex-shrink-0">
          {formatDate(tweet.createdAt)}
        </span>
      </div>

      {/* Article Title */}
      {tweet.isArticle && tweet.articleTitle && (
        <div className="space-y-2">
          <span className="inline-block text-xs font-medium px-2 py-0.5 rounded bg-mongo-green/20 text-mongo-green">
            Article
          </span>
          <h3 className="text-white font-bold text-lg leading-snug">
            {tweet.articleTitle}
          </h3>
        </div>
      )}

      {/* Tweet Text â with inline images for articles */}
      {isInlineArticle ? (
        <div className="space-y-4">
          {renderArticleContent(tweet.text, tweet.media)}
        </div>
      ) : (
        <p className="text-white/90 text-[15px] leading-relaxed whitespace-pre-wrap">
          {tweet.text}
        </p>
      )}

      {/* Media grid â only for non-article tweets (articles render inline) */}
      {!isInlineArticle && tweet.media.length > 0 && (
        <div className="grid gap-2" style={{
          gridTemplateColumns: tweet.media.length === 1 ? "1fr" : "1fr 1fr",
        }}>
          {tweet.media.map((m, i) => (
            <div key={i} className="rounded-lg overflow-hidden border border-mongo-mist/10">
              {m.type === "photo" ? (
                <img
                  src={m.url}
                  alt={m.altText || `Image ${i + 1}`}
                  className="w-full h-auto object-cover max-h-72"
                />
              ) : (
                <div className="bg-mongo-ink/50 p-4 flex items-center justify-center gap-2 text-mongo-mist/60 text-sm">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Video content
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quoted Tweet */}
      {tweet.quotedTweet && (
        <div className="border border-mongo-mist/10 rounded-lg p-3 bg-mongo-ink/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-sm text-white">
              {tweet.quotedTweet.author.name}
            </span>
            <span className="text-mongo-mist/50 text-xs">
              @{tweet.quotedTweet.author.username}
            </span>
          </div>
          <p className="text-white/70 text-sm leading-relaxed">
            {tweet.quotedTweet.text}
          </p>
        </div>
      )}

      {/* Metrics */}
      <div className="flex items-center gap-5 pt-2 border-t border-mongo-mist/10">
        <span className="text-mongo-mist/50 text-sm flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          {formatNumber(tweet.metrics.likes)}
        </span>
        <span className="text-mongo-mist/50 text-sm flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {formatNumber(tweet.metrics.retweets)}
        </span>
        <span className="text-mongo-mist/50 text-sm flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {formatNumber(tweet.metrics.replies)}
        </span>
        {tweet.metrics.views !== undefined && (
          <span className="text-mongo-mist/50 text-sm flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {formatNumber(tweet.metrics.views)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function TweetPreview({ tweet, thread }: TweetPreviewProps) {
  if (!tweet && !thread) return null;

  return (
    <div className="animate-fade-in-up space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Preview</h2>
        {thread && thread.totalTweets > 1 && (
          <span className="text-mongo-green text-sm font-medium px-3 py-1 bg-mongo-green/10 rounded-full">
            Thread Â· {thread.totalTweets} tweets
          </span>
        )}
      </div>

      {thread ? (
        <div className="space-y-3">
          {thread.tweets.map((t, i) => (
            <SingleTweetCard key={t.id} tweet={t} index={i} />
          ))}
        </div>
      ) : tweet ? (
        <SingleTweetCard tweet={tweet} />
      ) : null}
    </div>
  );
}
"use client";

import type { TweetData, ThreadData } from "@/lib/types";

interface TweetPreviewProps {
  tweet?: TweetData | null;
  thread?: ThreadData | null;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function SingleTweetCard({ tweet, index }: { tweet: TweetData; index?: number }) {
  return (
    <div className="bg-mongo-slate/50 rounded-xl border border-mongo-mist/10 p-5 space-y-4">
      {/* Author Row */}
      <div className="flex items-center gap-3">
        {tweet.author.profileImageUrl && (
          <img
            src={tweet.author.profileImageUrl}
            alt={tweet.author.name}
            className="w-10 h-10 rounded-full border-2 border-mongo-green/30"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {index !== undefined && (
              <span className="text-mongo-green font-mono text-xs mr-1">
                #{index + 1}
              </span>
            )}
            <span className="font-semibold text-white truncate">
              {tweet.author.name}
            </span>
            {tweet.author.verified && (
              <svg className="w-4 h-4 text-mongo-green flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <span className="text-mongo-mist/50 text-sm">@{tweet.author.username}</span>
        </div>
        <span className="text-mongo-mist/40 text-xs flex-shrink-0">
          {formatDate(tweet.createdAt)}
        </span>
      </div>

      {/* Article Title */}
      {tweet.isArticle && tweet.articleTitle && (
        <div className="space-y-2">
          <span className="inline-block text-xs font-medium px-2 py-0.5 rounded bg-mongo-green/20 text-mongo-green">
            Article
          </span>
          <h3 className="text-white font-bold text-lg leading-snug">
            {tweet.articleTitle}
          </h3>
        </div>
      )}

      {/* Tweet Text */}
      <p className="text-white/90 text-[15px] leading-relaxed whitespace-pre-wrap">
        {tweet.text}
      </p>

      {/* Media */}
      {tweet.media.length > 0 && (
        <div className="grid gap-2" style={{
          gridTemplateColumns: tweet.media.length === 1 ? "1fr" : "1fr 1fr",
        }}>
          {tweet.media.map((m, i) => (
            <div key={i} className="rounded-lg overflow-hidden border border-mongo-mist/10">
              {m.type === "photo" ? (
                <img
                  src={m.url}
                  alt={m.altText || `Image ${i + 1}`}
                  className="w-full h-auto object-cover max-h-72"
                />
              ) : (
                <div className="bg-mongo-ink/50 p-4 flex items-center justify-center gap-2 text-mongo-mist/60 text-sm">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Video content
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quoted Tweet */}
      {tweet.quotedTweet && (
        <div className="border border-mongo-mist/10 rounded-lg p-3 bg-mongo-ink/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-sm text-white">
              {tweet.quotedTweet.author.name}
            </span>
            <span className="text-mongo-mist/50 text-xs">
              @{tweet.quotedTweet.author.username}
            </span>
          </div>
          <p className="text-white/70 text-sm leading-relaxed">
            {tweet.quotedTweet.text}
          </p>
        </div>
      )}

      {/* Metrics */}
      <div className="flex items-center gap-5 pt-2 border-t border-mongo-mist/10">
        <span className="text-mongo-mist/50 text-sm flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          {formatNumber(tweet.metrics.likes)}
        </span>
        <span className="text-mongo-mist/50 text-sm flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {formatNumber(tweet.metrics.retweets)}
        </span>
        <span className="text-mongo-mist/50 text-sm flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {formatNumber(tweet.metrics.replies)}
        </span>
        {tweet.metrics.views !== undefined && (
          <span className="text-mongo-mist/50 text-sm flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {formatNumber(tweet.metrics.views)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function TweetPreview({ tweet, thread }: TweetPreviewProps) {
  if (!tweet && !thread) return null;

  return (
    <div className="animate-fade-in-up space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Preview</h2>
        {thread && thread.totalTweets > 1 && (
          <span className="text-mongo-green text-sm font-medium px-3 py-1 bg-mongo-green/10 rounded-full">
            Thread Â· {thread.totalTweets} tweets
          </span>
        )}
      </div>

      {thread ? (
        <div className="space-y-3">
          {thread.tweets.map((t, i) => (
            <SingleTweetCard key={t.id} tweet={t} index={i} />
          ))}
        </div>
      ) : tweet ? (
        <SingleTweetCard tweet={tweet} />
      ) : null}
    </div>
  );
}
