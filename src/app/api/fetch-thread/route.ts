import { NextRequest, NextResponse } from "next/server";
import { parseTweetUrl } from "@/lib/tweet-parser";
import type { TweetData, TweetMedia, ThreadData } from "@/lib/types";

/**
 * Fetch thread data from multiple tweet URLs.
 * Each URL is fetched individually via FXTwitter API, then combined
 * into a single ThreadData sorted by creation time.
 *
 * Accepts: { urls: string[] }
 */

// -- Draft.js article content parser (shared with fetch-tweet route) --

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

interface DraftEntityValue {
  data?: {
    caption?: string;
    mediaItems?: Array<{
      mediaId: string;
      localMediaId?: string;
      mediaCategory?: string;
    }>;
  };
  type?: string;
  mutability?: string;
}

interface DraftContent {
  blocks: DraftBlock[];
  entityMap:
    | Array<{ key: string; value: DraftEntityValue }>
    | Record<string, DraftEntityValue>;
}

interface FxArticleMediaEntity {
  media_id: string;
  media_info?: {
    __typename?: string;
    original_img_url?: string;
    original_img_height?: number;
    original_img_width?: number;
  };
}

interface FxArticle {
  title?: string;
  preview_text?: string;
  content?: DraftContent;
  cover_media?: {
    media_id?: string;
    media_info?: {
      original_img_url?: string;
      original_img_height?: number;
      original_img_width?: number;
    };
  };
  media_entities?: FxArticleMediaEntity[];
  created_at?: string;
  modified_at?: string;
}

interface ParsedArticleContent {
  text: string;
  images: TweetMedia[];
}

function parseArticleContent(article: FxArticle): ParsedArticleContent {
  const parts: string[] = [];
  const images: TweetMedia[] = [];
  const seenUrls = new Set<string>();
  let currentList: string[] = [];
  let orderedIndex = 0;
  let imageIndex = 0;

  const mediaMap = new Map<string, FxArticleMediaEntity>();
  if (article.media_entities) {
    for (const me of article.media_entities) {
      mediaMap.set(me.media_id, me);
    }
  }

  const entityLookup = new Map<string, DraftEntityValue>();
  if (article.content?.entityMap) {
    if (Array.isArray(article.content.entityMap)) {
      for (const entry of article.content.entityMap) {
        entityLookup.set(String(entry.key), entry.value);
      }
    } else {
      for (const [key, value] of Object.entries(article.content.entityMap)) {
        entityLookup.set(key, value as DraftEntityValue);
      }
    }
  }

  if (article.cover_media?.media_info?.original_img_url) {
    const url = article.cover_media.media_info.original_img_url;
    images.push({
      type: "photo",
      url,
      width: article.cover_media.media_info.original_img_width || 0,
      height: article.cover_media.media_info.original_img_height || 0,
    });
    seenUrls.add(url);
    parts.push(`{{IMG:${imageIndex}}}`);
    imageIndex++;
  }

  function flushList() {
    if (currentList.length > 0) {
      parts.push(currentList.join("\n"));
      currentList = [];
    }
  }

  if (article.content?.blocks) {
    for (const block of article.content.blocks) {
      switch (block.type) {
        case "header-one":
          flushList();
          orderedIndex = 0;
          parts.push(`# ${block.text}`);
          break;
        case "header-two":
          flushList();
          orderedIndex = 0;
          parts.push(`## ${block.text}`);
          break;
        case "header-three":
          flushList();
          orderedIndex = 0;
          parts.push(`### ${block.text}`);
          break;
        case "blockquote":
          flushList();
          orderedIndex = 0;
          parts.push(`> ${block.text}`);
          break;
        case "unordered-list-item":
          orderedIndex = 0;
          currentList.push(`- ${block.text}`);
          break;
        case "ordered-list-item":
          orderedIndex++;
          currentList.push(`${orderedIndex}. ${block.text}`);
          break;
        case "atomic": {
          flushList();
          orderedIndex = 0;
          const entityKey = block.entityRanges?.[0]?.key;
          if (entityKey !== undefined) {
            const entity = entityLookup.get(String(entityKey));
            if (entity?.type === "MEDIA" && entity.data?.mediaItems) {
              for (const item of entity.data.mediaItems) {
                const mediaEntity = mediaMap.get(item.mediaId);
                if (mediaEntity?.media_info?.original_img_url) {
                  const url = mediaEntity.media_info.original_img_url;
                  if (!seenUrls.has(url)) {
                    images.push({
                      type: "photo",
                      url,
                      width: mediaEntity.media_info.original_img_width || 0,
                      height: mediaEntity.media_info.original_img_height || 0,
                    });
                    seenUrls.add(url);
                    parts.push(`{{IMG:${imageIndex}}}`);
                    imageIndex++;
                  }
                }
              }
            }
          }
          break;
        }
        default:
          flushList();
          orderedIndex = 0;
          if (block.text.trim()) {
            parts.push(block.text);
          }
          break;
      }
    }
    flushList();
  }

  return {
    text: parts.join("\n\n").trim(),
    images,
  };
}

