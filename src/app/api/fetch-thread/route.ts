import { NextRequest, NextResponse } from "next/server";
import { parseTweetUrl } from "@/lib/tweet-parser";
import type { TweetData, TweetMedia, ThreadData } from "@/lib/types";

/**
 * Fetch thread data using FXTwitter API (primary) with Syndication API fallback.
 * FXTwitter returns full text for Note Tweets and article content for X Articles.
 * Syndication API is used for thread structure discovery (parent chain walking).
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
  replying_to?: string;
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

// -- Syndication API (for thread structure discovery) --

async function fetchTweetSyndication(
  tweetId: string
): Promise<Record<string, unknown>> {
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=0`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(
      `Syndication API returned ${res.status} for tweet ${tweetId}`
    );
  }

  return res.json();
}

function transformSyndicationTweet(
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
        media.push({
          type: "video",
          thumbnailUrl: m.media_url_https as string,
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
    sourceUrl,
    isThread: true,
  };
}

/**
 * Fetch a thread by discovering structure via Syndication API (parent chain),
 * then enriching each tweet with FXTwitter data (full text, articles, Note Tweets).
 */
async function fetchThread(
  startTweetId: string,
  sourceUrl: string
): Promise<ThreadData> {
  const tweetIds: string[] = [];
  const visited = new Set<string>();

  // Step 1: Use Syndication API to discover thread structure (parent chain)
  let initialRaw: Record<string, unknown>;
  try {
    initialRaw = await fetchTweetSyndication(startTweetId);
  } catch {
    // If Syndication fails, try FXTwitter for at least the single tweet
    const fxTweet = await fetchFromFxTwitter(startTweetId);
    if (fxTweet) {
      fxTweet.sourceUrl = sourceUrl;
      return {
        tweets: [fxTweet],
        author: fxTweet.author,
        totalTweets: 1,
        sourceUrl,
      };
    }
    throw new Error("Failed to fetch tweet from both APIs");
  }

  const user = initialRaw.user as Record<string, unknown> | undefined;
  const threadAuthorUsername = (
    (user?.screen_name as string) || "unknown"
  ).toLowerCase();

  // Walk up the parent chain to find the thread start
  const parentIds: string[] = [];
  let current = initialRaw;

  while (current.parent && !visited.has(current.id_str as string)) {
    visited.add(current.id_str as string);
    const parent = current.parent as Record<string, unknown>;
    const parentUser = parent.user as Record<string, unknown> | undefined;

    // Only follow if same author (a thread is self-replies)
    if (
      parentUser &&
      (parentUser.screen_name as string)?.toLowerCase() ===
        threadAuthorUsername
    ) {
      parentIds.unshift(parent.id_str as string);
      try {
        const fullParent = await fetchTweetSyndication(
          parent.id_str as string
        );
        current = fullParent;
      } catch {
        break;
      }
    } else {
      break;
    }
  }

  // Build ordered list of tweet IDs: parents first, then the initial tweet
  tweetIds.push(...parentIds);
  if (!tweetIds.includes(startTweetId)) {
    tweetIds.push(startTweetId);
  }

  // Step 2: Enrich each tweet with FXTwitter data (full text, articles)
  const tweets: TweetData[] = [];
  let threadAuthor = {
    name: (user?.name as string) || "Unknown",
    username: (user?.screen_name as string) || "unknown",
    profileImageUrl: (user?.profile_image_url_https as string) || "",
    verified: (user?.is_blue_verified as boolean) || false,
  };

  for (const tweetId of tweetIds) {
    // Try FXTwitter first for rich content
    const fxTweet = await fetchFromFxTwitter(tweetId);
    if (fxTweet) {
      fxTweet.sourceUrl = `https://x.com/${threadAuthorUsername}/status/${tweetId}`;
      fxTweet.isThread = true;
      tweets.push(fxTweet);

      // Use author info from FXTwitter (more reliable)
      if (tweets.length === 1) {
        threadAuthor = { ...fxTweet.author, verified: fxTweet.author.verified || false };
      }
    } else {
      // Fallback: fetch from Syndication and transform
      try {
        const raw = await fetchTweetSyndication(tweetId);
        const tweet = transformSyndicationTweet(
          raw,
          `https://x.com/${threadAuthorUsername}/status/${tweetId}`
        );
        tweets.push(tweet);
      } catch {
        // Skip tweets that fail both APIs
        console.warn(`Failed to fetch tweet ${tweetId} from both APIs`);
      }
    }
  }

  return {
    tweets,
    author: threadAuthor,
    totalTweets: tweets.length,
    sourceUrl,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body as { url: string };

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const parsed = parseTweetUrl(url);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid X/Twitter URL format" },
        { status: 400 }
      );
    }

    const threadData = await fetchThread(parsed.tweetId, url);

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
