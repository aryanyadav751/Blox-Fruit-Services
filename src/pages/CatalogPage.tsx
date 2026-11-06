import React, { useState, useMemo } from 'react';
import { Search, Filter, ShieldCheck, ArrowRight, X, Info } from 'lucide-react';
import { Service } from '../types/index.ts';
import { calculateDepositAndRemaining } from '../lib/calculator.ts';

interface CatalogPageProps {
  services: Service[];
  loading: boolean;
  onNavigate: (path: string) => void;
  selectedServiceSlug?: string | null;
}

export const CatalogPage: React.FC<CatalogPageProps> = ({ 
  services, 
  loading, 
  onNavigate,
  selectedServiceSlug 
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalService, setModalService] = useState<Service | null>(null);

  // Extract distinct categories from published services
  const categories = useMemo(() => {
    const set = new Set<string>();
    services.forEach(s => set.add(s.category));
    return ['All', ...Array.from(set).sort()];
  }, [services]);

  // Filter services
  const filteredServices = useMemo(() => {
    return services.filter(service => {
      // Must be published!
      if (!service.isPublished) return false;

      const matchesCat = selectedCategory === 'All' || service.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        service.name.toLowerCase().includes(q) ||
        service.category.toLowerCase().includes(q) ||
        service.description.toLowerCase().includes(q) ||
        (service.prerequisites && service.prerequisites.toLowerCase().includes(q));

      return matchesCat && matchesSearch;
    });
  }, [services, selectedCategory, searchQuery]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-20">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-amber-400 font-semibold">
            Published Services Catalog
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300 font-medium flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            Market-Verified Trade Values
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Blox Fruit Carries & Quests
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
          Browse verified carry services. All prices are measured in Millions (M) of in-game trade value. 
          Every rate is researched against live online trading indexes and confirmed by senior administrators.
          50% deposit required upfront; remaining 50% only after full completion.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, category, boss, trial, sword or raid..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Total count badge */}
        <div className="text-xs text-slate-400 self-center">
          Showing <span className="text-white font-mono font-medium">{filteredServices.length}</span> published services
        </div>
      </div>

      {/* Category Tabs (Interactive Filter Controls) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 bg-slate-900/80 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Catalog Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 text-sm">
          Loading catalog...
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/30 border border-slate-800/80 rounded-2xl p-8 space-y-3">
          <Info className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-sm font-semibold text-white">No services found</h3>
          <p className="text-xs text-slate-400">
            No published services match your search or category filter.
          </p>
          <button
            onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }}
            className="text-xs text-amber-400 font-medium hover:underline"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service) => {
            const { depositString, remainingString } = calculateDepositAndRemaining(service.priceHundredths);

            return (
              <div
                key={service.id}
                className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-medium text-slate-400">{service.category}</span>
                    <span className="font-mono font-bold text-amber-400 text-sm">
                      {service.priceM}M Value
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-white">
                      {service.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed line-clamp-2">
                      {service.description}
                    </p>
                  </div>

                  {/* Nested Mutation Section for Hellfire Gas under Gas Fruit */}
                  {service.name.toLowerCase().includes('gas fruit') && (
                    <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Mutation Variant: Hellfire Gas
                        </span>
                        <span className="font-mono font-bold text-amber-300 text-xs">
                          ~220.00M Value
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-normal">
                        Parent Fruit: <strong className="text-slate-300">Gas Fruit</strong>. Researched mutation variant trading at premium over standard Gas. Permanent version: unverified/none.
                      </p>
                    </div>
                  )}

                  {/* Payment Breakdown Box */}
                  <div className="bg-slate-950/70 border border-slate-800/60 rounded-xl p-3 text-[11px] space-y-1.5 font-mono">
                    <div className="flex justify-between text-slate-300">
                      <span>50% Deposit Upfront:</span>
                      <span className="font-bold text-amber-300">{depositString}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>50% Remaining:</span>
                      <span>{remainingString}</span>
                    </div>
                  </div>

                  {/* Prerequisites */}
                  {service.prerequisites && (
                    <div className="text-[11px] text-slate-400 bg-slate-950/40 rounded-lg p-2 border border-slate-800/40">
                      <span className="text-slate-500 font-semibold block mb-0.5">Requirements:</span>
                      <span className="line-clamp-2">{service.prerequisites}</span>
                    </div>
                  )}

                  {/* Exclusions */}
                  {service.exclusions && (
                    <div className="text-[11px] text-slate-400 bg-slate-950/40 rounded-lg p-2 border border-slate-800/40">
                      <span className="text-slate-500 font-semibold block mb-0.5">Note:</span>
                      <span className="line-clamp-2">{service.exclusions}</span>
                    </div>
                  )}

                  {/* Market Verification Status Strip */}
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 font-mono">
                    <span>Verified: {new Date(service.updatedAt || service.createdAt).toLocaleDateString()}</span>
                    {service.needsConfirmation && (
                      <span className="text-amber-400 font-sans font-medium">Pending Final Review</span>
                    )}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800/60 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setModalService(service)}
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => onNavigate(`/order?service=${service.id}`)}
                    className="px-4 py-2 bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg hover:bg-amber-300 transition-colors shadow-sm active:scale-95"
                  >
                    Order Service
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Service Detail Modal */}
      {modalService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 relative shadow-xl">
            <button
              onClick={() => setModalService(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                {modalService.category}
              </span>
              <h2 className="text-xl font-bold text-white">
                {modalService.name}
              </h2>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {modalService.description}
            </p>

            {/* Price Schedule */}
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2 text-xs">
              <div className="text-xs font-semibold text-white uppercase tracking-wider">
                Payment Schedule (50/50 Escrow)
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900 text-slate-300 font-mono">
                <span>Total Service Value:</span>
                <span className="font-bold text-white">{modalService.priceM}M</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900 text-amber-300 font-mono">
                <span>50% Deposit (Upfront via In-Game Trade):</span>
                <span className="font-bold">
                  {calculateDepositAndRemaining(modalService.priceHundredths).depositString}
                </span>
              </div>
              <div className="flex justify-between py-1 text-slate-400 font-mono">
                <span>50% Remaining (Due on Completion):</span>
                <span>
                  {calculateDepositAndRemaining(modalService.priceHundredths).remainingString}
                </span>
              </div>
            </div>

            {/* Prerequisites */}
            {modalService.prerequisites && (
              <div className="text-xs space-y-1">
                <div className="font-semibold text-slate-300">Prerequisites:</div>
                <div className="text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 leading-relaxed">
                  {modalService.prerequisites}
                </div>
              </div>
            )}

            {/* Exclusions */}
            {modalService.exclusions && (
              <div className="text-xs space-y-1">
                <div className="font-semibold text-slate-300">Exclusions / Clarifications:</div>
                <div className="text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 leading-relaxed">
                  {modalService.exclusions}
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                onClick={() => setModalService(null)}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const id = modalService.id;
                  setModalService(null);
                  onNavigate(`/order?service=${id}`);
                }}
                className="px-5 py-2.5 bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl hover:bg-amber-300 transition-colors shadow-sm"
              >
                Proceed to Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
