import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in the parent directory otherwise wins the root inference.
  turbopack: { root: path.resolve(import.meta.dirname) },

  experimental: {
    // Next parallelizes static page generation across jest-worker child
    // processes. On memory-constrained machines a worker can be OOM-killed,
    // which surfaces as "Jest worker encountered N child process exceptions".
    // Forcing a single in-process worker trades build speed for stability.
    workerThreads: false,
    cpus: 1,
  },

  // NOTE: `swcMinify: false` is deliberately absent. It was removed in Next 15
  // and this project is on 16 — setting it fails the type check and logs
  // "Unrecognized key(s) in object: 'swcMinify'". Minification is no longer
  // configurable from here.
};

export default nextConfig;
