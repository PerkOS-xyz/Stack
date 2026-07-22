# Robinhood Testnet ERC-8183 deployment

Deployment and certification evidence for the pinned ERC-8183 reference contract.

## Deployment

| Field | Value |
| --- | --- |
| Network | Robinhood Chain Testnet |
| Chain ID | `46630` |
| Implementation | `0x008e1100D92c28CFE61f98e74925297256A937E1` |
| ERC-1967 proxy | `0xF79fa4428e4b4B109BE3777981c1F8cb1618c7D7` |
| Admin and treasury | `0x13799dE5F7f567bd7B080d8c2526780674b805Ef` |
| Allowed payment token | USDG `0x7E955252E15c84f5768B83c41a71F9eba181802F` |
| Runtime size | `19,995` bytes (`4,581` bytes below EIP-170) |
| Source commit | `021b98eb162662f818aecb1ec0efb5a5302f7e5d` |

Deployment receipts:

- Implementation: `0xed278fd6fb99c4e03d5a62768ac21f936913df12581f44359e5130216ed0dc17`
- Proxy and initialization: `0x53fbab5dbd3a49087ed66f5ef4d78d8f9108afefaeec88a9b6ecd92944fbb87e`
- USDG allowlist: `0x71364bdd71a9bb9a59b0ed884710b16ec9225b0a6430c81d17130193b6060ede`

Post-deployment checks confirmed:

- the ERC-1967 implementation slot resolves to the implementation above;
- `paused() == false`;
- deployer has both `DEFAULT_ADMIN_ROLE` and `ADMIN_ROLE`;
- `allowedPaymentTokens(USDG) == true`;
- EIP-712 domain is `ERC8183`, version `1`, chain ID `46630`, verifying
  contract equal to the proxy;
- initial `jobCounter() == 0`.

## Real lifecycle certification

Job `#1` used `0.01 USDG` (`10,000` raw units with 6 decimals):

| Action | Transaction |
| --- | --- |
| Create job | `0xfd3e2ac36402325afc18fb869f669c0acc39232793e8beb39b3e2d2b355cedd9` |
| Set budget | `0x562df733977205b68265a026223c684efe41a7cd11a259b6ee1ca48b162a3f1e` |
| Approve USDG | `0xa9283d8b6b2bb64407c6315ee0d1ad312a3b845ec7a73eca7b580d022ce4e683` |
| Fund escrow | `0xcc69afc5fcc014d9644af88e71daa235c7917eda800c94739e6ea545e220ccb6` |
| Submit deliverable | `0xc975d3a11d2fe0e0a9d1a0fd12decc6cf4731e955294891d9db0ad040d5c5089` |
| Complete and release payment | `0xba725334c2eb93611965c94e1246fe2e630a67a9b8e259f30730dce181f7fa36` |

The deliverable reference is
`0xcaf8db473eeaddb656eaea6c4ce392ae610123ec4f468a2567c9d120e9d71005`.
Final job status is `3` (`Completed`), and the provider balance increased by
exactly `10,000` raw USDG units.

Explorer links use the Robinhood Testnet explorer:

- [Proxy](https://explorer.testnet.chain.robinhood.com/address/0xF79fa4428e4b4B109BE3777981c1F8cb1618c7D7)
- [Certified completion transaction](https://explorer.testnet.chain.robinhood.com/tx/0xba725334c2eb93611965c94e1246fe2e630a67a9b8e259f30730dce181f7fa36)
