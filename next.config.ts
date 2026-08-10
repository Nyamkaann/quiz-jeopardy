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
    ],
  },
};

export default nextConfig;
