import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
    localPatterns: [
      { pathname: "/uploads/**", search: "" },
      { pathname: "/astro-logo.png", search: "" },
      { pathname: "/astro-nots.png", search: "" },
    ],
  },
};

export default nextConfig;
