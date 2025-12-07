import hre from "hardhat";

async function main() {
  const networkName = hre.network.name;
  console.log(`Deploying DeferredPaymentEscrow to ${networkName}...`);

  const escrow = await hre.viem.deployContract("DeferredPaymentEscrow");

  console.log(`\n✅ DeferredPaymentEscrow deployed to: ${escrow.address}`);
  console.log(`Network: ${networkName}`);
  console.log(`Chain ID: ${hre.network.config.chainId}`);

  console.log("\n📝 Add this to your .env file:");

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
    case "celo-alfajores":
      envVarName += "CELO_ALFAJORES_ESCROW_ADDRESS";
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

  console.log(`${envVarName}=${escrow.address}`);
  console.log(`NEXT_PUBLIC_DEFERRED_ENABLED=true`);

  // Verify contract on explorer (if supported)
  if (networkName !== "hardhat" && networkName !== "localhost") {
    console.log("\n⏳ Waiting for block confirmations...");
    // Wait for a few blocks before verification
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log("\n🔍 Verifying contract on block explorer...");
    try {
      await hre.run("verify:verify", {
        address: escrow.address,
        constructorArguments: [],
      });
      console.log("✅ Contract verified!");
    } catch (error) {
      console.log("⚠️ Verification failed:", error);
      console.log("You can verify manually later with:");
      console.log(`npx hardhat verify --network ${networkName} ${escrow.address}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
