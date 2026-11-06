import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  ExternalLink, 
  Image as ImageIcon, 
  Video, 
  Monitor, 
  Lock, 
  Sparkles,
  Search,
  Filter,
  UserCheck
} from 'lucide-react';
import { ServiceEvidence } from '../types/index.ts';
import { api } from '../lib/api.ts';

interface ProofsPageProps {
  onNavigate: (path: string) => void;
}

export function ProofsPage({ onNavigate }: ProofsPageProps) {
  const [proofs, setProofs] = useState<ServiceEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    async function loadProofs() {
      try {
        const data = await api.getPublicProofs();
        if (mounted) {
          setProofs(data);
        }
      } catch (err) {
        console.error('Failed to load proofs:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    loadProofs();
    return () => { mounted = false; };
  }, []);

  const categories = ['all', 'Raids', 'Trials', 'Sea Events', 'Bosses'];

  const filteredProofs = proofs.filter(p => {
    const matchesCategory = selectedCategory === 'all' || 
      (p.serviceCategory && p.serviceCategory.toLowerCase() === selectedCategory.toLowerCase());
    const matchesSearch = !searchQuery || 
      (p.serviceName && p.serviceName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.robloxUsername && p.robloxUsername.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.orderCode && p.orderCode.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          Verified Completed Carries
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Proof of Completion Showcase
        </h1>
        <p className="text-sm sm:text-base text-slate-300">
          Real in-game completions carried out by our team. Every piece of proof displayed here has <strong>explicit customer consent</strong> and was reviewed and verified by staff.
        </p>
      </div>

      {/* Discord Proof Sharing Instruction Card */}
      <div className="bg-gradient-to-r from-indigo-950/60 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            Discord-Based Proof Management
          </div>
          <p className="text-xs text-slate-300">
            All carry screenshots, videos, and live Roblox screen-sharing are coordinated and shared directly in our Discord community. Only staff-reviewed proofs with customer consent appear on this public showcase.
          </p>
        </div>
        <a
          href={import.meta.env.VITE_DISCORD_INVITE_URL || 'https://discord.gg/JeZSJZb2aA'}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-md shadow-indigo-600/20"
        >
          <span>Join Discord Server</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Trust & Privacy Notice Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Strict Customer Consent Guarantee</h3>
            <p className="text-xs text-slate-400">
              Usernames and completion media are never published publicly without explicit customer opt-in and staff quality review.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('/order')}
          className="shrink-0 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-md shadow-amber-500/20"
        >
          Book Your Carry
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat === 'all' ? 'All Services' : cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search proof or player..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-amber-400 focus:outline-none text-xs text-white placeholder-slate-500"
          />
        </div>
      </div>

      {/* Proofs Grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 space-y-2">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs">Loading verified completion proofs...</p>
        </div>
      ) : filteredProofs.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center space-y-4 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <ImageIcon className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">No Public Proofs in this Category</h3>
          <p className="text-xs text-slate-400">
            Proofs are only showcased when the client gives explicit consent upon order completion. Be the first to feature on this wall!
          </p>
          <button
            onClick={() => onNavigate('/order')}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
          >
            Submit an Order
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProofs.map((proof) => (
            <div
              key={proof.id}
              className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-lg transition-all flex flex-col justify-between"
            >
              {/* Media Preview or Icon Header */}
              <div className="relative bg-slate-950 aspect-video flex items-center justify-center overflow-hidden border-b border-slate-800/80">
                {proof.mediaUrl && (proof.mediaUrl.startsWith('http') && (proof.mediaUrl.endsWith('.png') || proof.mediaUrl.endsWith('.jpg') || proof.mediaUrl.endsWith('.webp') || proof.mediaUrl.includes('images'))) ? (
                  <img
                    src={proof.mediaUrl}
                    alt={proof.serviceName || 'Carry completion proof'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-2">
                    {proof.evidenceType === 'video_link' ? (
                      <Video className="w-10 h-10 text-indigo-400" />
                    ) : proof.evidenceType === 'screen_share_session' ? (
                      <Monitor className="w-10 h-10 text-emerald-400" />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-amber-400" />
                    )}
                    <span className="text-xs text-slate-400 font-mono">
                      {proof.evidenceType === 'video_link'
                        ? 'Video Recording'
                        : proof.evidenceType === 'screen_share_session'
                        ? 'Live Screen-Share Session'
                        : 'Screenshot Verification'}
                    </span>
                  </div>
                )}

                <div className="absolute top-3 left-3">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-950/80 text-amber-300 border border-amber-500/30 backdrop-blur-sm">
                    {proof.serviceCategory || 'Carry'}
                  </span>
                </div>

                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 backdrop-blur-sm">
                  <CheckCircle2 className="w-3 h-3" />
                  Staff Verified
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono text-amber-400 font-medium">{proof.orderCode}</span>
                    <span>{new Date(proof.createdAt).toLocaleDateString()}</span>
                  </div>

                  <h3 className="text-base font-bold text-white line-clamp-1">
                    {proof.serviceName || 'Blox Fruit Service'}
                  </h3>

                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="text-slate-500">Player:</span>
                    <span className="font-semibold text-slate-200">{proof.robloxUsername || 'Consented Client'}</span>
                  </div>

                  {proof.notes && (
                    <p className="text-xs text-slate-400 italic line-clamp-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                      "{proof.notes}"
                    </p>
                  )}
                </div>

                {proof.mediaUrl && proof.mediaUrl.startsWith('http') && (
                  <div className="pt-2">
                    <a
                      href={proof.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors"
                    >
                      <span>View Full Evidence</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
