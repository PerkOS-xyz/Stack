"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-pink-500/20 backdrop-blur-sm bg-[#0E0716]/50 mt-16">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-gray-400 text-sm">
            &copy; {new Date().getFullYear()} PerkOS Stack
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <a
              href="https://perkos.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-pink-400 transition-colors text-sm"
            >
              PerkOS
            </a>
            <a
              href="https://x402.gitbook.io/x402"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-pink-400 transition-colors text-sm"
            >
              Documentation
            </a>
            <a
              href="https://github.com/PerkOS-xyz/Stack"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-pink-400 transition-colors text-sm"
            >
              GitHub
            </a>
            <Link
              href="/api/v2/x402/health"
              className="text-gray-400 hover:text-pink-400 transition-colors text-sm"
            >
              Status
            </Link>
            <a
              href="https://x.com/perk_os"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-pink-400 transition-colors text-sm"
            >
              X
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
