# CoffeeSplit settlement (PerkOS Buy A Coffee)

The exact scheme can settle a payment through the `CoffeeSplit` contract instead of a
direct `transferWithAuthorization`. This is how [buyacoffee.perkos.xyz](https://buyacoffee.perkos.xyz)
pays a creator and keeps a 2% fee for the facilitator's gas, in one transaction and with
one signature from the donor.

## Request shape

Same `POST /api/v2/x402/verify` and `/settle` bodies as any exact payment, with:

- `paymentRequirements.payTo` = the CoffeeSplit address for the network (`COFFEE_SPLIT_ADDRESS_<NETWORK>`).
- `paymentRequirements.extra.split = { contract, creator, coffeeId, memoHash? }`.
- `paymentPayload.payload.authorization.to` = the CoffeeSplit address.
- `paymentPayload.payload.authorization.nonce` = `keccak256(abi.encodePacked("PerkOS.Coffee.v1", creator, coffeeId))` (`coffeeNonce`).
- The donor signs **`ReceiveWithAuthorization`** (EIP-3009), not `TransferWithAuthorization`.

## What the facilitator checks

1. `extra.split.contract` equals the allowlisted address from env for that network, and `payTo` equals it too. The sponsor wallet never calls an address supplied by the caller.
2. `authorization.nonce` equals `coffeeNonce(creator, coffeeId)`, so a relayer cannot redirect a signed authorization to another creator.
3. Signature recovered with the `ReceiveWithAuthorization` typed data; balance, time window and nonce state as usual.

## Settlement

`ExactSchemeService.executeSplitSettlement` encodes `CoffeeSplit.settle(creator, coffeeId, memoHash, auth)` and sends it from the sponsor wallet via `ParaTransactionService.executeContractCall` (Dynamic or Para). On failure it re-checks the EIP-3009 nonce on-chain; a used nonce means the coffee settled and is reported as success (no double charge is possible).

Sponsor lookup is unchanged: coffees from anonymous donors are sponsored through a `domain_whitelist` rule for `buyacoffee.perkos.xyz`, activated by the service's API key (`X-API-Key`) with that domain verified.

## Contract

`PerkOS-xyz/PerkOS-Contracts`, `src/CoffeeSplit.sol`. Base Sepolia proxy `0x704F85Bca00617096fa4F3d5C5499Ff373Fd5d38` (fee 200 bps, treasury = PerkOS Safe). Mainnet: pending.

Unit tests: `StackApp/tests/coffee-split.test.cjs` (`node --experimental-strip-types --test`).
