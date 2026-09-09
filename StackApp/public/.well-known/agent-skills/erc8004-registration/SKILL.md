---
name: erc8004-registration
description: Prepare an ERC-8004 on-chain agent identity with Stack and check whether it is discoverable.
---

# Register an ERC-8004 identity through Stack

Use this when an agent wants a verifiable on-chain identity (ERC-8004 Identity Registry NFT) and needs the calldata prepared for a supported network.

## Steps

1. `POST https://stack.perkos.xyz/api/v2/agents/onboard` with JSON `{ "network": "base" }`. Optional fields: `tokenURI` (agent metadata URI), `metadata` (array of `{ key, value }`), `paymentReceiver`, `agentId`. Networks must be agent-ready: x402 exact payments plus an official ERC-8004 Identity Registry.
2. The response contains unsigned calldata for the canonical Identity Registry on that network (`0x8004A169…` on mainnets, `0x8004A818…` on testnets). Sign and send it from the wallet that will own the identity.
3. After the mint, `GET https://stack.perkos.xyz/api/v2/agents/discovery?chainId=<id>&agentId=<id>` reports whether 8004scan has indexed the identity and resolved its `agentURI`. Indexing can take a few minutes.
4. Humans can do the same through the wizard at https://stack.perkos.xyz/agents/register.

## Facts you can rely on

- Stack does not deploy its own registries; it uses the canonical ERC-8004 v2 deployments at the same addresses on every supported network.
- Reputation and validation registries are readable through `/api/erc8004/reputation` and `/api/erc8004/validation` with `network` and `agentId` query parameters.
- The A2A agent at `https://stack.perkos.xyz/api/a2a` (`message/send`) answers the same three intents: prepare a registration, check discovery, configure x402.

## Do not

Do not sign calldata for a network the agent did not ask for. Do not assume an identity is discoverable until the discovery endpoint confirms it.
