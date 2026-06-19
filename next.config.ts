import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // すべてのルートに適用
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            // same-origin-allow-popups: Firebase signInWithPopup のポップアップ通信を許可
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
