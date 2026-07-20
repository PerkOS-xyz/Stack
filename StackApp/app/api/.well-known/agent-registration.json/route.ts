// ERC-8004's endpoint-domain verification path must expose at least the same
// `registrations` array as the agent registration file. Reuse the canonical
// response so these two well-known URLs cannot drift.
export { dynamic, GET } from "../erc-8004.json/route";
