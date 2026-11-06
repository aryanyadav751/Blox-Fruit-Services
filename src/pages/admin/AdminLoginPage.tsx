import React, { useState } from 'react';
import { Lock, ShieldCheck, AlertCircle, LogIn, KeyRound } from 'lucide-react';
import { api } from '../../lib/api.ts';

interface AdminLoginPageProps {
  onLoginSuccess: () => void;
  onNavigate: (path: string) => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ 
  onLoginSuccess, 
  onNavigate 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasscodeFallback, setShowPasscodeFallback] = useState(false);
  const [passcode, setPasscode] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.adminLoginWithGoogle();
      onLoginSuccess();
    } catch (err: any) {
      console.error('Admin Google sign-in failed:', err);
      setError(err.message || 'Google sign-in failed. Please verify you are using an authorized staff administrator account.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError('Please enter the staff administration passcode.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.adminLogin(passcode.trim());
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your staff passcode.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-amber-400/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-400/20">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Staff Portal Authentication
          </h1>
          <p className="text-xs text-slate-400">
            Secured administrator access requiring a verified Google Account with server-minted <code className="text-amber-400 font-mono text-[11px]">admin: true</code> custom claim.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Primary Method: Google Sign-in with Custom Claims */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-3 active:scale-98 cursor-pointer"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>{loading ? 'Verifying Admin Claims...' : 'Sign In with Google (Staff)'}</span>
          </button>

          <p className="text-center text-[11px] text-slate-500">
            Authorized administrator email: <code className="text-slate-400 font-mono">shelendra.ubuntu@gmail.com</code>
          </p>
        </div>

        {/* Optional Secondary Passcode Fallback for Offline / Dev Environments */}
        <div className="pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setShowPasscodeFallback(!showPasscodeFallback)}
            className="w-full text-center text-[11px] text-slate-500 hover:text-slate-400 flex items-center justify-center gap-1.5 transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{showPasscodeFallback ? 'Hide Passcode Fallback' : 'Emergency Passcode Login (Dev/Offline)'}</span>
          </button>

          {showPasscodeFallback && (
            <form onSubmit={handlePasscodeSubmit} className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Staff Passcode
                </label>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter fallback passcode..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Verify Passcode</span>
              </button>
            </form>
          )}
        </div>

        <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Firebase ID Token with Server-Minted Custom Claims</span>
          </div>
          <p>
            Users without the <code className="text-amber-400 font-mono">admin: true</code> custom claim are strictly rejected with HTTP 403 Forbidden.
          </p>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            ← Return to Public Site
          </button>
        </div>
      </div>
    </div>
  );
};
