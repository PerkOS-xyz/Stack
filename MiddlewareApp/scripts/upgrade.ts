import hre from "hardhat";

/**
 * Upgrade script for DeferredPaymentEscrowUpgradeable
 *
 * Usage:
 * PROXY_ADDRESS=0x... npx hardhat run scripts/upgrade.ts --network <network-name>
 */
async function main() {
  const networkName = hre.network.name;
  const proxyAddress = process.env.PROXY_ADDRESS;

  if (!proxyAddress) {
    throw new Error("PROXY_ADDRESS environment variable is required");
  }

  console.log(`\n🔄 Upgrading DeferredPaymentEscrow on ${networkName}...`);
  console.log(`Proxy address: ${proxyAddress}\n`);

  // Get deployer account
  const [deployer] = await hre.viem.getWalletClients();
  console.log(`Deployer address: ${deployer.account.address}\n`);

  // Get existing proxy contract
  const proxy = await hre.viem.getContractAt(
    "DeferredPaymentEscrowUpgradeable",
    proxyAddress as `0x${string}`
  );

  // Check current version and owner
  console.log("📊 Current contract status:");
  const currentVersion = await proxy.read.version();
  const owner = await proxy.read.owner();
  const currentImpl = await proxy.read.getImplementation();

  console.log(`Current version: ${currentVersion}`);
  console.log(`Owner: ${owner}`);
  console.log(`Current implementation: ${currentImpl}\n`);

  // Verify deployer is owner
  if (owner.toLowerCase() !== deployer.account.address.toLowerCase()) {
    throw new Error(`Only owner can upgrade. Owner: ${owner}, Deployer: ${deployer.account.address}`);
  }

  // Deploy new implementation
  console.log("📦 Deploying new implementation contract...");
  const newImplementation = await hre.viem.deployContract("DeferredPaymentEscrowUpgradeable");
  console.log(`✅ New implementation deployed at: ${newImplementation.address}\n`);

  // Upgrade proxy to new implementation
  console.log("🔄 Upgrading proxy to new implementation...");

  const publicClient = await hre.viem.getPublicClient();

  // Call upgradeToAndCall (no initialization data needed for simple upgrades)
  const hash = await proxy.write.upgradeToAndCall([
    newImplementation.address,
    '0x' as `0x${string}`, // Empty bytes for no additional initialization
  ]);

  console.log(`Transaction hash: ${hash}`);
  console.log("⏳ Waiting for transaction confirmation...\n");

  // Wait for transaction
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === 'success') {
    console.log("✅ Upgrade successful!");
  } else {
    throw new Error("❌ Upgrade transaction failed");
  }

  // Verify upgrade
  console.log("\n🔍 Verifying upgrade...");
  const newImpl = await proxy.read.getImplementation();
  const newVersion = await proxy.read.version();

  console.log(`New implementation: ${newImpl}`);
  console.log(`New version: ${newVersion}`);

  if (newImpl.toLowerCase() === newImplementation.address.toLowerCase()) {
    console.log("✅ Implementation address updated correctly");
  } else {
    console.warn("⚠️ Implementation address mismatch!");
  }

  console.log("\n" + "=".repeat(60));
  console.log("UPGRADE SUMMARY");
  console.log("=".repeat(60));
  console.log(`Network: ${networkName}`);
  console.log(`Proxy: ${proxyAddress}`);
  console.log(`Old Implementation: ${currentImpl}`);
  console.log(`New Implementation: ${newImpl}`);
  console.log(`Old Version: ${currentVersion}`);
  console.log(`New Version: ${newVersion}`);
  console.log("=".repeat(60));

  // Verify new implementation on block explorer (if supported)
  if (networkName !== "hardhat" && networkName !== "localhost") {
    console.log("\n⏳ Waiting for block confirmations before verification...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log("\n🔍 Verifying new implementation on block explorer...");
    try {
      await hre.run("verify:verify", {
        address: newImplementation.address,
        constructorArguments: [],
      });
      console.log("✅ New implementation verified!");
    } catch (error: any) {
      console.log("⚠️ Verification failed:", error.message);
      console.log("\nYou can verify manually later with:");
      console.log(`npx hardhat verify --network ${networkName} ${newImplementation.address}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Upgrade failed:");
    console.error(error);
    process.exit(1);
  });
