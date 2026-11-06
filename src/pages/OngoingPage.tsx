import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Clock, 
  Shield, 
  Monitor, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { OngoingServiceItem } from '../types/index.ts';
import { api } from '../lib/api.ts';

interface OngoingPageProps {
  onNavigate: (path: string) => void;
}

export function OngoingPage({ onNavigate }: OngoingPageProps) {
  const [activeCarries, setActiveCarries] = useState<OngoingServiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCarries = async () => {
    try {
      setLoading(true);
      const data = await api.getOngoingCarries();
      setActiveCarries(data);
    } catch (err) {
      console.error('Failed to load ongoing carries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCarries();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            In Progress (In-Game)
          </span>
        );
      case 'deposit_received':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            50% Deposit Received (Scheduled)
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            Offer Accepted (Awaiting Deposit)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs bg-slate-800 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider">
          <Activity className="w-4 h-4" />
          Live Carry Queue
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Ongoing Services & Live Progress
        </h1>
        <p className="text-sm sm:text-base text-slate-300">
          Track our active queue of carries in real-time. For customer privacy, Roblox usernames are anonymized unless explicit public consent was granted during booking.
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Non-Custodial In-Game Safe Progress</h3>
            <p className="text-xs text-slate-400">
              Only 50% deposit is paid before carry starts. Remaining 50% is traded only after completion is confirmed.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCarries}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Refresh active queue"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate('/order')}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-md shadow-amber-500/20 whitespace-nowrap"
          >
            Request a Slot
          </button>
        </div>
      </div>

      {/* Carries List */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 space-y-2">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs">Fetching active carry roster...</p>
        </div>
      ) : activeCarries.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center space-y-4 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">No Active Carries Currently in Queue</h3>
          <p className="text-xs text-slate-400">
            All recent orders have been completed! Our carry operators have immediate availability right now.
          </p>
          <button
            onClick={() => onNavigate('/order')}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
          >
            Book Next Available Slot
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {activeCarries.map((carry) => (
              <div
                key={carry.orderCode}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 sm:p-6 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-amber-400">
                      {carry.orderCode}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {carry.serviceCategory}
                    </span>
                    {carry.hasLiveScreenShare && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <Monitor className="w-3 h-3" />
                        Live Discord Screen-Share
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-white">
                    {carry.serviceName}
                  </h3>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                    <div>
                      Client: <span className="text-slate-200 font-semibold">{carry.robloxUsernameDisplay}</span>
                    </div>
                    <div>
                      Payment: <span className="capitalize text-slate-200 font-medium">{carry.paymentType}</span>
                    </div>
                    <div>
                      Updated: <span className="text-slate-300">{new Date(carry.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-start md:self-center">
                  {getStatusBadge(carry.status)}
                  <button
                    onClick={() => onNavigate(`/track?q=${carry.orderCode}`)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Track order status"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
