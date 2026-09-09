/**
 * UCP (Universal Commerce Protocol) business profile for stack.perkos.xyz.
 *
 * ## What this profile says, and what it deliberately does not
 *
 * Stack is a payment facilitator that also sells a little data over x402. The
 * profile says exactly that: a payment handler, and no shopping service.
 *
 * Only `ucp.version` is required; `services` and `capabilities` are optional,
 * and `payment_handlers` is a first-class member of the profile. Declaring a
 * service commits the business to operating that endpoint over that transport
 * with that schema, so `dev.ucp.shopping` is not listed: there is no cart and
 * no order lifecycle here. UCP puts metered API access outside its own scope,
 * which is precisely what Stack sells, so there is no honest shopping service
 * to name.
 *
 * What is left is true and useful: an agent learns that this origin takes
 * stablecoin payment over x402, on which networks, where the requirements
 * come from, and that the same origin is the facilitator that verifies and
 * settles them. Same shape as perkos.xyz, which publishes the same handler.
 */

export const UCP_VERSION = "2026-04-08";

export function ucpProfile(site: string, networks: string[], x402Version = 2) {
  return {
    ucp: {
      version: UCP_VERSION,
      payment_handlers: {
        // Reverse-DNS on our own domain: this handler is ours, not one the
        // specification defines, so it does not live under `dev.ucp.`.
        "xyz.perkos.x402": [
          {
            id: "x402",
            version: UCP_VERSION,
            spec: `${site}/auth.md`,
            schema: `${site}/.well-known/ucp/x402-handler.schema.json`,
            available_instruments: [
              {
                type: "stablecoin",
                constraints: { scheme: "x402", asset: "USDC", networks },
              },
            ],
            config: {
              type: "X402",
              // Ask this URL without a payment header and it answers 402 with
              // the requirements. That response is the authoritative price, so
              // none is quoted here: a number in this document would go stale.
              payment_requirements_url: `${site}/api/v1`,
              x402_version: x402Version,
              facilitator: {
                url: site,
                verify: `${site}/api/v2/x402/verify`,
                settle: `${site}/api/v2/x402/settle`,
                supported: `${site}/api/v2/x402/supported`,
              },
              catalog: `${site}/openapi.json`,
            },
          },
        ],
      },
    },
  };
}

export function ucpHandlerSchema(site: string) {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${site}/.well-known/ucp/x402-handler.schema.json`,
    title: "PerkOS Stack x402 payment handler",
    description:
      "Configuration for paying Stack with an EIP-3009 stablecoin transfer over x402. " +
      "Call payment_requirements_url without a payment header to receive the requirements " +
      "(PAYMENT-REQUIRED header for x402 v2, body for v1), then repeat the call with the signed " +
      "authorization in PAYMENT-SIGNATURE or X-PAYMENT. Stack is the facilitator: it verifies and " +
      "settles the payment itself and answers with PAYMENT-RESPONSE.",
    type: "object",
    required: ["type", "payment_requirements_url", "x402_version"],
    additionalProperties: false,
    properties: {
      type: { const: "X402" },
      payment_requirements_url: {
        type: "string",
        format: "uri",
        description: "Answers 402 with the payment requirements. This response is the authoritative price.",
      },
      x402_version: { type: "integer", enum: [1, 2], description: "The x402 version the requirements are published in." },
      facilitator: {
        type: "object",
        description: "The facilitator that verifies and settles payments made with this handler (this origin).",
        properties: {
          url: { type: "string", format: "uri" },
          verify: { type: "string", format: "uri" },
          settle: { type: "string", format: "uri" },
          supported: { type: "string", format: "uri" },
        },
      },
      catalog: { type: "string", format: "uri", description: "OpenAPI document listing the payable operations and their offers." },
    },
  };
}
