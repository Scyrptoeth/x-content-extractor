import jsPDF from "jspdf";
import type { TweetData, ThreadData } from "./types";

/**
 * Convert image URL to base64 data URL for embedding in PDF.
 */
async function imageToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
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
 * Generate PDF from tweet data with embedded images.
 * Uses Plus Jakarta Sans-compatible styling via jsPDF.
 */
export async function generatePDF(
  data: TweetData | ThreadData
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const isThread = "tweets" in data;
  const tweets = isThread ? (data as ThreadData).tweets : [data as TweetData];
  const author = isThread
    ? (data as ThreadData).author
    : (data as TweetData).author;

  // === HEADER BAR ===
  doc.setFillColor(0, 30, 43); // #001E2B
  doc.rect(0, 0, pageWidth, 35, "F");

  // Green accent line
  doc.setFillColor(0, 237, 100); // #00ED64
  doc.rect(0, 35, pageWidth, 1.5, "F");

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("X Content Extract", margin, 15);

  // Author info
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(232, 237, 235); // #E8EDEB
  doc.text(`@${author.username} Â· ${author.name}`, margin, 23);

  // Date & source
  doc.setFontSize(8);
  doc.setTextColor(150, 170, 165);
  const sourceUrl = isThread
    ? (data as ThreadData).sourceUrl
    : (data as TweetData).sourceUrl;
  doc.text(`Source: ${sourceUrl}`, margin, 30);

  if (isThread) {
    doc.text(
      `Thread Â· ${(data as ThreadData).totalTweets} tweets`,
      pageWidth - margin - 35,
      30
    );
  }

  y = 42;

  // === TWEET CONTENT ===
  for (let i = 0; i < tweets.length; i++) {
    const tweet = tweets[i];

    // Check if we need a new page
    if (y > pageHeight - 40) {
      doc.addPage();
      y = margin;
    }

    // Thread index marker
    if (isThread && tweets.length > 1) {
      doc.setFillColor(0, 237, 100);
      doc.circle(margin + 3, y + 2, 3, "F");
      doc.setTextColor(0, 30, 43);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(`${i + 1}`, margin + 1.8, y + 3.2);

      doc.setTextColor(150, 170, 165);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(formatDate(tweet.createdAt), margin + 10, y + 3);
      y += 10;
    } else {
      doc.setTextColor(150, 170, 165);
      doc.setFontSize(8);
      doc.text(formatDate(tweet.createdAt), margin, y + 3);
      y += 8;
    }

    // Article title (if X Article)
    if (tweet.isArticle && tweet.articleTitle) {
      doc.setTextColor(0, 104, 74); // #00684A
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("[Article]", margin, y);
      y += 6;

      doc.setTextColor(0, 30, 43);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      const titleLines = doc.splitTextToSize(tweet.articleTitle, contentWidth);
      for (const line of titleLines) {
        if (y > pageHeight - 25) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += 7;
      }
      y += 3;
    }

    // Tweet text
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    const lines = doc.splitTextToSize(tweet.text, contentWidth);
    for (const line of lines) {
      if (y > pageHeight - 25) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 5.5;
    }

    y += 3;

    // Embed images
    for (const media of tweet.media) {
      if (media.type === "photo") {
        const base64 = await imageToBase64(media.url);
        if (base64) {
          const imgWidth = Math.min(contentWidth, 120);
          const aspectRatio = media.height / media.width || 0.66;
          const imgHeight = Math.min(imgWidth * aspectRatio, 80);

          if (y + imgHeight > pageHeight - 25) {
            doc.addPage();
            y = margin;
          }

          try {
            doc.addImage(base64, "JPEG", margin, y, imgWidth, imgHeight);
            y += imgHeight + 5;
          } catch {
            doc.setTextColor(150, 150, 150);
            doc.setFontSize(9);
            doc.text(`[Image: ${media.url}]`, margin, y);
            y += 6;
          }
        }
      } else if (media.type === "video") {
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.text("[Video content â see original tweet]", margin, y);
        y += 6;
      }
    }

    // Quoted tweet
    if (tweet.quotedTweet) {
      if (y > pageHeight - 40) {
        doc.addPage();
        y = margin;
      }

      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin + 5, y, margin + 5, y + 15);

      doc.setTextColor(100, 100, 100);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(
        `@${tweet.quotedTweet.author.username}:`,
        margin + 8,
        y + 4
      );

      doc.setFont("helvetica", "normal");
      const qtLines = doc.splitTextToSize(
        tweet.quotedTweet.text,
        contentWidth - 10
      );
      let qtY = y + 9;
      for (const line of qtLines.slice(0, 4)) {
        doc.text(line, margin + 8, qtY);
        qtY += 4.5;
      }
      y = qtY + 5;
    }

    // Metrics line
    doc.setTextColor(150, 170, 165);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const metricsStr = [
      `â¡ ${tweet.metrics.likes}`,
      `â» ${tweet.metrics.retweets}`,
      `ð¬ ${tweet.metrics.replies}`,
      tweet.metrics.views ? `ð ${tweet.metrics.views}` : "",
    ]
      .filter(Boolean)
      .join("   ");
    doc.text(metricsStr, margin, y);
    y += 5;

    // Separator between tweets in thread
    if (isThread && i < tweets.length - 1) {
      doc.setDrawColor(232, 237, 235);
      doc.setLineWidth(0.2);
      doc.line(margin, y + 2, pageWidth - margin, y + 2);
      y += 8;
    }
  }

  // === FOOTER ===
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(0, 30, 43);
    doc.rect(0, pageHeight - 12, pageWidth, 12, "F");
    doc.setTextColor(150, 170, 165);
    doc.setFontSize(7);
    doc.text(
      `Extracted from X Â· ${new Date().toISOString().split("T")[0]} Â· Page ${p}/${totalPages}`,
      margin,
      pageHeight - 5
    );
    doc.text(
      "Generated by X Content Extractor",
      pageWidth - margin - 45,
      pageHeight - 5
    );
  }

  return doc.output("blob");
}
