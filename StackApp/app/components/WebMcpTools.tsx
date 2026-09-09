"use client";

import { useEffect } from "react";

/**
 * WebMCP: exposes the site's key read actions to browser agents via
 * navigator.modelContext.registerTool (no-op where the API is absent).
 * Mirrors the read-only tools of the MCP server at /mcp.
 */
type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };
type ModelContext = {
  registerTool: (
    tool: { name: string; description: string; inputSchema: Record<string, unknown>; execute: (args: Record<string, unknown>) => Promise<ToolResult> },
    options?: { signal?: AbortSignal },
  ) => void;
};

async function fetchText(url: string, init?: RequestInit): Promise<ToolResult> {
  try {
    const r = await fetch(url, init);
    return { content: [{ type: "text", text: await r.text() }], isError: !r.ok };
  } catch (e) {
    return { content: [{ type: "text", text: `request failed: ${(e as Error).message}` }], isError: true };
  }
}

export default function WebMcpTools() {
  useEffect(() => {
    const mc = (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
    if (!mc || typeof mc.registerTool !== "function") return;
    const ac = new AbortController();
    const opts = { signal: ac.signal };

    mc.registerTool(
      {
        name: "read_site_markdown",
        description: "Read what PerkOS Stack is and how to use it, as Markdown: x402 facilitator endpoints, ERC-8004 registration, agent accounts, supported networks, links for agents.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: () => fetchText("/index.md", { headers: { Accept: "text/markdown" } }),
      },
      opts,
    );
    mc.registerTool(
      {
        name: "x402_supported_kinds",
        description: "Payment schemes and CAIP-2 networks this x402 facilitator verifies and settles.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: () => fetchText("/api/v2/x402/supported"),
      },
      opts,
    );
    mc.registerTool(
      {
        name: "check_agent_discovery",
        description: "Whether an ERC-8004 agent (chainId, agentId) is indexed by 8004scan.",
        inputSchema: {
          type: "object",
          required: ["chainId", "agentId"],
          properties: { chainId: { type: "integer" }, agentId: { type: "integer" } },
          additionalProperties: false,
        },
        execute: (args) => fetchText(`/api/v2/agents/discovery?chainId=${encodeURIComponent(String(args.chainId ?? ""))}&agentId=${encodeURIComponent(String(args.agentId ?? ""))}`),
      },
      opts,
    );
    mc.registerTool(
      {
        name: "open_agent_registration",
        description: "Navigate to the ERC-8004 agent registration wizard.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: async () => {
          window.location.assign("/agents/register");
          return { content: [{ type: "text", text: "Opening /agents/register" }] };
        },
      },
      opts,
    );
    return () => ac.abort();
  }, []);
  return null;
}
