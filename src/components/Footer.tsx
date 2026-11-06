import React from 'react';
import { ShieldCheck, AlertCircle, Sparkles, MessageSquare, ExternalLink, Activity } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-400 py-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Core Rules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div className="space-y-2">
            <h4 className="text-white font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>In-Game Trade Value Only</span>
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              This service operates exclusively on Roblox in-game trade values measured in Millions (M). 
              We never accept or ask for real currency (no USD, EUR, INR, cash, or real-money transfers).
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-white font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Zero Account Access & Passwords</span>
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              We will NEVER request your Roblox password, .ROBLOSECURITY cookies, or 2FA codes. 
              Carries take place in co-op parties with voluntary Discord gameplay window screen-sharing.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-white font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>50/50 Payment Escrow</span>
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              50% deposit upfront via in-game trade window, remaining 50% only when your carry is fully completed. 
              Combine multiple fruits and gamepasses to reach the agreed value.
            </p>
          </div>
        </div>

        {/* Quick Links Strip */}
        <div className="border-t border-slate-900 pt-6 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-6 text-slate-400">
            <a href="/services" className="hover:text-amber-400 transition-colors">Catalog</a>
            <a href="/ongoing" className="hover:text-amber-400 transition-colors">Active Queue</a>
            <a href="/proofs" className="hover:text-amber-400 transition-colors">Proofs Wall</a>
            <a href="/support" className="hover:text-amber-400 transition-colors">Customer Support</a>
            <a 
              href={import.meta.env.VITE_DISCORD_INVITE_URL || 'https://discord.gg/JeZSJZb2aA'} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <span>Discord Community</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="text-slate-500 text-[11px]">
            <span>Blox Fruit Services · Not affiliated with Roblox Corporation or Gamer Robot Inc.</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
