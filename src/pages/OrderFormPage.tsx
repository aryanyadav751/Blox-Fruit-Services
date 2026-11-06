import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Copy, 
  ExternalLink,
  Sparkles,
  Info
} from 'lucide-react';
import { Service, ProposedItem } from '../types/index.ts';
import { 
  toHundredths, 
  toMillionString, 
  calculateDepositAndRemaining, 
  calculateItemsTotal, 
  validatePaymentCoverage 
} from '../lib/calculator.ts';
import { api, CreateOrderResponse } from '../lib/api.ts';
import { auth, signInWithGoogle } from '../lib/firebase.ts';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

interface OrderFormPageProps {
  services: Service[];
  preselectedServiceId?: string | null;
  preselectedFruit?: string | null;
  onNavigate: (path: string) => void;
}

const COMMON_FRUIT_PRESETS = [
  // Regular Physical Fruits
  { name: 'Dragon Fruit (West)', estimateM: 850 },
  { name: 'Kitsune Fruit', estimateM: 570 },
  { name: 'Yeti Fruit', estimateM: 250 },
  { name: 'Gas Fruit', estimateM: 180 },
  { name: 'Control Fruit', estimateM: 150 },
  { name: 'Leopard Fruit', estimateM: 55 },
  { name: 'Dough Fruit', estimateM: 35 },
  { name: 'Venom Fruit', estimateM: 25 },
  { name: 'T-Rex Fruit', estimateM: 20 },
  { name: 'Portal Fruit', estimateM: 15 },
  { name: 'Buddha Fruit', estimateM: 15 },
  { name: 'Mammoth Fruit', estimateM: 12.5 },
  { name: 'Spirit Fruit', estimateM: 12 },
  { name: 'Shadow Fruit', estimateM: 8 },
  { name: 'Blizzard Fruit', estimateM: 5 },
  { name: 'Rumble Fruit', estimateM: 5 },
  { name: 'Phoenix Fruit', estimateM: 3.5 },
  { name: 'Sound Fruit', estimateM: 3 },
  { name: 'Magma Fruit', estimateM: 1.5 },
  { name: 'Light Fruit', estimateM: 1 },

  // Permanent Fruits
  { name: 'Permanent Dragon (West)', estimateM: 3000 },
  { name: 'Permanent Kitsune', estimateM: 2300 },
  { name: 'Permanent Yeti', estimateM: 1700 },
  { name: 'Permanent Gas', estimateM: 1600 },
  { name: 'Permanent Dough', estimateM: 1400 },
  { name: 'Permanent Control', estimateM: 1000 },
  { name: 'Permanent Spirit', estimateM: 900 },
  { name: 'Permanent Venom', estimateM: 800 },
  { name: 'Permanent Shadow', estimateM: 700 },
  { name: 'Permanent Portal', estimateM: 650 },
  { name: 'Permanent Buddha', estimateM: 500 },
  { name: 'Permanent Blizzard', estimateM: 350 },
  { name: 'Permanent Phoenix', estimateM: 360 },
  { name: 'Permanent Sound', estimateM: 250 },
  { name: 'Permanent Light', estimateM: 90 },

  // Gamepasses
  { name: 'Fruit Notifier Gamepass', estimateM: 3320 },
  { name: 'Mythical Scrolls Gamepass', estimateM: 1290 },
  { name: 'Dark Blade Gamepass', estimateM: 930 },
  { name: 'Legendary Scrolls Gamepass', estimateM: 600 },
  { name: '2x Mastery Gamepass', estimateM: 390 },
  { name: '2x Money Gamepass', estimateM: 390 },
  { name: '+1 Fruit Storage Gamepass', estimateM: 360 },
  { name: 'Fast Boats Gamepass', estimateM: 250 },
  { name: '2x Boss Drops Gamepass', estimateM: 240 },
];

