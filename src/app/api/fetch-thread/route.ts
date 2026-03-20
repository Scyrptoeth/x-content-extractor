import { NextRequest, NextResponse } from "next/server";
import { parseTweetUrl } from "@/lib/tweet-parser";
import type { TweetData, TweetMedia, ThreadData } from "@/lib/types";

/**
 * Fetch tweet data using Twitter's Syndication API.
 */
async function fetchTweet(tweetId: string): Promise<Record<string, unknown>> {
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=0`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`Syndication API returned ${res.status} for tweet ${tweetId}`);
  }

  return res.json();
}

function transformTweet(
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
    },
    sourceUrl,
    isThread: true,
  };
}

/**
 * Attempt to fetch a thread by following the parent chain.
 * The syndication API includes `parent` references for reply chains.
 */
async function fetchThread(
  startTweetId: string,
  sourceUrl: string
): Promise<ThreadData> {
  const tweets: TweetData[] = [];
  const visited = new Set<string>();

  // Fetch the initial tweet
  const initialRaw = await fetchTweet(startTweetId);
  const initialTweet = transformTweet(initialRaw, sourceUrl);
  const threadAuthor = initialTweet.author;

  // Walk up the parent chain to find the thread start
  const parentChain: Record<string, unknown>[] = [];
  let current = initialRaw;

  while (current.parent && !visited.has(current.id_str as string)) {
    visited.add(current.id_str as string);
    const parent = current.parent as Record<string, unknown>;
    const parentUser = parent.user as Record<string, unknown> | undefined;

    // Only follow if same author (a thread is self-replies)
    if (
      parentUser &&
      (parentUser.screen_name as string)?.toLowerCase() ===
        threadAuthor.username.toLowerCase()
    ) {
      parentChain.unshift(parent);
      // Try to fetch full data for this parent
      try {
        const fullParent = await fetchTweet(parent.id_str as string);
        current = fullParent;
        parentChain[0] = fullParent;
      } catch {
        break;
      }
    } else {
      break;
    }
  }

  // Build the thread from parents (oldest first) + initial tweet
  for (const p of parentChain) {
    const pUser = p.user as Record<string, unknown> | undefined;
    if (
      pUser &&
      (pUser.screen_name as string)?.toLowerCase() ===
        threadAuthor.username.toLowerCase()
    ) {
      tweets.push(
        transformTweet(
          p,
          `https://x.com/${threadAuthor.username}/status/${p.id_str}`
        )
      );
    }
  }

  // Add the initial tweet if not already in the chain
  if (!tweets.some((t) => t.id === initialTweet.id)) {
    tweets.push(initialTweet);
  }

  // Now walk forward: check if the initial tweet has self-replies (children)
  // The syndication API doesn't directly give children, so this is best-effort
  // For MVP, we rely on the parent chain which covers most thread cases

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
