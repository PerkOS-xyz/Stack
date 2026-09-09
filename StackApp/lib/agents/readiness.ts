/**
 * Agent-readiness surface for stack.perkos.xyz: the Markdown rendition of the
 * site, the RFC 9727 API catalog, and the MCP tool catalog. Pure data and
 * builders (no Next imports) so routes stay thin and tests can import this.
 */

export const SITE = "https://stack.perkos.xyz";

export interface PaymentKind {
  x402Version?: number;
  scheme: string;
  network: string;
}

/** Human names for the CAIP-2 ids Stack settles on. Unknown ids fall back to the id. */
const NETWORK_NAMES: Record<string, string> = {
  "eip155:1": "Ethereum",
  "eip155:11155111": "Ethereum Sepolia",
  "eip155:8453": "Base",
  "eip155:84532": "Base Sepolia",
  "eip155:43114": "Avalanche C-Chain",
  "eip155:43113": "Avalanche Fuji",
  "eip155:42220": "Celo",
  "eip155:11142220": "Celo Sepolia",
  "eip155:137": "Polygon",
  "eip155:80002": "Polygon Amoy",
  "eip155:42161": "Arbitrum One",
  "eip155:421614": "Arbitrum Sepolia",
  "eip155:10": "Optimism",
  "eip155:11155420": "Optimism Sepolia",
};

export function networkName(caip2: string): string {
  return NETWORK_NAMES[caip2] || caip2;
}

/** Rough token estimate for the x-markdown-tokens header (words * 1.35). */
export function estimateTokens(text: string): number {
  return Math.round(text.split(/\s+/).filter(Boolean).length * 1.35);
}

/** The landing page as Markdown. `kinds` comes from the x402 supported list. */
export function stackMarkdown(kinds: PaymentKind[]): string {
  const networks = [...new Set(kinds.map((k) => k.network))];
  const schemes = [...new Set(kinds.map((k) => k.scheme))];
  const networkLines = networks.map((n) => `- ${networkName(n)} (\`${n}\`)`).join("\n");
  return `# PerkOS Stack

Multi-chain x402 payments and ERC-8004 registration infrastructure for humans and autonomous agents. Stack is an x402 facilitator: it verifies signed stablecoin payments and settles them on-chain, and it prepares on-chain agent identities on the canonical ERC-8004 registries.

## What Stack does

- **x402 facilitator.** \`POST /api/v2/x402/verify\` checks an EIP-3009 payment authorization against payment requirements; \`POST /api/v2/x402/settle\` executes it on-chain. Schemes: ${schemes.map((s) => `\`${s}\``).join(", ")}. Gas can be sponsored for services with a verified vendor domain.
- **ERC-8004 identity.** \`POST /api/v2/agents/onboard\` returns unsigned registration calldata for the official Identity Registry on a network; \`GET /api/v2/agents/discovery?chainId=&agentId=\` reports whether the identity is indexed. Reputation and validation registries are readable under \`/api/erc8004/\`.
- **Agent accounts.** Register a wallet with one signature (\`POST /api/v2/agents/register\`) to get an API key for server-managed wallets and paid services in the marketplace. Lost keys are replaced with \`POST /api/v2/agents/keys/rotate\`.

## Supported networks (${networks.length})

${networkLines}

Live list: \`GET ${SITE}/api/v2/x402/supported\`.

## For agents

- API reference for LLMs: ${SITE}/llms.txt
- Authentication: ${SITE}/auth.md
- OpenAPI: ${SITE}/openapi.json
- MCP server (Streamable HTTP): ${SITE}/mcp (card at ${SITE}/.well-known/mcp/server-card.json)
- A2A agent: ${SITE}/api/a2a (card at ${SITE}/.well-known/agent-card.json)
- Skills: ${SITE}/.well-known/agent-skills/index.json
- Capability catalog (ARD): ${SITE}/.well-known/ai-catalog.json
- x402 discovery: ${SITE}/.well-known/x402-payment.json and ${SITE}/.well-known/erc-8004.json

## For humans

- Register an ERC-8004 agent with the wizard: ${SITE}/agents/register
- Dashboard, networks, transactions and marketplace: ${SITE}/dashboard, ${SITE}/networks, ${SITE}/transactions, ${SITE}/marketplace
- Contact: contact@perkos.xyz

Built by PerkOS (https://perkos.xyz). Infrastructure for the agentic economy.
`;
}

/** RFC 9727 API catalog (application/linkset+json). */
export function apiCatalog() {
  return {
    linkset: [
      {
        anchor: SITE,
        "service-desc": [{ href: `${SITE}/openapi.json`, type: "application/json" }],
        "service-doc": [
          { href: `${SITE}/llms.txt`, type: "text/plain" },
          { href: `${SITE}/auth.md`, type: "text/markdown" },
        ],
        status: [{ href: `${SITE}/api/v2/x402/health` }],
      },
    ],
  };
}