export const OrderFormPage: React.FC<OrderFormPageProps> = ({
  services,
  preselectedServiceId,
  preselectedFruit,
  onNavigate,
}) => {
  // Wizard step: 1: Service, 2: Roblox Info, 3: Payment Items, 4: Review, 5: Confirmed
  const [step, setStep] = useState<number>(1);

  // Form State
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [robloxUsername, setRobloxUsername] = useState('');
  const [timezone, setTimezone] = useState('');
  const [availability, setAvailability] = useState('');
  const [paymentType, setPaymentType] = useState<'fruits' | 'gamepass' | 'combination'>('fruits');
  const [items, setItems] = useState<ProposedItem[]>([
    { itemName: '', quantity: 1, proposedValueM: '' },
  ]);
  const [customerNote, setCustomerNote] = useState('');
  const [consentPublicProofs, setConsentPublicProofs] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [signingInGoogle, setSigningInGoogle] = useState(false);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<CreateOrderResponse | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Set initial service
  useEffect(() => {
    if (preselectedServiceId && services.some(s => s.id === preselectedServiceId)) {
      setSelectedServiceId(preselectedServiceId);
    } else if (services.length > 0 && !selectedServiceId) {
      setSelectedServiceId(services[0].id);
    }
  }, [preselectedServiceId, services]);

  // Set initial fruit if arrived via Market Trends widget
  useEffect(() => {
    if (preselectedFruit) {
      const match = services.find(s => s.name.toLowerCase() === preselectedFruit.toLowerCase())
        || COMMON_FRUIT_PRESETS.find(p => p.name.toLowerCase() === preselectedFruit.toLowerCase());
      const valM = match ? (('priceM' in match) ? match.priceM : String(match.estimateM)) : '';

      setItems([{
        itemName: preselectedFruit,
        quantity: 1,
        proposedValueM: valM,
      }]);
    }
  }, [preselectedFruit, services]);

  const selectedService = useMemo(() => {
    return services.find(s => s.id === selectedServiceId) || null;
  }, [services, selectedServiceId]);

  // Dynamic presets loaded directly from the database catalogue (In-Game Fruits & Gamepasses)
  const catalogPresets = useMemo(() => {
    const dbItems = services.filter(s => s.isPublished && (s.category === 'Fruits' || s.category === 'Gamepasses'));
    if (dbItems.length > 0) {
      return dbItems.map(s => ({
        name: s.name,
        estimateM: parseFloat(s.priceM) || 0,
        category: s.category,
      }));
    }
    return COMMON_FRUIT_PRESETS.map(p => ({
      ...p,
      category: p.name.includes('Gamepass') ? 'Gamepasses' : 'Fruits',
    }));
  }, [services]);

  // Lookup map of official catalogue items
  const catalogLookup = useMemo(() => {
    const map = new Map<string, Service>();
    services.forEach(s => {
      map.set(s.name.toLowerCase().trim(), s);
    });
    return map;
  }, [services]);

  // Math calculations
  const servicePriceHundredths = selectedService ? selectedService.priceHundredths : 0;
  const { depositHundredths, remainingHundredths, depositString, remainingString, totalString } = 
    calculateDepositAndRemaining(servicePriceHundredths);

  const { totalProposedHundredths, totalProposedString } = calculateItemsTotal(
    items.map(i => ({
      itemName: i.itemName,
      quantity: i.quantity,
      proposedValueM: i.proposedValueM,
    }))
  );

  const coverage = validatePaymentCoverage(servicePriceHundredths, totalProposedHundredths);

  // Item list handlers
  const handleAddItem = (preset?: { name: string; estimateM: number }) => {
    setItems([
      ...items,
      {
        itemName: preset ? preset.name : '',
        quantity: 1,
        proposedValueM: preset ? preset.estimateM.toString() : '',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setItems([{ itemName: '', quantity: 1, proposedValueM: '' }]);
      return;
    }
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  const handleItemChange = (index: number, field: keyof ProposedItem, value: any) => {
    const updated = [...items];
    if (field === 'itemName') {
      const match = catalogLookup.get(String(value).toLowerCase().trim());
      if (match) {
        // Enforce official database catalogue value: customer cannot modify official catalogue prices
        updated[index] = {
          ...updated[index],
          itemName: match.name,
          proposedValueM: match.priceM,
        };
        setItems(updated);
        return;
      }
    }
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  // Step validation
  const validateStep = (current: number): boolean => {
    setSubmitError(null);
    if (current === 1) {
      if (!selectedService) {
        setSubmitError('Please select a service from the catalog.');
        return false;
      }
      return true;
    }

    if (current === 2) {
      const cleanUser = robloxUsername.trim();
      if (!cleanUser) {
        setSubmitError('Please enter your Roblox username.');
        return false;
      }
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUser)) {
        setSubmitError('Roblox usernames must be 3-20 letters, numbers, or underscores.');
        return false;
      }
      if (!timezone.trim()) {
        setSubmitError('Please specify your timezone (e.g. EST, UTC, PST, IST).');
        return false;
      }
      if (!availability.trim()) {
        setSubmitError('Please describe your available play hours (e.g. Weekdays 6pm-10pm).');
        return false;
      }
      return true;
    }

    if (current === 3) {
      const validItems = items.filter(i => i.itemName.trim() !== '');
      if (validItems.length === 0) {
        setSubmitError('Please list at least one fruit or gamepass offered for payment.');
        return false;
      }
      for (const item of validItems) {
        const val = parseFloat(String(item.proposedValueM));
        if (isNaN(val) || val <= 0) {
          setSubmitError(`Please enter a valid estimated value in M for "${item.itemName}".`);
          return false;
        }
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(s => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setSubmitError(null);
    setStep(s => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Final Order Submission
  const handleSubmitOrder = async () => {
    if (isSubmitting || !selectedService) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const validItems = items.filter(i => i.itemName.trim() !== '');
      const response = await api.submitOrder({
        serviceId: selectedService.id,
        robloxUsername: robloxUsername.trim(),
        timezone: timezone.trim(),
        availability: availability.trim(),
        paymentType,
        items: validItems,
        customerNote: customerNote.trim() || undefined,
        consentPublicProofs,
      });

      setConfirmedOrder(response);
      setStep(5); // Confirmed screen
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Order submission failed:', err);
      setSubmitError(err.message || 'An error occurred while creating your order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyOrderLink = () => {
    if (!confirmedOrder?.publicToken) return;
    const url = `${window.location.origin}/track?token=${confirmedOrder.publicToken}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // STEP 5: CONFIRMATION SCREEN
  if (step === 5 && confirmedOrder) {
    const trackingUrl = `${window.location.origin}/track?token=${confirmedOrder.publicToken}`;

    return (
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 text-center space-y-6 shadow-xl">
          <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20">
            <Check className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wider text-amber-400 font-semibold">
              Order Created Successfully
            </span>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              {confirmedOrder.orderCode}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Your carry request has been submitted to staff for trade value review.
            </p>
          </div>

          {/* Safe Bookmark Link Card */}
          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 text-left space-y-2">
            <div className="text-xs font-semibold text-slate-400 flex items-center justify-between">
              <span>Your Bookmarkable Tracking Link</span>
              <span className="text-[11px] text-amber-400">Keep this safe!</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={trackingUrl}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 select-all"
              />
              <button
                type="button"
                onClick={copyOrderLink}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 border border-slate-700 transition-colors"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              This link uses an unguessable security token. Only people with this link can view this order status.
            </p>
          </div>

          {/* Summary Box */}
          <div className="bg-slate-950/70 rounded-2xl p-4 border border-slate-800/80 text-left text-xs space-y-2 font-mono">
            <div className="flex justify-between text-slate-300">
              <span>Service:</span>
              <span className="font-semibold text-white">{confirmedOrder.serviceName}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Agreed Total Value:</span>
              <span className="text-amber-400 font-bold">{confirmedOrder.totalPriceM}M</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>50% Deposit (Upfront):</span>
              <span className="text-amber-300">{confirmedOrder.depositM}M</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>50% Remaining (On Completion):</span>
              <span>{confirmedOrder.remainingM}M</span>
            </div>
          </div>

          {/* Next Steps for Customer */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-left space-y-2 text-xs text-amber-200">
            <div className="font-semibold flex items-center gap-2 text-amber-300">
              <ShieldCheck className="w-4 h-4" />
              <span>Next Steps & In-Game Meetup</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-amber-200/90 text-[11px] leading-relaxed">
              <li>Our staff will review your offered items and verify their trade valuations.</li>
              <li>A staff member will send a friend request to <strong className="text-white font-mono">{robloxUsername}</strong>.</li>
              <li>You will meet at Cafe (Second Sea) or Mansion (Third Sea) to trade the 50% deposit.</li>
              <li>Once the carry is finished, you trade the remaining 50% balance.</li>
            </ol>
          </div>

          {/* Discord Proof & Live Screen-Share Notice */}
          <div className="bg-gradient-to-r from-indigo-950/40 to-slate-900 border border-indigo-500/20 rounded-2xl p-4 text-left space-y-2 text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              Discord Proof & Live Screen-Share
            </span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              All carry completion proofs and live gameplay screen-sharing are coordinated manually in our Discord server. Join the community and drop your Order Code <strong className="text-amber-400 font-mono">{confirmedOrder.orderCode}</strong> in #support-tickets.
            </p>
            <a
              href={import.meta.env.VITE_DISCORD_INVITE_URL || 'https://discord.gg/JeZSJZb2aA'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              <span>Join Discord Server</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onNavigate(`/track?token=${confirmedOrder.publicToken}`)}
              className="w-full sm:w-auto px-6 py-3 bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl hover:bg-amber-300 transition-colors shadow-sm"
            >
              Go to Order Status Page
            </button>
            <button
              onClick={() => onNavigate('/services')}
              className="w-full sm:w-auto px-6 py-3 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-medium border border-slate-700 transition-colors"
            >
              Browse More Services
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-24">
      {/* Step Stepper Header */}
      <div className="space-y-3">
        <div className="text-xs uppercase tracking-wider text-amber-400 font-semibold">
          Step {step} of 4 · Safe Escrow Carry
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {step === 1 && 'Choose Service'}
          {step === 2 && 'Your Roblox Information'}
          {step === 3 && 'Fruit & Gamepass Offer'}
          {step === 4 && 'Review Order & Submit'}
        </h1>

        {/* Stepper Progress bar */}
        <div className="grid grid-cols-4 gap-2 pt-2">
          {['Service', 'Roblox Info', 'Payment Items', 'Review'].map((name, idx) => (
            <div key={name} className="space-y-1">
              <div 
                className={`h-1.5 rounded-full transition-colors ${
                  step > idx + 1 
                    ? 'bg-amber-400' 
                    : step === idx + 1 
                    ? 'bg-amber-400' 
                    : 'bg-slate-800'
                }`} 
              />
              <span className={`text-[10px] hidden sm:block ${step === idx + 1 ? 'text-white font-medium' : 'text-slate-500'}`}>
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {submitError && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-xs text-rose-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

      {/* STEP 1: CHOOSE SERVICE */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <label className="block text-xs font-semibold text-slate-300">
              Select Published Service
            </label>
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-amber-400"
            >
              {services.filter(s => s.isPublished).map(s => (
                <option key={s.id} value={s.id}>
                  [{s.category}] {s.name} — {s.priceM}M Value
                </option>
              ))}
            </select>

            {selectedService && (
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">{selectedService.name}</span>
                  <span className="text-sm font-mono font-bold text-amber-400">{selectedService.priceM}M</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {selectedService.description}
                </p>

                {/* Pricing Schedule */}
                <div className="pt-2 border-t border-slate-900 grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                    <span className="text-slate-400 block text-[10px] uppercase">50% Deposit (Upfront)</span>
                    <span className="text-amber-300 font-bold text-sm">{depositString}</span>
                  </div>
                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                    <span className="text-slate-400 block text-[10px] uppercase">50% Remaining (On End)</span>
                    <span className="text-slate-300 font-bold text-sm">{remainingString}</span>
                  </div>
                </div>

                {selectedService.prerequisites && (
                  <div className="text-[11px] text-slate-400 pt-1">
                    <span className="text-slate-500 font-medium">Prerequisites: </span>
                    {selectedService.prerequisites}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: ROBLOX INFORMATION */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Security Banner */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-xs text-emerald-300 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold text-white">Account Safety Guaranteed</strong>
              We will NEVER request your password, PIN, security cookies (.ROBLOSECURITY), or 2FA codes. All carries occur co-op inside normal Roblox servers.
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Roblox Username <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={robloxUsername}
                onChange={(e) => setRobloxUsername(e.target.value)}
                placeholder="e.g. PirateKing_99"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Must match your exact in-game Roblox username so staff can add you.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Your Timezone <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. EST (UTC-5), PST, GMT, IST (UTC+5:30)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
              {/* Quick Timezone Pills */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['EST (UTC-5)', 'PST (UTC-8)', 'GMT (UTC+0)', 'CET (UTC+1)', 'IST (UTC+5:30)', 'SGT (UTC+8)', 'JST (UTC+9)'].map((tz) => (
                  <button
                    type="button"
                    key={tz}
                    onClick={() => setTimezone(tz)}
                    className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-md text-[10px] text-slate-300 transition-colors"
                  >
                    {tz}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Available Play Hours <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={2}
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                placeholder="e.g. Weekdays 6:00 PM – 10:00 PM EST, Weekends anytime after 1:00 PM"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
              <p className="text-[11px] text-slate-500 mt-0.5">
                When can you be in-game to receive the carry?
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: PAYMENT TYPE & ITEMS OFFERED */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Payment Type Selection */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <label className="block text-xs font-semibold text-slate-300">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'fruits', label: 'In-Game Fruits' },
                { id: 'gamepass', label: 'Gamepasses' },
                { id: 'combination', label: 'Combination (Both)' },
              ].map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setPaymentType(m.id as any)}
                  className={`p-3 text-xs font-medium rounded-xl border text-center transition-colors ${
                    paymentType === m.id
                      ? 'bg-amber-400 text-slate-950 border-amber-400 font-semibold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fruit Presets Helper - Directly from Database Catalogue */}
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Live Catalogue Pricing (Fruits & Gamepasses)</span>
              </span>
              <span className="text-[11px] text-slate-500">Click to add verified item</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
              {catalogPresets.map((p) => (
                <button
                  type="button"
                  key={p.name}
                  onClick={() => handleAddItem(p)}
                  className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg text-[11px] text-slate-300 flex items-center gap-1.5 transition-colors"
                >
                  <span>{p.name}</span>
                  <span className="font-mono text-amber-400 font-semibold">{p.estimateM}M</span>
                </button>
              ))}
            </div>
          </div>

          {/* Offered Items Builder */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Items You Offer
                </h3>
                <p className="text-[11px] text-slate-400">
                  Multiple items allowed. Official catalogue items lock automatically to prevent price tampering.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleAddItem()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const isCatalogMatch = catalogLookup.has(item.itemName.toLowerCase().trim());

                return (
                  <div 
                    key={idx}
                    className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                  >
                    <div className="sm:col-span-6">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-slate-500 uppercase">
                          Fruit / Gamepass Name
                        </label>
                        {isCatalogMatch && (
                          <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Catalogue Verified
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={item.itemName}
                        onChange={(e) => handleItemChange(idx, 'itemName', e.target.value)}
                        placeholder="e.g. Kitsune Fruit, 2x Mastery..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-slate-500 uppercase block mb-1">
                        Qty
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-slate-500 uppercase">
                          Trade Value (M)
                        </label>
                        {isCatalogMatch && (
                          <span className="text-[9px] text-slate-400 font-mono">
                            Locked
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          readOnly={isCatalogMatch}
                          value={item.proposedValueM}
                          onChange={(e) => handleItemChange(idx, 'proposedValueM', e.target.value)}
                          placeholder="e.g. 25"
                          className={`w-full border rounded-lg pl-2.5 pr-6 py-1.5 text-xs font-mono ${
                            isCatalogMatch
                              ? 'bg-slate-900/80 text-amber-300 border-amber-500/30 cursor-not-allowed font-semibold'
                              : 'bg-slate-900 border-slate-800 text-white focus:outline-none focus:border-amber-400'
                          }`}
                          title={isCatalogMatch ? 'Price is locked to official database catalogue value.' : ''}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
                          M
                        </span>
                      </div>
                    </div>

                    <div className="sm:col-span-1 flex justify-end sm:pt-4">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Math Calculation Strip */}
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2.5 text-xs font-mono">
              <div className="flex justify-between text-slate-300">
                <span>Service Price:</span>
                <span className="font-bold text-white">{totalString}</span>
              </div>
              <div className="flex justify-between text-amber-300">
                <span>Required 50% Deposit:</span>
                <span className="font-bold">{depositString}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>50% Remaining (On Completion):</span>
                <span>{remainingString}</span>
              </div>
              <div className="pt-2 border-t border-slate-900 flex justify-between items-center text-sm">
                <span className="font-sans font-semibold text-slate-200">Your Proposed Total:</span>
                <span className="font-bold text-amber-400">{totalProposedString}</span>
              </div>

              {/* Deposit Coverage Status Callout */}
              <div className="pt-1">
                {coverage.hasMetDeposit ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg p-2.5 text-[11px] flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      {coverage.hasMetTotal 
                        ? 'Offered items fully cover both 50% deposit and 50% remaining!' 
                        : 'Offered items cover the 50% deposit! Remaining balance can be settled later.'}
                    </span>
                  </div>
                ) : (
                  <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-lg p-2.5 text-[11px] flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Needs +{toMillionString(coverage.depositDeficitHundredths)} more to reach the 50% deposit threshold.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Mandatory Disclaimer */}
            <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/60 text-[11px] text-slate-400 leading-relaxed">
              <strong className="text-slate-300 block mb-0.5">Valuation Verification Notice:</strong>
              Fruit and gamepass trade values are customer proposals. The site never claims to know volatile live market values; staff will verify and confirm final agreed values with you before in-game trading begins.
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: REVIEW & CONFIRM */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
              Order Review & Summary
            </h3>

            {/* Service & Pricing Card */}
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 uppercase">{selectedService?.category}</span>
                  <h4 className="text-base font-bold text-white">{selectedService?.name}</h4>
                </div>
                <div className="text-right font-mono">
                  <span className="text-xs text-slate-500 block">Total Trade Value</span>
                  <span className="text-lg font-bold text-amber-400">{selectedService?.priceM}M</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-900 text-xs font-mono">
                <div className="text-slate-300">
                  <span className="text-[10px] text-slate-500 block">50% Deposit (Upfront)</span>
                  <span className="text-amber-300 font-bold">{depositString}</span>
                </div>
                <div className="text-slate-400">
                  <span className="text-[10px] text-slate-500 block">50% Remaining (On Completion)</span>
                  <span className="font-bold">{remainingString}</span>
                </div>
              </div>
            </div>

            {/* Player Information */}
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2 text-xs">
              <div className="text-xs font-semibold text-white uppercase tracking-wider mb-1">
                Player Details
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Roblox Username:</span>
                <span className="text-white font-mono font-bold">{robloxUsername}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Timezone:</span>
                <span className="text-slate-200">{timezone}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Play Hours:</span>
                <span className="text-slate-200">{availability}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Payment Category:</span>
                <span className="text-slate-200 capitalize">{paymentType}</span>
              </div>
            </div>

            {/* Proposed Items Offered */}
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-white uppercase tracking-wider">
                  Offered Items ({items.filter(i => i.itemName).length})
                </span>
                <span className="font-mono text-amber-400 font-bold">
                  Proposed: {totalProposedString}
                </span>
              </div>
              <div className="divide-y divide-slate-900">
                {items.filter(i => i.itemName).map((item, idx) => (
                  <div key={idx} className="py-2 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-white font-medium">{item.itemName}</span>
                      <span className="text-slate-500 ml-2">×{item.quantity}</span>
                    </div>
                    <span className="font-mono text-slate-300">
                      {parseFloat(String(item.proposedValueM)).toFixed(2)}M each
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Note (Optional) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Additional Notes or Special Requests (Optional)
              </label>
              <textarea
                rows={2}
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="e.g. Need carry after 8pm, prefer private server, already have fragment count ready..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Critical Policy Checklist */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-200 space-y-2">
              <div className="font-semibold text-white">Before You Confirm:</div>
              <ul className="space-y-1 text-[11px] list-disc list-inside text-amber-200/90 leading-relaxed">
                <li>No real cash (USD, INR) is ever exchanged. Only in-game fruits/gamepasses.</li>
                <li>50% deposit must be traded in-game to staff before the carry begins.</li>
                <li>Staff will verify all item trade values before initiating the in-game trade.</li>
                <li>Do not drop fruits on the ground — all trades use the safe in-game trade window.</li>
              </ul>
            </div>

            {/* Customer Authentication Requirement (Firebase Google Sign-In) */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">
                    Customer Account (Firebase Authentication)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Google Sign-In is required to secure your order and link it to your private account.
                  </span>
                </div>
                {currentUser ? (
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-1.5 rounded-lg text-xs">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{currentUser.email}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={signingInGoogle}
                    onClick={async () => {
                      setSigningInGoogle(true);
                      setSubmitError(null);
                      try {
                        await signInWithGoogle();
                      } catch (err: any) {
                        setSubmitError(err.message || 'Google Sign-in failed. Please try again.');
                      } finally {
                        setSigningInGoogle(false);
                      }
                    }}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-950 font-semibold text-xs rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>{signingInGoogle ? 'Signing In...' : 'Sign In with Google'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Public Proof Showcase Consent (Optional) */}
            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={consentPublicProofs}
                onChange={(e) => setConsentPublicProofs(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-400"
              />
              <span className="text-xs text-slate-300">
                <strong className="text-white block mb-0.5">Showcase on Public Proofs Wall (Optional)</strong>
                I consent to having my carry completion screenshots and order displayed on the public Proofs page once verified by staff.
              </span>
            </label>
          </div>
        </div>
      )}

      {/* NAVIGATION CONTROLS */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        {step > 1 ? (
          <button
            type="button"
            onClick={handleBack}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        ) : (
          <div />
        )}

        {step < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            className="px-6 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors shadow-sm flex items-center gap-1.5 active:scale-95"
          >
            <span>Next Step</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={isSubmitting || !currentUser}
            onClick={handleSubmitOrder}
            className={`px-8 py-3 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors shadow-lg shadow-amber-400/10 flex items-center gap-2 active:scale-95 ${
              isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <span>{isSubmitting ? 'Submitting Order...' : 'Confirm & Place Order'}</span>
            <Check className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
