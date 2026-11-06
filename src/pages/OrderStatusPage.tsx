import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Copy, 
  Check, 
  ArrowRight,
  ExternalLink,
  Coins
} from 'lucide-react';
import { PublicOrder, OrderStatus } from '../types/index.ts';
import { api } from '../lib/api.ts';

interface OrderStatusPageProps {
  initialToken?: string | null;
  onNavigate: (path: string) => void;
}

const STATUS_METADATA: Record<OrderStatus, { label: string; color: string; desc: string }> = {
  pending_review: {
    label: 'Pending Review',
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    desc: 'Our staff are reviewing your proposed fruits/gamepasses to verify valuations.',
  },
  accepted: {
    label: 'Offer Accepted',
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    desc: 'Offer accepted! Staff will contact you on Roblox to trade the 50% deposit.',
  },
  more_info_needed: {
    label: 'More Info Needed',
    color: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    desc: 'Staff need clarification on your availability or item proposal.',
  },
  deposit_received: {
    label: 'Deposit Received (50%)',
    color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    desc: '50% deposit has been verified and received in-game. Carry is ready to run!',
  },
  in_progress: {
    label: 'Carry In Progress',
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    desc: 'Our carry team is currently running your trial, raid, boss, or quest.',
  },
  completed: {
    label: 'Service Completed',
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    desc: 'Carry is complete! Please meet staff in-game to trade the remaining 50% balance.',
  },
  fully_paid: {
    label: 'Fully Fulfilled & Paid',
    color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    desc: 'Both carry and all trade value payments are 100% completed. Thank you!',
  },
  rejected: {
    label: 'Offer Declined',
    color: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    desc: 'This item offer was declined. You may submit a new order with different items.',
  },
  cancelled: {
    label: 'Order Cancelled',
    color: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    desc: 'This order was cancelled.',
  },
};

const STEP_ORDER: OrderStatus[] = [
  'pending_review',
  'accepted',
  'deposit_received',
  'in_progress',
  'completed',
  'fully_paid',
];

