import React, { useState } from 'react';
import { ShieldCheck, Compass, ShoppingCart, Search, Lock, Menu, X, MessageSquare, Activity } from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isAdmin?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate, isAdmin = false }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (path: string) => {
    onNavigate(path);
    setMobileMenuOpen(false);
  };

  const isActive = (path: string) => {
    if (path === '/' && currentPath === '/') return true;
    if (path !== '/' && currentPath.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Brand Wordmark */}
        <button
          onClick={() => handleNav('/')}
          className="flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-md"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-base shadow-sm">
            BF
          </div>
          <span className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            Blox Fruit Services
          </span>
        </button>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-5 text-sm font-medium text-slate-300">
          <button
            onClick={() => handleNav('/services')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-white ${
              isActive('/services') ? 'text-amber-400 font-semibold' : ''
            }`}
          >
            Services Catalog
          </button>

          <button
            onClick={() => handleNav('/ongoing')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-white flex items-center gap-1.5 ${
              isActive('/ongoing') ? 'text-amber-400 font-semibold' : ''
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span>Active Carries</span>
          </button>

          <button
            onClick={() => handleNav('/proofs')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-white flex items-center gap-1.5 ${
              isActive('/proofs') ? 'text-amber-400 font-semibold' : ''
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Proofs Wall</span>
          </button>

          <button
            onClick={() => handleNav('/support')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-white flex items-center gap-1.5 ${
              isActive('/support') ? 'text-amber-400 font-semibold' : ''
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span>Support</span>
          </button>

          <button
            onClick={() => handleNav('/track')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-white ${
              isActive('/track') ? 'text-amber-400 font-semibold' : ''
            }`}
          >
            Track Order
          </button>

          <button
            onClick={() => handleNav(isAdmin ? '/admin' : '/admin/login')}
            className={`flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors hover:text-white ${
              isAdmin 
                ? 'text-amber-400 font-semibold bg-amber-400/10 px-2.5 py-1 rounded-md border border-amber-400/20' 
                : 'text-slate-400'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{isAdmin ? 'Staff Console' : 'Staff Login'}</span>
          </button>
        </nav>

        {/* Zone 3: CTA & Mobile Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href={import.meta.env.VITE_DISCORD_INVITE_URL || 'https://discord.gg/JeZSJZb2aA'}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            <span>Discord</span>
          </a>

          <button
            onClick={() => handleNav('/order')}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors shadow-sm whitespace-nowrap shrink-0 active:scale-95"
          >
            Book Carry
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 focus:outline-none"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 space-y-2">
          <button
            onClick={() => handleNav('/services')}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800 flex items-center gap-2"
          >
            <Compass className="w-4 h-4 text-amber-400" />
            <span>Services Catalog</span>
          </button>
          <button
            onClick={() => handleNav('/ongoing')}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800 flex items-center gap-2"
          >
            <Activity className="w-4 h-4 text-blue-400" />
            <span>Active Carries Queue</span>
          </button>
          <button
            onClick={() => handleNav('/proofs')}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800 flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Proofs Wall (Verified)</span>
          </button>
          <button
            onClick={() => handleNav('/support')}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800 flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <span>Customer Support & Discord</span>
          </button>
          <button
            onClick={() => handleNav('/order')}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800 flex items-center gap-2"
          >
            <ShoppingCart className="w-4 h-4 text-amber-400" />
            <span>Order Carry (Multi-Fruit / Gamepass)</span>
          </button>
          <button
            onClick={() => handleNav('/track')}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800 flex items-center gap-2"
          >
            <Search className="w-4 h-4 text-amber-400" />
            <span>Track Order Status</span>
          </button>
          <button
            onClick={() => handleNav('/admin')}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 flex items-center gap-2"
          >
            <Lock className="w-4 h-4 text-slate-400" />
            <span>Staff Portal</span>
          </button>
        </div>
      )}
    </header>
  );
};
