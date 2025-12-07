/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  webpack: (config, { isServer }) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");

    // Fix for Thirdweb + Next.js 15 compatibility
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },
};

export default nextConfig;