// -- FXTwitter API types --

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
  replying_to?: string;
}

// -- Fetch single tweet via FXTwitter --

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

  let text = raw.text || "";
  let isArticle = false;
  let articleTitle: string | undefined;

  if (raw.article?.content?.blocks) {
    isArticle = true;
    articleTitle = raw.article.title;

    const parsed = parseArticleContent(raw.article);
    text = parsed.text;

    if (!text && raw.article.preview_text) {
      text = raw.article.preview_text;
    }

    media.push(...parsed.images);
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
    isThread: true,
  };
}

/**
 * Fetch all tweets from multiple URLs, sort by creation date, return as ThreadData.
 */
async function fetchThreadFromUrls(urls: string[]): Promise<ThreadData> {
  // Parse all URLs and extract tweet IDs
  const parsedUrls = urls
    .map((u) => ({ url: u, parsed: parseTweetUrl(u) }))
    .filter((x) => x.parsed !== null) as Array<{
    url: string;
    parsed: { tweetId: string; username: string };
  }>;

  if (parsedUrls.length === 0) {
    throw new Error("No valid X/Twitter URLs provided");
  }

  // Deduplicate by tweet ID
  const seen = new Set<string>();
  const uniqueUrls = parsedUrls.filter((x) => {
    if (seen.has(x.parsed.tweetId)) return false;
    seen.add(x.parsed.tweetId);
    return true;
  });

  // Fetch all tweets in parallel via FXTwitter
  const results = await Promise.allSettled(
    uniqueUrls.map(async (x) => {
      const tweet = await fetchFromFxTwitter(x.parsed.tweetId);
      if (!tweet) {
        throw new Error(`Failed to fetch tweet ${x.parsed.tweetId}`);
      }
      tweet.sourceUrl = x.url;
      tweet.isThread = true;
      return tweet;
    })
  );

  // Collect successful fetches
  const tweets: TweetData[] = [];
  const errors: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      tweets.push(result.value);
    } else {
      errors.push(
        `Tweet ${uniqueUrls[i].parsed.tweetId}: ${result.reason?.message || "Unknown error"}`
      );
    }
  }

  if (tweets.length === 0) {
    throw new Error(
      `Failed to fetch any tweets. Errors: ${errors.join("; ")}`
    );
  }

  // Sort by creation date (oldest first)
  tweets.sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    // Handle invalid dates by falling back to ID order (smaller ID = older)
    if (isNaN(dateA) && isNaN(dateB)) {
      return BigInt(a.id) < BigInt(b.id) ? -1 : 1;
    }
    if (isNaN(dateA)) return -1;
    if (isNaN(dateB)) return 1;
    return dateA - dateB;
  });

  const author = tweets[0].author;
  const sourceUrl = tweets[0].sourceUrl;

  return {
    tweets,
    author: {
      name: author.name,
      username: author.username,
      profileImageUrl: author.profileImageUrl,
    },
    totalTweets: tweets.length,
    sourceUrl,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urls } = body as { urls: string[] };

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: "At least one URL is required" },
        { status: 400 }
      );
    }

    // Limit to prevent abuse
    if (urls.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 tweet URLs per request" },
        { status: 400 }
      );
    }

    const threadData = await fetchThreadFromUrls(urls);

    return NextResponse.json({ thread: threadData });
  } catch (error) {
    console.error("Failed to fetch thread:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch thread data",
      },
      { status: 500 }
    );
  }
}
