import type { Metadata } from "next";
import { Cormorant_Garamond, Play, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import GothicDecor from "@/components/GothicDecor";

// Cormorant Garamond — tall Victorian serif for the "Corpse Bride" look.
// Includes cyrillic-ext, so Mongolian Ө and Ү render in the same face as the rest of a heading.
const display = Cormorant_Garamond({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-gothic",
  display: "swap",
});

// Play — full Mongolian Cyrillic (Ө, Ү). Used for body text and user-entered clues.
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
      <body>
        <GothicDecor />
        {children}
      </body>
    </html>
  );
}