/** Link header for the homepage: every machine-readable entry point. */
export function homepageLinkHeader(): string {
  return [
    `<${SITE}/llms.txt>; rel="llms-txt"; type="text/plain"`,
    `<${SITE}/index.md>; rel="alternate"; type="text/markdown"`,
    `<${SITE}/openapi.json>; rel="service-desc"; type="application/json"`,
    `<${SITE}/auth.md>; rel="service-doc"; type="text/markdown"`,
    `<${SITE}/.well-known/api-catalog>; rel="api-catalog"`,
    `<${SITE}/.well-known/ai-catalog.json>; rel="ai-catalog"; type="application/json"`,
    `<${SITE}/.well-known/agent-skills/index.json>; rel="agent-skills"; type="application/json"`,
    `<${SITE}/.well-known/agent-card.json>; rel="agent-card"; type="application/json"`,
    `<${SITE}/.well-known/mcp/server-card.json>; rel="mcp-server-card"; type="application/json"`,
    `<${SITE}/.well-known/x402-payment.json>; rel="describedby"; type="application/json"`,
  ].join(", ");
}

/** MCP tool catalog. The route executes them against Stack's own HTTP API. */
export const MCP_TOOLS = [
  {
    name: "x402_supported_kinds",
    description: "Payment schemes and CAIP-2 networks this facilitator verifies and settles (x402 v2).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "x402_verify_payment",
    description:
      "Verify an x402 payment payload against payment requirements without settling. Returns isValid, invalidReason and payer.",
    inputSchema: {
      type: "object",
      required: ["paymentPayload", "paymentRequirements"],
      properties: {
        x402Version: { type: "integer", default: 2 },
        paymentPayload: { type: "object", description: "x402 payment payload: scheme, network, payload { signature, authorization }" },
        paymentRequirements: { type: "object", description: "x402 payment requirements: scheme, network, amount, asset, payTo, resource" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "prepare_erc8004_registration",
    description: "Unsigned calldata to register an ERC-8004 identity on a supported network (canonical Identity Registry).",
    inputSchema: {
      type: "object",
      required: ["network"],
      properties: {
        network: { type: "string", description: "Stack network key, e.g. base, base-sepolia, avalanche" },
        tokenURI: { type: "string", description: "Agent metadata URI (optional)" },
        paymentReceiver: { type: "string", description: "Address that receives x402 payments (optional)" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "check_agent_discovery",
    description: "Whether an ERC-8004 agent (chainId, agentId) is indexed by 8004scan, with metadata and endpoint guidance.",
    inputSchema: {
      type: "object",
      required: ["chainId", "agentId"],
      properties: {
        chainId: { type: "integer" },
        agentId: { type: "integer" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "facilitator_info",
    description: "Facilitator name, endpoints, and links to the API reference (llms.txt) and auth.md.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  // Authenticated tools: the caller's Authorization header (OAuth access token from
  // oauth.perkos.xyz for this resource, or a Stack API key) is forwarded to the REST
  // endpoint, which enforces auth and scopes. Without it the tool answers with the
  // protected-resource metadata so an MCP client can start the OAuth flow.
  {
    name: "stack_me",
    description: "Your registered agent profile, server-managed wallets and marketplace services. Requires Authorization: Bearer (OAuth stack:read or API key).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "stack_list_wallets",
    description: "List your server-managed wallets. Requires Authorization: Bearer (stack:read).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "stack_create_wallet",
    description: "Create a server-managed wallet for your agent. Requires Authorization: Bearer (stack:write).",
    inputSchema: {
      type: "object",
      properties: { network: { type: "string", description: "Wallet family, e.g. evm", default: "evm" }, name: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "stack_list_services",
    description: "List the paid services you registered in Stack's marketplace. Requires Authorization: Bearer (stack:read).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "stack_register_service",
    description: "Register a paid service (x402 endpoint) in Stack's marketplace. Requires Authorization: Bearer (stack:write).",
    inputSchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", description: "Public URL of the paid endpoint" },
        name: { type: "string" },
        description: { type: "string" },
        priceUsd: { type: "number" },
        network: { type: "string", default: "base" },
      },
      additionalProperties: false,
    },
  },
] as const;

/** Tools that forward the caller's Authorization header and refuse without one. */
export const AUTHENTICATED_TOOLS = new Set<string>(["stack_me", "stack_list_wallets", "stack_create_wallet", "stack_list_services", "stack_register_service"]);

export type McpToolName = (typeof MCP_TOOLS)[number]["name"];

export function facilitatorInfo() {
  return {
    name: "PerkOS Stack",
    url: SITE,
    x402: { supported: `${SITE}/api/v2/x402/supported`, verify: `${SITE}/api/v2/x402/verify`, settle: `${SITE}/api/v2/x402/settle` },
    agents: { register: `${SITE}/api/v2/agents/register`, rotateKey: `${SITE}/api/v2/agents/keys/rotate`, onboard: `${SITE}/api/v2/agents/onboard`, discovery: `${SITE}/api/v2/agents/discovery` },
    docs: { llms: `${SITE}/llms.txt`, auth: `${SITE}/auth.md`, openapi: `${SITE}/openapi.json`, a2a: `${SITE}/.well-known/agent-card.json` },
  };
}
