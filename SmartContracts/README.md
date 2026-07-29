# PerkOS Stack smart contracts

Foundry contracts for x402 deferred settlement, ERC-8004 registries, and
ERC-8183 agentic commerce.

## Install

Dependencies are pinned git submodules. Clone with `--recursive`, or initialize
an existing checkout:

```bash
git submodule update --init --recursive
```

## ERC-8183

`src/erc8183/PerkOSAgenticCommerce.sol` wraps the official base `ERC8183`
reference implementation pinned at commit
`142e669c1fd318486a4628395b629f033654dd06`. ERC-8183 is still a draft; review
and repin the dependency deliberately when the specification changes.

The optional upstream authorization extension is intentionally excluded because
its runtime bytecode exceeds the EIP-170 contract-size limit. Stack prepares
unsigned role transactions and each role wallet signs its action directly.

Run the integration tests:

```bash
forge test --match-contract PerkOSAgenticCommerceTest -vv
```

Or just `forge build` / `forge test` for the whole repo.

Deploy the upgradeable implementation and proxy:

```bash
cp .env.example .env
source .env

forge script script/DeployERC8183.s.sol:DeployERC8183 \
  --rpc-url robinhood_testnet \
  --broadcast
```

Required variables are `PRIVATE_KEY` and `ERC8183_PAYMENT_TOKEN`. The deployer
is the default admin and treasury; override them with `ERC8183_ADMIN` and
`ERC8183_TREASURY`. If a different admin must perform the initial token
allowlisting, also set `ERC8183_ADMIN_PRIVATE_KEY`.

After deployment, put the printed proxy address—not the implementation
address—in the corresponding StackApp `NEXT_PUBLIC_<NETWORK>_ERC8183_ADDRESS`
variable.

See [the integration guide](../Docs/SIWA-ERC8183.md) for architecture, API, and
security details.
