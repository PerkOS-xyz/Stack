import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const networks = [
  { name: "avalanche-fuji", displayName: "Avalanche Fuji Testnet" },
  { name: "celo-sepolia", displayName: "Celo Sepolia Testnet" },
  { name: "base-sepolia", displayName: "Base Sepolia Testnet" },
];

async function deployToNetwork(network: string, displayName: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 Deploying to ${displayName}`);
  console.log("=".repeat(60));

  try {
    const { stdout, stderr } = await execAsync(`npx hardhat run scripts/deploy.ts --network ${network}`);
    console.log(stdout);
    if (stderr) console.error(stderr);
    return { network, success: true };
  } catch (error) {
    console.error(`❌ Failed to deploy to ${displayName}`);
    console.error(error);
    return { network, success: false, error };
  }
}

async function main() {
  console.log("🎯 Multi-Chain Deployment Script");
  console.log("Deploying DeferredPaymentEscrow to all testnets...\n");

  const results = [];

  for (const network of networks) {
    const result = await deployToNetwork(network.name, network.displayName);
    results.push(result);

    // Wait a bit between deployments
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  console.log(`\n\n${"=".repeat(60)}`);
  console.log("📊 Deployment Summary");
  console.log("=".repeat(60));

  results.forEach((result, index) => {
    const network = networks.find(n => n.name === result.network);
    const status = result.success ? "✅ Success" : "❌ Failed";
    console.log(`${index + 1}. ${network?.displayName}: ${status}`);
  });

  const successCount = results.filter(r => r.success).length;
  console.log(`\n✨ Deployed to ${successCount}/${networks.length} networks`);

  if (successCount < networks.length) {
    console.log("\n⚠️ Some deployments failed. Check the logs above for details.");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
