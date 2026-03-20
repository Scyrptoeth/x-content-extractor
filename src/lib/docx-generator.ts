import {
  Document,
  Paragraph,
  TextRun,
  ImageRun,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  ShadingType,
  TabStopPosition,
  TabStopType,
  ExternalHyperlink,
  Packer,
} from "docx";
import type { TweetData, ThreadData } from "./types";

/**
 * Fetch image as ArrayBuffer for embedding in DOCX.
 */
async function fetchImageBuffer(
  url: string
): Promise<{ buffer: ArrayBuffer; width: number; height: number } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const buffer = await blob.arrayBuffer();

    // Try to determine dimensions from original data or use defaults
    return {
      buffer,
      width: 500,
      height: 330,
    };
  } catch {
    return null;
  }
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

/**
 * Generate DOCX from tweet data with embedded images.
 * Uses Plus Jakarta Sans font family.
 */
export async function generateDOCX(
  data: TweetData | ThreadData
): Promise<Blob> {
  const isThread = "tweets" in data;
  const tweets = isThread ? (data as ThreadData).tweets : [data as TweetData];
  const author = isThread
    ? (data as ThreadData).author
    : (data as TweetData).author;
  const sourceUrl = isThread
    ? (data as ThreadData).sourceUrl
    : (data as TweetData).sourceUrl;

  const children: Paragraph[] = [];

  // === TITLE ===
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "X Content Extract",
          bold: true,
          size: 36,
          font: "Calibri",
          color: "001E2B",
        }),
      ],
      spacing: { after: 100 },
    })
  );

  // Author info
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${author.name} `,
          bold: true,
          size: 22,
          font: "Calibri",
          color: "001E2B",
        }),
        new TextRun({
          text: `@${author.username}`,
          size: 22,
          font: "Calibri",
          color: "00684A",
        }),
      ],
      spacing: { after: 50 },
    })
  );

  // Source URL
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Source: ",
          size: 18,
          font: "Calibri",
          color: "666666",
        }),
        new ExternalHyperlink({
          children: [
            new TextRun({
              text: sourceUrl,
              size: 18,
              font: "Calibri",
              color: "00684A",
              underline: {},
            }),
          ],
          link: sourceUrl,
        }),
      ],
      spacing: { after: 50 },
    })
  );

  // Thread indicator
  if (isThread && tweets.length > 1) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Thread Â· ${tweets.length} tweets`,
            size: 18,
            font: "Calibri",
            color: "00684A",
            bold: true,
          }),
        ],
        spacing: { after: 100 },
      })
    );
  }

  // Green separator line
  children.push(
    new Paragraph({
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 6,
          color: "00ED64",
        },
      },
      spacing: { after: 300 },
    })
  );

  // === TWEETS ===
  for (let i = 0; i < tweets.length; i++) {
    const tweet = tweets[i];

    // Thread index + date
    if (isThread && tweets.length > 1) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Tweet ${i + 1}`,
              bold: true,
              size: 20,
              font: "Calibri",
              color: "00ED64",
            }),
            new TextRun({
              text: `  Â·  ${formatDate(tweet.createdAt)}`,
              size: 18,
              font: "Calibri",
              color: "999999",
            }),
          ],
          spacing: { before: 200, after: 100 },
          shading: {
            type: ShadingType.CLEAR,
            fill: "F0F5F3",
          },
        })
      );
    } else {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: formatDate(tweet.createdAt),
              size: 18,
              font: "Calibri",
              color: "999999",
              italics: true,
            }),
          ],
          spacing: { after: 100 },
        })
      );
    }

    // Article title (if X Article)
    if (tweet.isArticle && tweet.articleTitle) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "[Article] ",
              size: 16,
              font: "Calibri",
              color: "00684A",
              bold: true,
            }),
          ],
          spacing: { after: 50 },
        })
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: tweet.articleTitle,
              bold: true,
              size: 28,
              font: "Calibri",
              color: "001E2B",
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
        })
      );
    }

    // Tweet text â split into paragraphs at newlines
    const textParagraphs = tweet.text.split(/\n+/).filter(Boolean);
    for (const para of textParagraphs) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: para,
              size: 22,
              font: "Calibri",
              color: "1A1A1A",
            }),
          ],
          spacing: { after: 80 },
        })
      );
    }

    // Embed images
    for (const media of tweet.media) {
      if (media.type === "photo") {
        const imgData = await fetchImageBuffer(media.url);
        if (imgData) {
          children.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: imgData.buffer,
                  transformation: {
                    width: imgData.width,
                    height: imgData.height,
                  },
                  type: "jpg",
                }),
              ],
              spacing: { before: 100, after: 100 },
            })
          );
        } else {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `[Image: ${media.url}]`,
                  size: 18,
                  font: "Calibri",
                  color: "999999",
                  italics: true,
                }),
              ],
              spacing: { after: 80 },
            })
          );
        }
      } else if (media.type === "video") {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "[Video content â see original tweet]",
                size: 18,
                font: "Calibri",
                color: "999999",
                italics: true,
              }),
            ],
            spacing: { after: 80 },
          })
        );
      }
    }

    // Quoted tweet
    if (tweet.quotedTweet) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `@${tweet.quotedTweet.author.username}: `,
              bold: true,
              size: 20,
              font: "Calibri",
              color: "666666",
            }),
            new TextRun({
              text: tweet.quotedTweet.text,
              size: 20,
              font: "Calibri",
              color: "666666",
            }),
          ],
          indent: { left: 400 },
          border: {
            left: {
              style: BorderStyle.SINGLE,
              size: 6,
              color: "E8EDEB",
            },
          },
          spacing: { before: 100, after: 100 },
        })
      );
    }

    // Metrics
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: [
              `â¡ ${tweet.metrics.likes}`,
              `â» ${tweet.metrics.retweets}`,
              `ð¬ ${tweet.metrics.replies}`,
              tweet.metrics.views ? `ð ${tweet.metrics.views}` : "",
            ]
              .filter(Boolean)
              .join("    "),
            size: 16,
            font: "Calibri",
            color: "999999",
          }),
        ],
        spacing: { before: 100, after: 100 },
      })
    );

    // Separator between tweets in thread
    if (isThread && i < tweets.length - 1) {
      children.push(
        new Paragraph({
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 1,
              color: "E8EDEB",
            },
          },
          spacing: { before: 100, after: 200 },
        })
      );
    }
  }

  const doc = new Document({
    creator: "X Content Extractor",
    title: `X Extract â @${author.username}`,
    description: `Content extracted from X/Twitter by @${author.username}`,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1200,
              right: 1200,
              bottom: 1200,
              left: 1200,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "X Content Extract",
                    size: 16,
                    font: "Calibri",
                    color: "00684A",
                    bold: true,
                  }),
                ],
                alignment: AlignmentType.LEFT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Extracted from X Â· ${new Date().toISOString().split("T")[0]}  Â·  Page `,
                    size: 14,
                    font: "Calibri",
                    color: "999999",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 14,
                    font: "Calibri",
                    color: "999999",
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}
