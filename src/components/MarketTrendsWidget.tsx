import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Flame, 
  Sparkles, 
  RefreshCw, 
  ShieldCheck, 
  ArrowRight, 
  AlertCircle,
  ExternalLink,
  Activity
} from 'lucide-react';
import { MarketTrendFruit } from '../types/index.ts';
import { api } from '../lib/api.ts';

interface MarketTrendsWidgetProps {
  onNavigate: (path: string) => void;
}

export const MarketTrendsWidget: React.FC<MarketTrendsWidgetProps> = ({ onNavigate }) => {
  const [trends, setTrends] = useState<MarketTrendFruit[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLiveGrounding, setIsLiveGrounding] = useState<boolean>(false);
  const [sourceNote, setSourceNote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await api.getMarketTrends(forceRefresh);
      setTrends(data.trends || []);
      setLastUpdated(data.lastUpdated || new Date().toISOString());
      setIsLiveGrounding(Boolean(data.isLiveGrounding));
      setSourceNote(data.source || 'Gemini Search Grounding');
    } catch (err: any) {
      console.error('Failed to load market trends:', err);
      setError('Unable to load live market trends right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrends(false);
  }, []);

  const formatRelativeTime = (isoString?: string | null) => {
    if (!isoString) return 'Just now';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins === 1) return '1 min ago';
      if (diffMins < 60) return `${diffMins} mins ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours === 1) return '1 hour ago';
      return `${diffHours} hours ago`;
    } catch {
      return 'Recently';
    }
  };

  const getVolatilityStyle = (volatility: string) => {
    switch (volatility) {
      case 'extreme':
        return {
          badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          label: 'Extreme Volatility',
          glow: 'from-rose-500/10 to-transparent',
        };
      case 'high':
        return {
          badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          label: 'High Volatility',
          glow: 'from-amber-500/10 to-transparent',
        };
      default:
        return {
          badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
          label: 'Moderate Volatility',
          glow: 'from-cyan-500/10 to-transparent',
        };
    }
  };

  const getTrendIcon = (trend: string, changePct: number) => {
    if (changePct >= 0) {
      return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
    }
    return <TrendingDown className="w-3.5 h-3.5 text-rose-400" />;
  };

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800/90 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* WIDGET HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
                <Activity className="w-3.5 h-3.5" />
                Live In-Game Economy
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-[11px] font-medium text-slate-400">
                Gemini Search Grounding
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>Top 5 Most Volatile Blox Fruits</span>
              <Flame className="w-5 h-5 text-amber-400" />
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Real-time trading valuations, market volatility, and community trade demand. Trade with volatile high-value fruits to cover your carry services faster.
            </p>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="text-right hidden sm:block">
              <div className="text-[11px] text-slate-400">
                Market Check: <span className="text-slate-200 font-mono">{formatRelativeTime(lastUpdated)}</span>
              </div>
              <div className="text-[10px] text-slate-500">
                {isLiveGrounding ? 'Google Search Grounded' : 'Verified Community Index'}
              </div>
            </div>

            <button
              onClick={() => fetchTrends(true)}
              disabled={refreshing || loading}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700/80 transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
              title="Re-verify market values via Gemini Search Grounding"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
              <span>{refreshing ? 'Researching...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 py-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-3 animate-pulse"
              >
                <div className="h-4 bg-slate-800 rounded w-2/3" />
                <div className="h-8 bg-slate-800 rounded w-1/2" />
                <div className="h-3 bg-slate-800 rounded w-full" />
                <div className="h-6 bg-slate-800 rounded w-full pt-2" />
              </div>
            ))}
          </div>
        )}

        {/* ERROR STATE */}
        {!loading && error && (
          <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="text-xs text-rose-300 font-medium">{error}</p>
            <button
              onClick={() => fetchTrends(true)}
              className="px-4 py-1.5 bg-slate-800 text-xs font-medium text-white rounded-lg hover:bg-slate-700"
            >
              Retry Live Research
            </button>
          </div>
        )}

        {/* CARDS GRID: TOP 5 VOLATILE FRUITS */}
        {!loading && !error && trends.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {trends.slice(0, 5).map((fruit, idx) => {
              const volStyle = getVolatilityStyle(fruit.volatility);
              const isPositive = fruit.changePercent >= 0;

              return (
                <div
                  key={fruit.name}
                  className="bg-slate-900/70 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between transition-all group relative overflow-hidden"
                >
                  {/* Top Gradient Highlight */}
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${volStyle.glow}`} />

                  {/* Top Row: Rank & Demand Badge */}
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-mono font-bold text-amber-400 text-xs bg-amber-400/10 px-2 py-0.5 rounded-md">
                      #{idx + 1}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                      {fruit.demandTier}
                    </span>
                  </div>

                  {/* Fruit Name & Category */}
                  <div className="space-y-0.5">
                    <h3 className="font-bold text-white text-sm group-hover:text-amber-300 transition-colors truncate">
                      {fruit.name}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {fruit.category}
                    </p>
                  </div>

                  {/* Big Valuation Display */}
                  <div className="my-3 py-2.5 px-3 bg-slate-950/70 rounded-xl border border-slate-800/80 space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                      Estimated Trade Value
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-extrabold font-mono text-amber-400 tracking-tight">
                        {fruit.currentValueM}M
                      </span>
                      <div className="flex items-center gap-0.5 text-xs font-semibold">
                        {getTrendIcon(fruit.trendDirection, fruit.changePercent)}
                        <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                          {isPositive ? '+' : ''}{fruit.changePercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Volatility & Trend Row */}
                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${volStyle.badge}`}>
                        {volStyle.label}
                      </span>
                      <span className="text-[10px] uppercase font-mono text-slate-400">
                        {fruit.trendDirection}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed h-8">
                      {fruit.marketReason}
                    </p>
                  </div>

                  {/* Action: Use in Order */}
                  <button
                    onClick={() => onNavigate(`/order?fruit=${encodeURIComponent(fruit.name)}`)}
                    className="w-full py-2 px-3 bg-slate-800 hover:bg-amber-400 text-slate-200 hover:text-slate-950 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95 border border-slate-700/80 hover:border-amber-400 shadow-sm"
                  >
                    <span>Use in Order</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* FOOTER CALLOUT / MARKET NOTES */}
        <div className="pt-3 border-t border-slate-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              All trade values are researched via Google Search Grounding with Gemini 3.8 Flash. Public bookings undergo staff review to lock final valuations.
            </span>
          </div>

          <button
            onClick={() => onNavigate('/services')}
            className="text-amber-400 hover:text-amber-300 font-medium shrink-0 flex items-center gap-1 transition-colors"
          >
            <span>View All Services</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </section>
  );
};
