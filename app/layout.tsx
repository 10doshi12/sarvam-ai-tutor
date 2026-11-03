import type { Metadata } from "next";
import { Kalam } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

const kalam = Kalam({
  weight: ["400", "700"],
  subsets: ["latin", "devanagari"],
  variable: "--font-board",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Avatar Tutor",
  description: "Upload a textbook PDF and learn it from a tutor that writes on a board and answers your doubts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={kalam.variable}>
      <body>{children}</body>
    </html>
  );
}
