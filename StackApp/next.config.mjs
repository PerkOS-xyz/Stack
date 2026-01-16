/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
  },
  // Externalize Dynamic Labs packages to prevent bundling client-side code on server
  // These packages have dependencies on @dynamic-labs that include React client components
  serverExternalPackages: [
    '@dynamic-labs-wallet/node',
    '@dynamic-labs-wallet/node-evm',
    '@dynamic-labs-wallet/node-svm',
    '@dynamic-labs/sdk-api',
    '@dynamic-labs/sdk-api-core',
  ],
  // Custom webpack error handling
  webpack: (config, { isServer, dev }) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");

    // Dynamic Labs packages are externalized via serverExternalPackages above
    // This ensures they're loaded from node_modules at runtime, avoiding
    // bundling of @dynamic-labs client-side dependencies on the server

    // Ignore .node native binary files (return empty module)
    config.module.rules.push({
      test: /\.node$/,
      type: 'asset/resource',
      generator: {
        emit: false,
      },
    });

    // Stub Para SDK peer dependencies (not needed modules)
    // Note: Dynamic Labs packages are handled via serverExternalPackages above
    config.resolve.alias = {
      ...config.resolve.alias,
      // Cosmos dependencies (not needed for EVM chains)
      // Note: @cosmjs/encoding is required by Para SDK for address display
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
      // Note: @solana/web3.js and @getpara/solana-web3.js-v1-integration are enabled for server-side Solana wallet creation
      // Wagmi connector optional dependencies (not needed)
      // Note: @metamask/sdk is ENABLED for Dynamic SDK MetaMask support
      '@base-org/account': false,
      '@gemini-wallet/core': false,
      'porto': false,
      'porto/internal': false,
      '@safe-global/safe-apps-sdk': false,
      '@safe-global/safe-apps-provider': false,
    };

    // Fix for Para SDK + Next.js client-side compatibility
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        // Wagmi connector optional dependencies
        // Note: @metamask/sdk is ENABLED for Dynamic SDK MetaMask support
        '@base-org/account': false,
        '@gemini-wallet/core': false,
        'porto': false,
        'porto/internal': false,
        '@safe-global/safe-apps-sdk': false,
        '@safe-global/safe-apps-provider': false,
      };
    }

    // Ignore missing optional modules (wagmi connectors, Dynamic Labs native modules)
    // Note: @metamask/sdk warnings are NOT ignored - it's enabled for Dynamic SDK
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /node_modules\/@wagmi\/connectors/ },
      { module: /node_modules\/@dynamic-labs-wallet\/node/ },
      { message: /Can't resolve '@base-org\/account'/ },
      { message: /Can't resolve '@gemini-wallet\/core'/ },
      { message: /Can't resolve 'porto'/ },
      { message: /Can't resolve '@safe-global'/ },
      { message: /Can't resolve '@dynamic-labs-wallet\/node'/ },
    ];

    // Suppress build errors in production
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

export default nextConfig;
