import { NextRequest, NextResponse } from "next/server";
import { parseTweetUrl } from "@/lib/tweet-parser";
import type { TweetData, TweetMedia } from "@/lib/types";

/**
 * Fetch tweet data using FXTwitter API (primary) with Syndication API fallback.
 * FXTwitter returns full text for Note Tweets and article content for X Articles.
 */

// -- Draft.js article content parser --

interface DraftBlock {
  text: string;
  type: string;
  data?: Record<string, unknown>;
  entityRanges?: Array<{ offset: number; length: number; key: number }>;
  inlineStyleRanges?: Array<{
    offset: number;
    length: number;
    style: string;
  }>;
}

interface DraftContent {
  blocks: DraftBlock[];
  entityMap: Array<{ key: string; value: Record<string, unknown> }>;
}

interface FxArticle {
  title?: string;
  preview_text?: string;
  content?: DraftContent;
  cover_media?: Record<string, unknown>;
  created_at?: string;
  modified_at?: string;
}

/**
 * Convert Draft.js blocks into readable plain text with basic formatting.
 * Handles: unstyled, headers, blockquotes, list items, and atomic (images).
 */
function parseDraftBlocksToText(content: DraftContent): string {
  const lines: string[] = [];
  let orderedIndex = 0;

  for (const block of content.blocks) {
    switch (block.type) {
      case "header-one":
        lines.push(`\n# ${block.text}\n`);
        orderedIndex = 0;
        break;
      case "header-two":
        lines.push(`\n## ${block.text}\n`);
        orderedIndex = 0;
        break;
      case "header-three":
        lines.push(`\n### ${block.text}\n`);
        orderedIndex = 0;
        break;
      case "blockquote":
        lines.push(`> ${block.text}`);
        orderedIndex = 0;
        break;
      case "unordered-list-item":
        lines.push(`- ${block.text}`);
        orderedIndex = 0;
        break;
      case "ordered-list-item":
        orderedIndex++;
        lines.push(`${orderedIndex}. ${block.text}`);
        break;
      case "atomic":
        // Skip atomic blocks (images) â they appear in media
        orderedIndex = 0;
        break;
      default:
        // "unstyled" and any other type
        if (block.text.trim()) {
          lines.push(block.text);
        } else {
          lines.push(""); // preserve blank lines
        }
        orderedIndex = 0;
        break;
    }
  }

  // Clean up excessive blank lines
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// -- FXTwitter API (primary) --

interface FxAuthor {
  name?: string;
  screen_name?: string;
  avatar_url?: string;
  verified?: boolean;
}

interface FxMedia {
  type?: string;
  url?: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  altText?: string;
  duration?: number;
}

interface FxTweet {
  id?: string;
  text?: string;
  author?: FxAuthor;
  created_at?: string;
  likes?: number;
  retweets?: number;
  replies?: number;
  views?: number;
  media?: { all?: FxMedia[] };
  quote?: FxTweet;
  article?: FxArticle;
}

async function fetchFromFxTwitter(
  tweetId: string
): Promise<TweetData | null> {
  try {
    const res = await fetch(
      `https://api.fxtwitter.com/status/${tweetId}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        next: { revalidate: 300 },
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const tweet = data?.tweet as FxTweet | undefined;
    if (!tweet) return null;

    return transformFxTweet(tweet, tweetId);
  } catch {
    return null;
  }
}

function transformFxTweet(raw: FxTweet, tweetId: string): TweetData {
  const media: TweetMedia[] = [];

  if (raw.media?.all) {
    for (const m of raw.media.all) {
      if (m.type === "photo") {
        media.push({
          type: "photo",
          url: m.url || "",
          width: m.width || 0,
          height: m.height || 0,
          altText: m.altText,
        });
      } else if (m.type === "video" || m.type === "gif") {
        media.push({
          type: "video",
          thumbnailUrl: m.thumbnail_url || m.url || "",
          url: m.url,
          duration: m.duration,
        });
      }
    }
  }

  // Handle X Articles: extract text from Draft.js content
  let text = raw.text || "";
  let isArticle = false;
  let articleTitle: string | undefined;

  if (raw.article?.content?.blocks) {
    isArticle = true;
    articleTitle = raw.article.title;
    text = parseDraftBlocksToText(raw.article.content);

    // If text is still empty, fall back to preview_text
    if (!text && raw.article.preview_text) {
      text = raw.article.preview_text;
    }
  }

  return {
    id: raw.id || tweetId,
    text,
    author: {
      name: raw.author?.name || "Unknown",
      username: raw.author?.screen_name || "unknown",
      profileImageUrl: raw.author?.avatar_url || "",
      verified: raw.author?.verified || false,
    },
    createdAt: raw.created_at || "",
    media,
    metrics: {
      likes: raw.likes || 0,
      retweets: raw.retweets || 0,
      replies: raw.replies || 0,
      views: raw.views,
    },
    quotedTweet: raw.quote
      ? transformFxTweet(raw.quote, raw.quote.id || "")
      : undefined,
    sourceUrl: `https://x.com/i/status/${tweetId}`,
    isArticle,
    articleTitle,
  };
}

// -- Syndication API (fallback) --

async function fetchTweetFromSyndication(
  tweetId: string
): Promise<unknown> {
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=0`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`Syndication API returned ${res.status}`);
  }

  return res.json();
}

function transformSyndicationData(
  raw: Record<string, unknown>,
  sourceUrl: string
): TweetData {
  const user = raw.user as Record<string, unknown> | undefined;
  const mediaDetails = raw.mediaDetails as
    | Array<Record<string, unknown>>
    | undefined;

  const media: TweetMedia[] = [];

  if (mediaDetails) {
    for (const m of mediaDetails) {
      if (m.type === "photo") {
        media.push({
          type: "photo",
          url: m.media_url_https as string,
          width: (m.original_info as Record<string, number>)?.width ?? 0,
          height: (m.original_info as Record<string, number>)?.height ?? 0,
          altText: m.ext_alt_text as string | undefined,
        });
      } else if (m.type === "video" || m.type === "animated_gif") {
        const videoInfo = m.video_info as
          | Record<string, unknown>
          | undefined;
        const variants = videoInfo?.variants as
          | Array<Record<string, unknown>>
          | undefined;
        const bestVariant = variants
          ?.filter((v) => v.content_type === "video/mp4")
          .sort(
            (a, b) =>
              ((b.bitrate as number) || 0) - ((a.bitrate as number) || 0)
          )[0];

        media.push({
          type: "video",
          thumbnailUrl: m.media_url_https as string,
          url: bestVariant?.url as string | undefined,
          duration:
            ((videoInfo?.duration_millis as number) || 0) / 1000 ||
            undefined,
        });
      }
    }
  }

  if (media.length === 0 && raw.photos) {
    const photos = raw.photos as Array<Record<string, unknown>>;
    for (const p of photos) {
      media.push({
        type: "photo",
        url: p.url as string,
        width: (p.width as number) || 0,
        height: (p.height as number) || 0,
      });
    }
  }

  return {
    id: raw.id_str as string,
    text: raw.text as string,
    author: {
      name: (user?.name as string) || "Unknown",
      username: (user?.screen_name as string) || "unknown",
      profileImageUrl: (user?.profile_image_url_https as string) || "",
      verified: (user?.is_blue_verified as boolean) || false,
    },
    createdAt: raw.created_at as string,
    media,
    metrics: {
      likes: (raw.favorite_count as number) || 0,
      retweets: (raw.retweet_count as number) || 0,
      replies: (raw.reply_count as number) || 0,
      views:
        (
          raw.views as
            | { count: string | number | undefined }
            | undefined
        )?.count !== undefined
          ? Number(
              (raw.views as { count: string | number | undefined }).count
            )
          : undefined,
    },
    quotedTweet: raw.quoted_tweet
      ? transformSyndicationData(
          raw.quoted_tweet as Record<string, unknown>,
          sourceUrl
        )
      : undefined,
    sourceUrl,
  };
}

// -- Route handler --

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body as { url: string };

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    const parsed = parseTweetUrl(url);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid X/Twitter URL format" },
        { status: 400 }
      );
    }

    // Try FXTwitter first (full Note Tweet text + Article content)
    const fxResult = await fetchFromFxTwitter(parsed.tweetId);
    if (fxResult) {
      fxResult.sourceUrl = url;
      return NextResponse.json({ tweet: fxResult });
    }

    // Fallback to Syndication API
    const rawData = await fetchTweetFromSyndication(parsed.tweetId);
    const tweetData = transformSyndicationData(
      rawData as Record<string, unknown>,
      url
    );

    return NextResponse.json({ tweet: tweetData });
  } catch (error) {
    console.error("Failed to fetch tweet:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch tweet data",
      },
      { status: 500 }
    );
  }
}
