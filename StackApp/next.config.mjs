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
      {
        source: '/.well-known/agent-card.json',
        destination: '/api/.well-known/agent-card.json',
      },
      {
        source: '/.well-known/agent-registration.json',
        destination: '/api/.well-known/agent-registration.json',
      },
      {
        source: '/.well-known/erc-8004.json',
        destination: '/api/.well-known/erc-8004.json',
      },
      {
        source: '/.well-known/siwa.json',
        destination: '/api/.well-known/siwa.json',
      },
      {
        source: '/.well-known/x401.json',
        destination: '/api/.well-known/x401.json',
      },
      {
        source: '/.well-known/jwks.json',
        destination: '/api/.well-known/jwks.json',
      },
      {
        source: '/.well-known/did.json',
        destination: '/api/.well-known/did.json',
      },
      {
        source: '/.well-known/x402-discovery.json',
        destination: '/api/.well-known/x402-discovery.json',
      },
      {
        source: '/.well-known/x402-payment.json',
        destination: '/api/.well-known/x402-payment.json',
      },
      // Agent-readiness entry points (see lib/agents/readiness.ts).
      { source: '/llms.txt', destination: '/api/llms.txt' },
      { source: '/index.md', destination: '/api/markdown' },
      { source: '/mcp', destination: '/api/mcp' },
      { source: '/.well-known/api-catalog', destination: '/api/.well-known/api-catalog' },
      // OAuth (PerkOS OAuth is the issuer; Stack is a resource server).
      { source: '/.well-known/oauth-protected-resource', destination: '/api/.well-known/oauth-protected-resource' },
      { source: '/.well-known/oauth-authorization-server', destination: '/api/.well-known/oauth-authorization-server' },
      { source: '/.well-known/openid-configuration', destination: '/api/.well-known/oauth-authorization-server' },
      // UCP business profile (payment handler only; no shopping service).
      { source: '/.well-known/ucp', destination: '/api/.well-known/ucp' },
      { source: '/.well-known/ucp/x402-handler.schema.json', destination: '/api/.well-known/ucp/x402-handler.schema.json' },
    ];
  },
  // Baseline security headers on every response (L1). CSP is intentionally
  // omitted — a strict policy breaks the wallet SDKs (Para/Dynamic/wagmi) and
  // RPC calls, and needs careful per-origin allowlisting + runtime testing.
  async headers() {
    return [
      // Homepage: RFC 8288 Link relations to every machine-readable entry point,
      // and Vary: Accept because `/` negotiates text/markdown (middleware).
      {
        source: '/',
        headers: [
          { key: 'Vary', value: 'Accept' },
          {
            key: 'Link',
            value: [
              '<https://stack.perkos.xyz/llms.txt>; rel="llms-txt"; type="text/plain"',
              '<https://stack.perkos.xyz/index.md>; rel="alternate"; type="text/markdown"',
              '<https://stack.perkos.xyz/openapi.json>; rel="service-desc"; type="application/json"',
              '<https://stack.perkos.xyz/auth.md>; rel="service-doc"; type="text/markdown"',
              '<https://stack.perkos.xyz/.well-known/api-catalog>; rel="api-catalog"',
              '<https://stack.perkos.xyz/.well-known/ai-catalog.json>; rel="ai-catalog"; type="application/json"',
              '<https://stack.perkos.xyz/.well-known/agent-skills/index.json>; rel="agent-skills"; type="application/json"',
              '<https://stack.perkos.xyz/.well-known/agent-card.json>; rel="agent-card"; type="application/json"',
              '<https://stack.perkos.xyz/.well-known/mcp/server-card.json>; rel="mcp-server-card"; type="application/json"',
              '<https://stack.perkos.xyz/.well-known/x402-payment.json>; rel="describedby"; type="application/json"',
            ].join(', '),
          },
        ],
      },
      // Static discovery files: readable cross-origin, correct media types.
      {
        source: '/.well-known/:path*',
        headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
      },
      {
        source: '/.well-known/agent-skills/:skill/SKILL.md',
        headers: [{ key: 'Content-Type', value: 'text/markdown; charset=utf-8' }],
      },
      {
        source: '/auth.md',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/openapi.json',
        headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
      },
      {
        source: '/llms.txt',
        headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // camera=(self): the wallet page's QR scanner needs it; everything
          // else powerful is disabled.
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(), browsing-topics=()',
          },
        ],
      },
    ];
  },
  // Enforce strict type checking and linting during builds
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
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
      // wagmi v3 "tempo" connector pulls Porto's `accounts` module (unused here)
      'accounts': false,
      '@safe-global/safe-apps-sdk': false,
      '@safe-global/safe-apps-provider': false,
      // @dynamic-labs realtime transport (ably) — unused for wallet auth, and a
      // clean install resolves an ably version whose ./modular subpath isn't exported
      'ably/modular': false,
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
        'accounts': false,
        'ably/modular': false,
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
      { message: /Can't resolve 'accounts'/ },
      { message: /Package path \.\/modular is not exported from package/ },
      { module: /node_modules\/ably/ },
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

export default nextConfig;
