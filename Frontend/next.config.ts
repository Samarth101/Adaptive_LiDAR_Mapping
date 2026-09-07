import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    // deck.gl (kept in case it's used elsewhere; harmless if not)
    "deck.gl",
    "@deck.gl/core",
    "@deck.gl/layers",
    "@deck.gl/react",
    "@luma.gl/core",
    "@luma.gl/engine",
    "@luma.gl/shadertools",
    "@luma.gl/webgl",
    "@math.gl/core",
    "@math.gl/web-mercator",
    // three.js ecosystem
    "three",
    "@react-three/fiber",
    "@react-three/drei",
    "three-stdlib",
  ],
};

export default nextConfig;
