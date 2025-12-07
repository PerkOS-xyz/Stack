# Documentation Index

Complete documentation for the PerkOS x402 Multi-Chain Payment Facilitator.

## Quick Start
- [README_PRODUCTION.md](README_PRODUCTION.md) - Quick production deployment guide

## Architecture & Flow
- [PAYMENT_ENVELOPE_FLOW.md](PAYMENT_ENVELOPE_FLOW.md) - **Complete analysis of payment envelope execution**
  - Exact Scheme (EIP-3009) verification and settlement flow
  - Deferred Scheme (EIP-712) verification and settlement flow
  - Security considerations and error handling
  - Flow diagrams and sequence analysis
- [GAS_SPONSORSHIP_DESIGN.md](GAS_SPONSORSHIP_DESIGN.md) - **Gas sponsorship system architecture**
  - User-funded sponsor wallets for gas fee payment
  - Architecture options (Privy, custom wallets, ERC-4337)
  - Database schema and API design
  - Integration flow and security considerations
  - Complete implementation plan (12-15 days)
- [SERVER_WALLET_PROVIDERS.md](SERVER_WALLET_PROVIDERS.md) - **Server wallet provider comparison 2025**
  - 9 providers analyzed: Privy, Turnkey, Coinbase WaaS, Dynamic, Thirdweb, Alchemy, Magic, Reown, Custom
  - Feature comparison, pricing, integration complexity
  - Recommendation: Custom (viem) for cost, Turnkey for performance
  - Monthly cost analysis: $50-1,150 depending on provider
- [GAS_SPONSORSHIP_WITH_REOWN.md](GAS_SPONSORSHIP_WITH_REOWN.md) - **🚀 Recommended Implementation**
  - Reown AppKit (social login, email, 700+ wallets) + Turnkey (secure server wallets)
  - Complete user flow: Login → Create wallet → Fund → Auto gas payment
  - NO private key storage (AWS Nitro Enclaves)
  - Cost: ~$1-2/month, 5-7 days implementation

## Database Setup
- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) - Step-by-step Supabase integration
- [DATABASE_TABLES.md](DATABASE_TABLES.md) - Complete database schema reference

## Deployment
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Production deployment checklist
  - Vercel deployment
  - Docker deployment
  - VPS deployment
  - Post-deployment verification

## Standards Compliance
- [/.well-known/erc-8004.json](../app/api/.well-known/erc-8004.json/route.ts) - ERC-8004 agent discovery endpoint
- [/.well-known/agent-card.json](../app/api/.well-known/agent-card.json/route.ts) - x402 agent card

## Project Overview
See [CLAUDE.md](../../CLAUDE.md) at project root for complete project overview and technology stack.
