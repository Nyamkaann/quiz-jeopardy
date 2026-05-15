import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StorePay Jeopardy",
  description: "StorePay Jeopardy-style quiz game",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
