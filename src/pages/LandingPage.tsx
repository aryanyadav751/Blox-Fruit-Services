import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Sparkles, 
  Sword, 
  Flame, 
  Search, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Coins, 
  HelpCircle 
} from 'lucide-react';
import { Service } from '../types/index.ts';
import { MarketTrendsWidget } from '../components/MarketTrendsWidget.tsx';

interface LandingPageProps {
  onNavigate: (path: string) => void;
  featuredServices: Service[];
  loadingServices: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
  onNavigate, 
  featuredServices, 
  loadingServices 
}) => {
  const [trackInput, setTrackInput] = useState('');
  const [trackError, setTrackError] = useState('');

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = trackInput.trim();
    if (!cleaned) {
      setTrackError('Please enter your order tracking token or BFS code');
      return;
    }
    setTrackError('');
    onNavigate(`/track?q=${encodeURIComponent(cleaned)}`);
  };

  return (
    <div className="space-y-16 pb-12">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-8 pb-12 sm:pt-16 sm:pb-20 border-b border-slate-900">
        {/* Subtle decorative background gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(245,158,11,0.12),rgba(255,255,255,0))]" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10 text-center space-y-6">
          {/* Unboxed natural header kicker (Anti-slop compliant: no pill enclosure, no green pulsing dot) */}
          <div className="text-xs uppercase tracking-widest text-amber-400 font-semibold">
            Roblox In-Game Service · 50/50 Deposit Escrow
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight max-w-4xl mx-auto leading-tight" style={{ textWrap: 'balance' }}>
            Blox Fruit Services Paid Exclusively With Fruit & Gamepass Trade Value
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Trials, Bosses, Raids, Sea Events, and Mythical Swords completed by experienced carries. 
            No real cash, no login passwords — pay using your extra in-game fruits and gamepasses.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onNavigate('/services')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-semibold text-sm text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors shadow-lg shadow-amber-400/10 active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Browse Services Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigate('/order')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-semibold text-sm text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors active:scale-95"
            >
              <span>Place Custom Order</span>
            </button>
          </div>

          {/* Quick Track Bar */}
          <div className="pt-6 max-w-md mx-auto">
            <form onSubmit={handleTrackSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={trackInput}
                  onChange={(e) => setTrackInput(e.target.value)}
                  placeholder="Enter order token or BFS code..."
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-xl border border-slate-700 transition-colors shrink-0"
              >
                Track
              </button>
            </form>
            {trackError && (
              <p className="text-[11px] text-rose-400 mt-1.5 text-left">{trackError}</p>
            )}
          </div>
        </div>
      </section>

      {/* 4 CORE PRINCIPLES / TRUST SIGNALS */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold">
              <Coins className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white">Trade Value (M) Only</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Never real money. All prices are denominated in Millions (M) of in-game trade value.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white">Combine Multiple Items</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Mix and match fruits and gamepasses together to reach the agreed target valuation.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white">50% Deposit Escrow</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              50% deposit upfront before starting. The remaining 50% is only paid after your carry is finished.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white">Zero Account Access</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              We never ask for passwords, cookies, or 2FA codes. All carries are done via in-game co-op.
            </p>
          </div>
        </div>
      </section>

      {/* LIVE MARKET TRENDS (TOP 5 MOST VOLATILE FRUITS VIA GEMINI RESEARCH) */}
      <MarketTrendsWidget onNavigate={onNavigate} />

      {/* FEATURED SERVICES PREVIEW */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-wider text-amber-400 font-semibold">
              Verified Catalog
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Popular Carry Services
            </h2>
          </div>
          <button
            onClick={() => onNavigate('/services')}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
          >
            <span>View All Services</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loadingServices ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Loading verified services...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredServices.slice(0, 6).map((service) => {
              const priceHundredths = service.priceHundredths;
              const depositHundredths = Math.floor((priceHundredths + 1) / 2);
              const depositM = (depositHundredths / 100).toFixed(2);

              return (
                <div
                  key={service.id}
                  className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{service.category}</span>
                      <span className="text-amber-400 font-mono font-bold text-sm">
                        {service.priceM}M Value
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-white">
                        {service.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {service.description}
                      </p>
                    </div>

                    <div className="text-[11px] text-slate-500 pt-1 space-y-1">
                      <div>
                        Deposit: <span className="text-slate-300 font-mono">{depositM}M</span> (50% upfront)
                      </div>
                      {service.prerequisites && (
                        <div className="truncate">
                          Prereq: <span className="text-slate-400">{service.prerequisites}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-800/60 flex items-center justify-between gap-3">
                    <button
                      onClick={() => onNavigate(`/services/${service.slug}`)}
                      className="text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      Details
                    </button>
                    <button
                      onClick={() => onNavigate(`/order?service=${service.id}`)}
                      className="px-3.5 py-1.5 bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg hover:bg-amber-300 transition-colors"
                    >
                      Order Service
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* HOW IT WORKS SECTION */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="bg-slate-900/40 border border-slate-800/70 rounded-3xl p-6 sm:p-10 space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <div className="text-xs uppercase tracking-wider text-amber-400 font-semibold">
              Step-by-step
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              How Blox Fruit Services Work
            </h2>
            <p className="text-xs text-slate-400">
              Straightforward and secure in-game carry process.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="text-amber-400 font-mono font-bold text-lg">01.</div>
              <h4 className="text-sm font-semibold text-white">Select Service</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Choose the trial, boss, raid, or quest you want completed from our published catalog.
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-amber-400 font-mono font-bold text-lg">02.</div>
              <h4 className="text-sm font-semibold text-white">Offer Items</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                List the fruits and gamepasses you offer to reach the target trade value. Multiple items accepted!
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-amber-400 font-mono font-bold text-lg">03.</div>
              <h4 className="text-sm font-semibold text-white">Staff Review & Escrow</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Staff verify item valuations manually and schedule the 50% deposit trade via the safe in-game trade window.
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-amber-400 font-mono font-bold text-lg">04.</div>
              <h4 className="text-sm font-semibold text-white">Carry & Finalize</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Join our private server or team party. Once your carry is fully completed, pay the remaining 50%.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-xs text-slate-400">
            Everything you need to know before ordering.
          </p>
        </div>

        <div className="space-y-3">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-1.5">
            <h4 className="text-sm font-semibold text-white">
              Can I pay with real money (USD, INR, PayPal)?
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              No. We strictly adhere to Roblox Terms of Service and only accept in-game fruits and gamepass trade values measured in Millions (M). Real-money checkout is strictly prohibited.
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-1.5">
            <h4 className="text-sm font-semibold text-white">
              Can I combine multiple fruits to reach the price?
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Yes! For example, if a service costs 45M, you could offer 1 Dough (25M) + 1 T-Rex (20M) to equal 45M. Our order form lets you add multiple items.
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-1.5">
            <h4 className="text-sm font-semibold text-white">
              Do you need my Roblox password or account login?
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Never. We will never ask for your password, pin, cookies, or 2FA codes. All carries are done co-op in a party inside the game.
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-1.5">
            <h4 className="text-sm font-semibold text-white">
              How does the 50% deposit work?
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              You trade 50% of the agreed trade value in-game before the carry begins. The remaining 50% is traded only after the trial, raid, or boss is finished to your satisfaction.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
