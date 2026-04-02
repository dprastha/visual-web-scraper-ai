import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI HTML Extractor",
  description: "Generate Puppeteer scraping scripts from a visual selector workflow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
