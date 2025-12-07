import hre from "hardhat";

async function main() {
  const networkName = hre.network.name;
  console.log(`\n🚀 Deploying Upgradeable DeferredPaymentEscrow to ${networkName}...`);
  console.log(`Chain ID: ${hre.network.config.chainId}\n`);

  // Get deployer account
  const [deployer] = await hre.viem.getWalletClients();
  console.log(`Deployer address: ${deployer.account.address}\n`);

  // Deploy upgradeable contract using UUPS proxy pattern
  console.log("📦 Deploying implementation contract...");
  const implementation = await hre.viem.deployContract("DeferredPaymentEscrowUpgradeable");
  console.log(`✅ Implementation deployed at: ${implementation.address}`);

  // Prepare initialization data
  const initializeData = hre.viem.encodeFunctionData({
    abi: implementation.abi,
    functionName: 'initialize',
    args: [deployer.account.address], // Owner address
  });

  // Deploy ERC1967 Proxy
  console.log("\n📦 Deploying UUPS Proxy...");
  const proxy = await hre.viem.deployContract("ERC1967Proxy", [
    implementation.address,
    initializeData,
  ]);
  console.log(`✅ Proxy deployed at: ${proxy.address}`);

  // Get proxy contract instance
  const escrow = await hre.viem.getContractAt(
    "DeferredPaymentEscrowUpgradeable",
    proxy.address
  );

  // Verify deployment
  console.log("\n🔍 Verifying deployment...");
  const version = await escrow.read.version();
  const owner = await escrow.read.owner();
  console.log(`Contract version: ${version}`);
  console.log(`Contract owner: ${owner}`);

  console.log("\n✅ Deployment successful!");
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(`Network: ${networkName}`);
  console.log(`Chain ID: ${hre.network.config.chainId}`);
  console.log(`Implementation: ${implementation.address}`);
  console.log(`Proxy (Use this address): ${proxy.address}`);
  console.log(`Owner: ${owner}`);
  console.log(`Version: ${version}`);
  console.log("=".repeat(60));

  console.log("\n📝 Add this to your .env file:");
  console.log("=".repeat(60));

  // Generate appropriate env var name based on network
  let envVarName = "NEXT_PUBLIC_";
  switch (networkName) {
    case "avalanche":
      envVarName += "AVALANCHE_ESCROW_ADDRESS";
      break;
    case "avalanche-fuji":
      envVarName += "AVALANCHE_FUJI_ESCROW_ADDRESS";
      break;
    case "celo":
      envVarName += "CELO_ESCROW_ADDRESS";
      break;
    case "celo-sepolia":
      envVarName += "CELO_SEPOLIA_ESCROW_ADDRESS";
      break;
    case "base":
      envVarName += "BASE_ESCROW_ADDRESS";
      break;
    case "base-sepolia":
      envVarName += "BASE_SEPOLIA_ESCROW_ADDRESS";
      break;
    default:
      envVarName += "ESCROW_ADDRESS";
  }

  console.log(`${envVarName}=${proxy.address}`);
  console.log(`NEXT_PUBLIC_DEFERRED_ENABLED=true`);
  console.log("=".repeat(60));

  // Verify contracts on block explorer (if supported)
  if (networkName !== "hardhat" && networkName !== "localhost") {
    console.log("\n⏳ Waiting for block confirmations before verification...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log("\n🔍 Verifying implementation contract on block explorer...");
    try {
      await hre.run("verify:verify", {
        address: implementation.address,
        constructorArguments: [],
      });
      console.log("✅ Implementation contract verified!");
    } catch (error: any) {
      console.log("⚠️ Implementation verification failed:", error.message);
      console.log("\nYou can verify manually later with:");
      console.log(`npx hardhat verify --network ${networkName} ${implementation.address}`);
    }

    console.log("\n🔍 Verifying proxy contract on block explorer...");
    try {
      await hre.run("verify:verify", {
        address: proxy.address,
        constructorArguments: [implementation.address, initializeData],
      });
      console.log("✅ Proxy contract verified!");
    } catch (error: any) {
      console.log("⚠️ Proxy verification failed:", error.message);
      console.log("\nYou can verify manually later with:");
      console.log(`npx hardhat verify --network ${networkName} ${proxy.address} ${implementation.address} ${initializeData}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("UPGRADE INSTRUCTIONS");
  console.log("=".repeat(60));
  console.log("To upgrade this contract in the future:");
  console.log("1. Deploy new implementation contract");
  console.log("2. Call upgradeToAndCall() on the proxy:");
  console.log(`   Proxy address: ${proxy.address}`);
  console.log("3. Only the owner can perform upgrades");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
