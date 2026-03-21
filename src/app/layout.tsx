import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Content Extractor",
  description:
    "Extract posts and threads from X into clean PDF or DOCX documents",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-xd-black">{children}</body>
    </html>
  );
}
