/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow cross-origin audio from backend
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy",   value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy",  value: "require-corp" },
        ],
      },
    ];
  },
  webpack: (config) => {
    // Allow Tone.js / WaveSurfer to be bundled
    config.resolve.fallback = { fs: false, path: false, os: false };
    return config;
  },
};

module.exports = nextConfig;
