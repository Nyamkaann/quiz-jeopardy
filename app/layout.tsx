import type { Metadata } from "next";
import { Tektur, Play, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Tektur — retro-futuristic display face that matches the Astro-Nots wordmark.
// Loaded for LATIN ONLY: its Cyrillic З/Э look like "3" and Ө like "0", so any
// Mongolian text in a heading falls through to Play (see --font-display in globals.css).
const display = Tektur({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-tektur",
  display: "swap",
  adjustFontFallback: false,
});

// Play — futuristic face with full Mongolian Cyrillic (Ө, Ү). Used for body text
// and as the fallback for any Cyrillic inside Tektur headings.
const body = Play({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["400", "700"],
  variable: "--font-exo",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-jbmono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Astro Jeopardy",
  description: "Astro Jeopardy-style quiz game",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
