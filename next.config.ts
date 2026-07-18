import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist and pdf-lib ship worker/wasm assets that must not be bundled server-side
  serverExternalPackages: ["pg", "pdf-lib"],
};

export default nextConfig;
