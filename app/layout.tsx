import type { Metadata } from "next";
import { Kalam, Noto_Sans_Devanagari, Space_Grotesk } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

const ui = Space_Grotesk({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-deva", display: "swap" });
const board = Kalam({
  weight: ["400", "700"],
  subsets: ["latin", "devanagari"],
  variable: "--font-board",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Doubtless",
  description: "Upload a textbook PDF and learn it from a tutor that writes on a board and answers your doubts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${deva.variable} ${board.variable}`}>
      <body>{children}</body>
    </html>
  );
}
