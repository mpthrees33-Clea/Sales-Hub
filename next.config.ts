import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg stays external server-side; pdf-lib ships assets that must not be bundled
  serverExternalPackages: ["pg", "pdf-lib"],
  webpack: (config, { dev }) => {
    if (dev) {
      // The local blob store (var/) lives inside the repo — keep the watcher
      // off it so seed/blob writes don't churn recompiles.
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/var/**", "**/.git/**"],
      };
    }
    return config;
  },
};

export default nextConfig;
