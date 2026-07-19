"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  createPublicClient,
  http,
  parseEventLogs,
  type Address,
  type Hex,
} from "viem";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useWalletClient, useWalletContext } from "@/lib/wallet/client";
import { getChainByNetwork } from "@/lib/utils/chains";
import { IDENTITY_REGISTRY_ABI } from "@/lib/contracts/erc8004";

const REGISTRATION_TYPE = "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";

const networkOptions = [
  { value: "monad-testnet", label: "Monad Testnet" },
  { value: "base-sepolia", label: "Base Sepolia" },
  { value: "celo-sepolia", label: "Celo Sepolia" },
  { value: "avalanche-fuji", label: "Avalanche Fuji" },
  { value: "monad", label: "Monad" },
  { value: "base", label: "Base" },
  { value: "celo", label: "Celo" },
  { value: "avalanche", label: "Avalanche" },
] as const;

interface PreparedTransaction {
  to: Address;
  data: Hex;
  chainId: number;
}

interface RegistrationEntry {
  agentId: number;
  agentRegistry: string;
}

export default function RegisterAgentPage() {
  const [network, setNetwork] = useState("monad-testnet");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [agentCard, setAgentCard] = useState("");
  const [image, setImage] = useState("");
  const [x402Support, setX402Support] = useState(true);
  const [status, setStatus] = useState("Ready to prepare registration.");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    agentId: number;
    mintHash: Hex;
    metadataHash?: Hex;
    scanUrl?: string;
    indexed?: boolean;
  } | null>(null);

  const chain = useMemo(() => getChainByNetwork(network), [network]);
  const wallet = useWalletContext();
  const { walletClient, canSign } = useWalletClient({ chain: chain! });

  async function createMetadataUri(registrations: RegistrationEntry[]) {
    if (!chain || !wallet.address?.startsWith("0x")) throw new Error("Connect an EVM wallet first.");
    const services: Array<Record<string, string>> = [{ name: "web", endpoint: website }];
    if (agentCard) services.push({ name: "A2A", endpoint: agentCard, version: "0.3.0" });
    services.push({ name: "agentWallet", endpoint: `eip155:${chain.id}:${wallet.address}` });
    if (x402Support) {
      services.push({
        name: "x402-supported",
        endpoint: `${window.location.origin}/api/v2/x402/supported`,
        version: "2",
      });
    }

    const metadata = {
      type: REGISTRATION_TYPE,
      name,
      description,
      ...(image ? { image } : {}),
      services,
      registrations,
      supportedTrust: ["reputation"],
      x402Support,
      active: true,
    };
    const response = await fetch("/api/erc8004/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not create registration metadata.");
    return payload.agentURI as string;
  }

  async function sendPreparedTransaction(transaction: PreparedTransaction) {
    if (!chain || !wallet.address?.startsWith("0x") || !walletClient) {
      throw new Error("The connected wallet is not ready to sign an EVM transaction.");
    }
    if (wallet.chainId !== chain.id && wallet.switchChain) {
      setStatus(`Switching wallet to ${chain.name}…`);
      await wallet.switchChain(chain.id);
    }
    return walletClient.sendTransaction({
      account: wallet.address as Address,
      chain,
      to: transaction.to,
      data: transaction.data,
      value: 0n,
    });
  }

  async function register(event: FormEvent) {
    event.preventDefault();
    if (!wallet.isConnected) {
      wallet.openModal();
      return;
    }
    if (!chain || !canSign || !walletClient) {
      setStatus("Wallet is still preparing. Try again in a moment.");
      return;
    }

    setBusy(true);
    setResult(null);
    try {
      setStatus("Validating registration metadata…");
      const initialUri = await createMetadataUri([]);
      const preparedResponse = await fetch("/api/v2/agents/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network,
          tokenURI: initialUri,
          paymentReceiver: wallet.address,
        }),
      });
      const prepared = await preparedResponse.json();
      if (!preparedResponse.ok || !prepared.registration?.data) {
        throw new Error(prepared.error || "Stack could not prepare the mint transaction.");
      }

      setStatus("Confirm the ERC-8004 identity mint in your wallet…");
      const mintHash = await sendPreparedTransaction(prepared.registration as PreparedTransaction);
      setStatus("Waiting for the identity mint to confirm…");
      const publicClient = createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) });
      const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });
      if (mintReceipt.status !== "success") throw new Error("The identity mint reverted.");

      const events = parseEventLogs({
        abi: IDENTITY_REGISTRY_ABI,
        logs: mintReceipt.logs,
        eventName: "Registered",
        strict: false,
      });
      const registeredEvent = events[0];
      if (!registeredEvent || !("agentId" in registeredEvent.args)) {
        throw new Error("Mint confirmed, but Stack could not read the new agent ID.");
      }
      const agentId = Number(registeredEvent.args.agentId);
      const registry = `eip155:${chain.id}:${prepared.registration.to}`;

      setStatus("Confirm one metadata update so 8004scan can verify the registration backlink…");
      const finalUri = await createMetadataUri([{ agentId, agentRegistry: registry }]);
      const updateResponse = await fetch("/api/erc8004/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network, action: "setURI", agentId, newURI: finalUri }),
      });
      const update = await updateResponse.json();
      if (!updateResponse.ok || !update.transaction?.data) {
        throw new Error(update.error || "Could not prepare the registration backlink update.");
      }
      const metadataHash = await sendPreparedTransaction(update.transaction as PreparedTransaction);
      const metadataReceipt = await publicClient.waitForTransactionReceipt({ hash: metadataHash });
      if (metadataReceipt.status !== "success") throw new Error("The metadata backlink update reverted.");

      setStatus("Registration complete. Checking 8004scan indexing…");
      const discoveryResponse = await fetch(`/api/v2/agents/discovery?chainId=${chain.id}&agentId=${agentId}`);
      const discovery = await discoveryResponse.json();
      setResult({
        agentId,
        mintHash,
        metadataHash,
        scanUrl: discovery.erc8004scan?.url,
        indexed: discovery.erc8004scan?.indexed === true,
      });
      setStatus(discovery.erc8004scan?.indexed
        ? "Registration complete and already indexed by 8004scan."
        : "Registration complete. 8004scan indexing is pending; no extra transaction is required.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-pink-500";

  return (
    <div className="min-h-screen bg-[#0E0716] text-white flex flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
        <Link href="/agents" className="text-sm text-pink-300 hover:text-pink-200">← Back to agents</Link>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.25fr_.75fr]">
          <section className="rounded-2xl border border-pink-500/20 bg-slate-900/60 p-6 md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-400">ERC-8004 registration</p>
            <h1 className="mt-3 text-3xl font-bold md:text-4xl">Give your agent a verifiable on-chain identity</h1>
            <p className="mt-3 text-slate-400">Stack prepares the official registry calls, hosts immutable registration-v1 metadata, and checks 8004scan indexing. You retain custody and approve every transaction.</p>

            <form onSubmit={register} className="mt-8 space-y-5">
              <label className="block text-sm text-slate-300">Network
                <select value={network} onChange={(event) => setNetwork(event.target.value)} className={inputClass} disabled={busy}>
                  {networkOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="block text-sm text-slate-300">Agent name
                <input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} className={inputClass} placeholder="My autonomous agent" disabled={busy} />
              </label>
              <label className="block text-sm text-slate-300">Description
                <textarea required maxLength={4000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} className={inputClass} placeholder="What the agent does and who should use it" disabled={busy} />
              </label>
              <label className="block text-sm text-slate-300">Public website or service URL
                <input required type="url" value={website} onChange={(event) => setWebsite(event.target.value)} className={inputClass} placeholder="https://agent.example" disabled={busy} />
              </label>
              <label className="block text-sm text-slate-300">A2A Agent Card URL <span className="text-slate-500">(optional)</span>
                <input type="url" value={agentCard} onChange={(event) => setAgentCard(event.target.value)} className={inputClass} placeholder="https://agent.example/.well-known/agent-card.json" disabled={busy} />
              </label>
              <label className="block text-sm text-slate-300">Image URL <span className="text-slate-500">(optional)</span>
                <input type="url" value={image} onChange={(event) => setImage(event.target.value)} className={inputClass} placeholder="https://agent.example/icon.png" disabled={busy} />
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-300">
                <input type="checkbox" checked={x402Support} onChange={(event) => setX402Support(event.target.checked)} className="mt-1" disabled={busy} />
                <span>Publish x402 payment support and use the connected wallet as the verified agent wallet.</span>
              </label>
              <button type="submit" disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-orange-500 px-5 py-3 font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                {!wallet.isConnected ? "Connect wallet to continue" : busy ? "Registration in progress…" : "Register agent"}
              </button>
            </form>
          </section>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-blue-500/20 bg-slate-900/60 p-6">
              <h2 className="text-lg font-semibold">Registration status</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{status}</p>
              {result && (
                <div className="mt-5 space-y-2 rounded-xl bg-slate-950/70 p-4 text-sm">
                  <p>Agent ID: <span className="font-mono text-pink-300">{result.agentId}</span></p>
                  <p>Mint: <span className="font-mono text-slate-400">{result.mintHash.slice(0, 12)}…</span></p>
                  {result.scanUrl && <a href={result.scanUrl} target="_blank" rel="noreferrer" className="inline-block text-blue-300 hover:text-blue-200">Open in 8004scan ↗</a>}
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-6 text-sm leading-6 text-slate-300">
              <h2 className="text-lg font-semibold text-white">What you will sign</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5">
                <li>Mint the ERC-8004 identity NFT in the official registry.</li>
                <li>Update its URI with the final registry and agent-ID backlink required for reliable indexing.</li>
              </ol>
              <p className="mt-3 text-slate-400">Stack never receives a private key and does not submit either transaction for you.</p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900/40 p-6 text-sm text-slate-400">
              <p className="font-semibold text-white">Discovery reality</p>
              <p className="mt-2">8004scan is automatic after a valid official mint. A2A, MCP Registry, and x402 Bazaar require separate working protocol endpoints; Stack reports those requirements instead of claiming registration prematurely.</p>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
