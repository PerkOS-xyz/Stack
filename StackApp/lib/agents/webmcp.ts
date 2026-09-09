/**
 * WebMCP: the site's key read actions exposed to browser agents through
 * navigator.modelContext.registerTool. Injected inline by the root layout so
 * the tools exist at page load, before hydration; a no-op where the API is
 * absent. Mirrors the read-only tools of the MCP server at /mcp.
 */
export const WEBMCP_SCRIPT = `(function(){
  var mc = navigator.modelContext;
  if (!mc || typeof mc.registerTool !== 'function') return;
  var ac = new AbortController();
  function fetchText(url, init) {
    return fetch(url, init).then(function (r) {
      return r.text().then(function (t) { return { content: [{ type: 'text', text: t }], isError: !r.ok }; });
    }).catch(function (e) { return { content: [{ type: 'text', text: 'request failed: ' + e.message }], isError: true }; });
  }
  mc.registerTool({
    name: 'read_site_markdown',
    description: 'Read what PerkOS Stack is and how to use it, as Markdown: x402 facilitator endpoints, ERC-8004 registration, agent accounts, supported networks, links for agents.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: function () { return fetchText('/index.md', { headers: { Accept: 'text/markdown' } }); }
  }, { signal: ac.signal });
  mc.registerTool({
    name: 'x402_supported_kinds',
    description: 'Payment schemes and CAIP-2 networks this x402 facilitator verifies and settles.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: function () { return fetchText('/api/v2/x402/supported'); }
  }, { signal: ac.signal });
  mc.registerTool({
    name: 'check_agent_discovery',
    description: 'Whether an ERC-8004 agent (chainId, agentId) is indexed by 8004scan.',
    inputSchema: { type: 'object', required: ['chainId', 'agentId'], properties: { chainId: { type: 'integer' }, agentId: { type: 'integer' } }, additionalProperties: false },
    execute: function (args) {
      args = args || {};
      return fetchText('/api/v2/agents/discovery?chainId=' + encodeURIComponent(String(args.chainId == null ? '' : args.chainId)) + '&agentId=' + encodeURIComponent(String(args.agentId == null ? '' : args.agentId)));
    }
  }, { signal: ac.signal });
  mc.registerTool({
    name: 'open_agent_registration',
    description: 'Navigate to the ERC-8004 agent registration wizard.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: function () { window.location.assign('/agents/register'); return Promise.resolve({ content: [{ type: 'text', text: 'Opening /agents/register' }] }); }
  }, { signal: ac.signal });
  window.addEventListener('pagehide', function () { ac.abort(); }, { once: true });
})();`;

export const WEBMCP_TOOL_NAMES = ["read_site_markdown", "x402_supported_kinds", "check_agent_discovery", "open_agent_registration"] as const;
