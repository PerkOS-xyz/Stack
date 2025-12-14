"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-blue-500/20 backdrop-blur-sm bg-slate-950/50 mt-16">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-gray-400 text-sm">
            © 2025 Stack. Open Source.
          </div>
          <div className="flex space-x-6">
            <a
              href="https://x402.gitbook.io/x402"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
            >
              Documentation
            </a>
            <a
              href="https://github.com/coinbase/x402"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
            >
              GitHub
            </a>
            <Link
              href="/api/v2/x402/health"
              className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
            >
              Status
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
