import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import WinterDecor from "@/components/WinterDecor";

// One family for headings, body, numbers and labels — so digits and letters
// always share the same face (no more serif numbers next to sans text).
// Nunito is soft and rounded (wintry) and covers Mongolian Ө / Ү via cyrillic-ext.
const nunito = Nunito({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Astro Jeopardy",
  description: "Astro Jeopardy-style quiz game",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#071423",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" className={nunito.variable}>
      <body>
        <WinterDecor />
        {children}
      </body>
    </html>
  );
}
