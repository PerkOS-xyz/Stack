import { ethers, upgrades } from "hardhat";

/**
 * ERC-8004 Registry Deployment Script
 * Deploys all three registries: Identity, Reputation, Validation
 *
 * Usage:
 *   npx hardhat run scripts/deploy-erc8004.ts --network <network>
 *
 * Networks: avalanche-fuji, base-sepolia, avalanche, base
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying ERC-8004 registries with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Configuration
  const config = {
    identity: {
      name: "PerkOS Agent Registry",
      symbol: "PERKOS",
    },
    validation: {
      minimumStake: ethers.parseEther("0.1"), // 0.1 native token
      withdrawalCooldown: 7 * 24 * 60 * 60, // 7 days in seconds
    },
  };

  console.log("\n=== Deploying ERC-8004 Registries ===\n");

  // 1. Deploy Identity Registry
  console.log("1. Deploying Identity Registry...");
  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await upgrades.deployProxy(
    IdentityRegistry,
    [config.identity.name, config.identity.symbol],
    { kind: "uups" }
  );
  await identityRegistry.waitForDeployment();
  const identityAddress = await identityRegistry.getAddress();
  console.log("   Identity Registry deployed to:", identityAddress);

  // 2. Deploy Reputation Registry
  console.log("\n2. Deploying Reputation Registry...");
  const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
  const reputationRegistry = await upgrades.deployProxy(
    ReputationRegistry,
    [identityAddress],
    { kind: "uups" }
  );
  await reputationRegistry.waitForDeployment();
  const reputationAddress = await reputationRegistry.getAddress();
  console.log("   Reputation Registry deployed to:", reputationAddress);

  // 3. Deploy Validation Registry
  console.log("\n3. Deploying Validation Registry...");
  const ValidationRegistry = await ethers.getContractFactory("ValidationRegistry");
  const validationRegistry = await upgrades.deployProxy(
    ValidationRegistry,
    [identityAddress, config.validation.minimumStake, config.validation.withdrawalCooldown],
    { kind: "uups" }
  );
  await validationRegistry.waitForDeployment();
  const validationAddress = await validationRegistry.getAddress();
  console.log("   Validation Registry deployed to:", validationAddress);

  // Summary
  console.log("\n=== Deployment Summary ===\n");
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId.toString());
  console.log("");
  console.log("Identity Registry:   ", identityAddress);
  console.log("Reputation Registry: ", reputationAddress);
  console.log("Validation Registry: ", validationAddress);
  console.log("");
  console.log("Configuration:");
  console.log("  - Identity Name:", config.identity.name);
  console.log("  - Identity Symbol:", config.identity.symbol);
  console.log("  - Validator Min Stake:", ethers.formatEther(config.validation.minimumStake), "native");
  console.log("  - Withdrawal Cooldown:", config.validation.withdrawalCooldown / 86400, "days");

  // Verify versions
  console.log("\n=== Contract Versions ===\n");
  console.log("Identity Registry version:", await identityRegistry.version());
  console.log("Reputation Registry version:", await reputationRegistry.version());
  console.log("Validation Registry version:", await validationRegistry.version());

  // Output for .env file
  console.log("\n=== Environment Variables ===\n");
  console.log("Add these to your .env file:\n");
  const networkName = (await ethers.provider.getNetwork()).name.toUpperCase().replace(/-/g, "_");
  console.log(`NEXT_PUBLIC_${networkName}_IDENTITY_REGISTRY=${identityAddress}`);
  console.log(`NEXT_PUBLIC_${networkName}_REPUTATION_REGISTRY=${reputationAddress}`);
  console.log(`NEXT_PUBLIC_${networkName}_VALIDATION_REGISTRY=${validationAddress}`);

  return {
    identityRegistry: identityAddress,
    reputationRegistry: reputationAddress,
    validationRegistry: validationAddress,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
