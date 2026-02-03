import type { NextConfig } from "next";

// Prevent Turbopack from inferring the wrong workspace root when multiple lockfiles exist.
// This is especially important in AJ's setup where other package-lock.json files may exist.
const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
