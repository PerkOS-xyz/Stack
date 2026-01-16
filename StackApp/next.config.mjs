import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Optimize imports for heavy libraries (tree-shaking)
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },
  // Suppress source map requests for Para SDK files
  async rewrites() {
    return [
      {
        source: '/prime.worker.min.js.map',
        destination: '/api/empty-source-map',
      },
      {
        source: '/_next/static/css/app/capsule-core.css.map',
        destination: '/api/empty-source-map',
      },
    ];
  },
  // Allow build to continue even with errors
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable static generation for dynamic routes
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Optimize package imports for faster builds
    optimizePackageImports: [
      'lucide-react',
      'viem',
      'wagmi',
      'ethers',
      '@tanstack/react-query',
      '@getpara/react-sdk',
      '@dynamic-labs/sdk-react-core',
    ],
  },
  // Remove console.logs in production for smaller bundles
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // Externalize Dynamic Labs packages to prevent bundling client-side code on server
  serverExternalPackages: [
    '@dynamic-labs-wallet/node',
    '@dynamic-labs-wallet/node-evm',
    '@dynamic-labs-wallet/node-svm',
    '@dynamic-labs/sdk-api',
    '@dynamic-labs/sdk-api-core',
  ],
  // Custom webpack configuration
  webpack: (config, { isServer, dev }) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");

    // Ignore .node native binary files
    config.module.rules.push({
      test: /\.node$/,
      type: 'asset/resource',
      generator: {
        emit: false,
      },
    });

    // Stub unused dependencies to reduce bundle size
    config.resolve.alias = {
      ...config.resolve.alias,
      // Cosmos dependencies (not needed for EVM chains)
      '@cosmjs/stargate': false,
      '@cosmjs/proto-signing': false,
      '@cosmjs/amino': false,
      '@cosmjs/math': false,
      '@cosmjs/tendermint-rpc': false,
      '@cosmjs/crypto': false,
      'cosmjs-types': false,
      'graz': false,
      '@getpara/cosmos-wallet-connectors': false,
      '@getpara/cosmjs-v0-integration': false,
      '@getpara/graz-connector': false,
      // Solana client-side wallet adapters (not needed - using server-side SDK)
      '@solana/wallet-adapter-base': false,
      '@solana/wallet-adapter-react': false,
      '@solana/wallet-adapter-wallets': false,
      '@getpara/solana-wallet-connectors': false,
      // Wagmi connector optional dependencies (not needed)
      '@base-org/account': false,
      '@gemini-wallet/core': false,
      'porto': false,
      'porto/internal': false,
      '@safe-global/safe-apps-sdk': false,
      '@safe-global/safe-apps-provider': false,
      // Stub React Native modules (not needed for web)
      '@react-native-async-storage/async-storage': false,
      'react-native': false,
    };

    // Client-side fallbacks
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        '@base-org/account': false,
        '@gemini-wallet/core': false,
        'porto': false,
        'porto/internal': false,
        '@safe-global/safe-apps-sdk': false,
        '@safe-global/safe-apps-provider': false,
        '@react-native-async-storage/async-storage': false,
      };
    }

    // Ignore missing optional modules
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /node_modules\/@wagmi\/connectors/ },
      { module: /node_modules\/@dynamic-labs-wallet\/node/ },
      { module: /node_modules\/@metamask\/sdk/ },
      { message: /Can't resolve '@base-org\/account'/ },
      { message: /Can't resolve '@gemini-wallet\/core'/ },
      { message: /Can't resolve 'porto'/ },
      { message: /Can't resolve '@safe-global'/ },
      { message: /Can't resolve '@dynamic-labs-wallet\/node'/ },
      { message: /Can't resolve '@react-native-async-storage\/async-storage'/ },
    ];

    // Production optimizations
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        emitOnErrors: true,
      };
    }

    return config;
  },
  // Handle build errors gracefully
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

export default withBundleAnalyzer(nextConfig);