export const OrderStatusPage: React.FC<OrderStatusPageProps> = ({ 
  initialToken, 
  onNavigate 
}) => {
  const [tokenInput, setTokenInput] = useState(initialToken || '');
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialToken) {
      loadOrder(initialToken);
    }
  }, [initialToken]);

  const loadOrder = async (token: string) => {
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOrderStatus(token.trim());
      setOrder(data);
    } catch (err: any) {
      setError(err.message || 'Order not found. Please check your tracking link.');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    loadOrder(tokenInput.trim());
  };

  const handleCopyLink = () => {
    if (!order) return;
    const url = `${window.location.origin}/track?token=${order.publicToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentStatusMeta = order ? STATUS_METADATA[order.status] : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-24">
      {/* Page Title */}
      <div className="space-y-1">
        <div className="text-xs uppercase tracking-wider text-amber-400 font-semibold">
          Public Order Tracker
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Track Your Carry Request
        </h1>
        <p className="text-xs text-slate-400">
          Enter your order security token or view your bookmarked status below.
        </p>
      </div>

      {/* Lookup Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
        <form onSubmit={handleLookupSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste your 32-character tracking token..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs rounded-xl transition-colors shrink-0 shadow-sm disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Check Status'}
          </button>
        </form>

        {error && (
          <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ORDER DETAILS VIEW */}
      {order && (
        <div className="space-y-6">
          {/* Main Status Header Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <span className="text-[11px] font-mono text-slate-500 uppercase">Order Code</span>
                <div className="text-2xl font-extrabold text-white font-mono tracking-tight">
                  {order.orderCode}
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex flex-col sm:items-end">
                <span className="text-[11px] text-slate-500 uppercase mb-1">Current Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${currentStatusMeta?.color}`}>
                  {currentStatusMeta?.label}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              {currentStatusMeta?.desc}
            </p>

            {/* Status Stepper (Progression bar) */}
            <div className="space-y-2 pt-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">
                Carry Progress
              </span>
              <div className="grid grid-cols-6 gap-1.5">
                {STEP_ORDER.map((stepKey, idx) => {
                  const currentIdx = STEP_ORDER.indexOf(order.status);
                  const isFinished = currentIdx >= idx;
                  const isCurrent = order.status === stepKey;

                  return (
                    <div key={stepKey} className="space-y-1 text-center">
                      <div
                        className={`h-2 rounded-full transition-colors ${
                          isFinished 
                            ? 'bg-amber-400' 
                            : 'bg-slate-800'
                        }`}
                      />
                      <span className={`text-[9px] block truncate ${isCurrent ? 'text-amber-400 font-bold' : 'text-slate-500'}`}>
                        {idx + 1}. {STATUS_METADATA[stepKey].label.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Service & Price Split Grid */}
            <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-mono">{order.serviceCategory}</span>
                  <h3 className="text-lg font-bold text-white">{order.serviceName}</h3>
                </div>
                <div className="font-mono text-amber-400 font-bold text-lg">
                  {order.totalPriceM}M Value
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-900 text-xs font-mono">
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
                  <span className="text-[10px] text-slate-500 block uppercase">50% Deposit (Upfront)</span>
                  <span className="text-sm font-bold text-amber-300">{order.depositM}M</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {order.payments.some(p => p.kind === 'deposit') ? '✓ Received by Staff' : 'Pending in-game trade'}
                  </span>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
                  <span className="text-[10px] text-slate-500 block uppercase">50% Remaining (On End)</span>
                  <span className="text-sm font-bold text-slate-300">{order.remainingM}M</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {order.payments.some(p => p.kind === 'remaining') ? '✓ Fully Settled' : 'Due upon completion'}
                  </span>
                </div>
              </div>
            </div>

            {/* In-Game Coordination Details */}
            <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 space-y-3 text-xs">
              <span className="text-xs font-semibold text-white uppercase tracking-wider block">
                Roblox Coordination Info
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-300">
                <div>
                  <span className="text-[10px] text-slate-500 block">Roblox Username</span>
                  <span className="font-mono font-bold text-white">{order.robloxUsername}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Timezone</span>
                  <span>{order.timezone}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Available Hours</span>
                  <span>{order.availability}</span>
                </div>
              </div>
            </div>

            {/* Offered Items Breakdown */}
            <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white uppercase tracking-wider">
                  Customer Offered Items
                </span>
                <span className="text-[11px] text-slate-400 capitalize">
                  Payment Type: {order.paymentType}
                </span>
              </div>

              <div className="divide-y divide-slate-900">
                {order.items.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-white font-medium">{item.itemName}</span>
                      <span className="text-slate-500 ml-2">×{item.quantity}</span>
                      {item.verified && (
                        <span className="ml-2 text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          Staff Verified
                        </span>
                      )}
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-slate-400 text-[11px]">Proposed: {item.proposedValueM}M</span>
                      {item.agreedValueM && (
                        <div className="text-amber-400 font-bold">
                          Agreed: {item.agreedValueM}M
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Public Activity Timeline */}
            <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 space-y-3">
              <span className="text-xs font-semibold text-white uppercase tracking-wider block">
                Order Activity Log
              </span>
              <div className="space-y-2.5">
                {order.timeline.map((event, idx) => (
                  <div key={idx} className="text-xs flex items-start gap-2.5 text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <div className="text-slate-300 font-medium">{event.note || event.action}</div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(event.createdAt).toLocaleString()} · {event.actor}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Discord Carry Proof & Coordination Banner */}
            <div className="bg-gradient-to-r from-indigo-950/40 to-slate-900 border border-indigo-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  Discord Proof & Meetup Coordination
                </span>
                <p className="text-[11px] text-slate-400">
                  Screenshots, video proof of completion, and live Roblox screen-sharing are coordinated manually via Discord. Join with Order Code <strong className="text-amber-400 font-mono">{order.orderCode}</strong>.
                </p>
              </div>
              <a
                href={import.meta.env.VITE_DISCORD_INVITE_URL || 'https://discord.gg/JeZSJZb2aA'}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
              >
                <span>Join Discord</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Copyable Bookmark URL */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Link Copied!' : 'Copy Private Tracking Link'}</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('/order')}
                className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-medium transition-colors"
              >
                Place Another Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
