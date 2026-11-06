import React, { useState } from 'react';
import { 
  MessageSquare, 
  Send, 
  ShieldCheck, 
  HelpCircle, 
  Monitor, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink,
  Clock,
  Sparkles
} from 'lucide-react';
import { api } from '../lib/api.ts';

interface SupportPageProps {
  onNavigate: (path: string) => void;
}

export function SupportPage({ onNavigate }: SupportPageProps) {
  const [robloxUsername, setRobloxUsername] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [discordTag, setDiscordTag] = useState('');
  const [orderCodeOrId, setOrderCodeOrId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submittedEnquiryId, setSubmittedEnquiryId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!robloxUsername.trim() || !subject.trim() || !message.trim()) {
      setErrorMessage('Please fill in your Roblox username, subject, and message.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.submitEnquiry({
        robloxUsername: robloxUsername.trim(),
        customerName: customerName.trim() || undefined,
        discordTag: discordTag.trim() || undefined,
        orderCodeOrId: orderCodeOrId.trim() || undefined,
        subject: subject.trim(),
        message: message.trim(),
      });
      setSubmittedEnquiryId(res.enquiryId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit enquiry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmittedEnquiryId(null);
    setRobloxUsername('');
    setCustomerName('');
    setDiscordTag('');
    setOrderCodeOrId('');
    setSubject('');
    setMessage('');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider">
          <MessageSquare className="w-4 h-4" />
          Customer Support & Inquiries
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          We're Here to Help You Navigate Blox Fruits
        </h1>
        <p className="text-sm sm:text-base text-slate-300">
          Have a question about a carry, trade valuations, or an ongoing order? Reach our staff team via our Discord community or submit a web support ticket below.
        </p>
      </div>

      {/* Dual Contact Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Option 1: Direct Discord Contact */}
        <div className="bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="space-y-4 relative">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Direct Discord Contact</h2>
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Staff Active in Discord Guild
                </span>
              </div>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Connect directly with our carry operators for real-time raid scheduling, fruit value appraisals, and live screen-share coordination.
            </p>
            <div className="bg-slate-900/80 rounded-xl p-4 border border-indigo-500/20 space-y-2 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Average Response:</span>
                <span className="text-indigo-300 font-semibold">&lt; 15 minutes</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Live Screen Sharing:</span>
                <span className="text-emerald-300 font-semibold">Available on Request</span>
              </div>
            </div>
          </div>

          <div className="pt-6 relative">
            <a
              href={import.meta.env.VITE_DISCORD_INVITE_URL || 'https://discord.gg/JeZSJZb2aA'}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30 group-hover:scale-[1.01]"
            >
              <span>Join Discord Server</span>
              <ExternalLink className="w-4 h-4" />
            </a>
            <p className="text-[11px] text-center text-slate-400 mt-2">
              Direct access to staff carry lobbies and live ticket channels
            </p>
          </div>
        </div>

        {/* Option 2: Website Ticket Form Summary */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-xl">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Send className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Website Support Ticket</h2>
                <span className="text-xs text-slate-400">Recorded in our Staff Inbox</span>
              </div>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Submit your enquiry directly through our website. Our staff monitors the inquiry queue and replies with status updates, or follow up via Discord.
            </p>

            <div className="space-y-2.5 pt-2">
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Tracked in persistent PostgreSQL database with unique Inquiry Reference</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Link existing order codes (e.g. <strong>BFS-1042</strong>) for expedited service</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Option to upload completion screenshot links or request live stream</span>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <a
              href="#support-form"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-amber-500/20 font-semibold text-sm transition-all"
            >
              <span>Scroll to Support Form</span>
              <Sparkles className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Screen-Sharing & Account Safety Guidelines (Requirement 3) */}
      <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Roblox Screen-Sharing & Account Safety Policy
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                Strict Non-Custodial
              </span>
            </h3>
            <p className="text-xs text-slate-400">How we verify progress while guaranteeing 100% account safety</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              Voluntary Live Screen-Sharing
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Customers may voluntarily share <strong>ONLY their Roblox game window</strong> over Discord voice calls. Staff never control your computer and we never use covert background software or capture tools.
            </p>
          </div>

          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Alternative Evidence & Zero-Password Rule
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              If you cannot screen share, screenshot or video uploads are accepted as proof. <strong>We NEVER ask for your password, cookies, or 2FA codes.</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Support Enquiry Form */}
      <div id="support-form" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-amber-400" />
            Submit an Enquiry
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Fill out the details below. Our staff team will review your inquiry in our internal support inbox.
          </p>
        </div>

        {submittedEnquiryId ? (
          <div className="p-8 text-center space-y-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">Enquiry Submitted Successfully!</h3>
            <p className="text-sm text-slate-300 max-w-md mx-auto">
              Your inquiry reference number is <strong className="text-amber-400 font-mono">{submittedEnquiryId}</strong>. A staff operator will review it shortly.
            </p>
            <div className="pt-4 flex flex-wrap justify-center gap-3">
              <button
                onClick={handleReset}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
              >
                Submit Another Enquiry
              </button>
              <button
                onClick={() => onNavigate('/services')}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-semibold text-slate-950 transition-colors"
              >
                Browse Services
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMessage && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Roblox Username <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={robloxUsername}
                  onChange={(e) => setRobloxUsername(e.target.value)}
                  placeholder="e.g. BloxMaster99"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-sm text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Your Name / Nickname <span className="text-slate-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Alex"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-sm text-white placeholder-slate-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Discord Tag <span className="text-slate-500">(Optional, for direct reply)</span>
                </label>
                <input
                  type="text"
                  value={discordTag}
                  onChange={(e) => setDiscordTag(e.target.value)}
                  placeholder="e.g. pirate_captain or Name#1234"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-sm text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Order Code / Order ID <span className="text-slate-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={orderCodeOrId}
                  onChange={(e) => setOrderCodeOrId(e.target.value)}
                  placeholder="e.g. BFS-1042"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-sm text-white placeholder-slate-500 font-mono uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Subject <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Question regarding Dough Awakening raid carry scheduling"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-sm text-white placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Message <span className="text-amber-400">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="Explain your inquiry in detail. Include your availability, preferred carry session times, or any specific in-game fruit offers..."
                required
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-sm text-white placeholder-slate-500 resize-y"
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Staff inquiries answered 7 days a week
              </span>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? 'Submitting...' : 'Send Support Enquiry'}
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
