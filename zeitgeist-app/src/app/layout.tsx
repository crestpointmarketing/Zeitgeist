import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ChatWidget from "@/components/cfo/chat-widget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/favicon.ico?v=zeitgeist-1", sizes: "16x16 32x32 48x48 64x64", type: "image/x-icon" },
      { url: "/favicon.svg?v=zeitgeist-1", sizes: "any", type: "image/svg+xml" },
      { url: "/favicon-192.png?v=zeitgeist-1", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png?v=zeitgeist-1", sizes: "180x180", type: "image/png" },
  },
  title: "Zeitgeist — Financial Research, Made Clearer",
  description: "Explore stock prices, calculated indicators and AI perspectives with visible data sources. Talk through financial questions with your AI CFO.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
