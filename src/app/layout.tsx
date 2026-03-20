import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "X Content Extractor",
  description:
    "Extract tweets and threads from X into PDF or DOCX documents for Claude processing",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>ð</text></svg>",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen gradient-bg">{children}</body>
    </html>
  );
}
