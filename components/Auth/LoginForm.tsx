import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocalization } from '../../hooks/useLocalization';
import { useToast } from '../../context/ToastContext';
import { AuthLayout } from './AuthLayout';
import { Mail, Lock, Loader2 } from 'lucide-react';

interface LoginFormProps {
  onToggleMode: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onToggleMode }) => {
  const { signIn, signInWithGoogle, resetPassword } = useAuth();
  const { t } = useLocalization();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
      showToast(t('login.error'), 'error');
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      showToast(t('login.success'), 'success');
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      showToast(error.message, 'error');
      setLoading(false);
    }
    // No need to set loading false on success as it redirects
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await resetPassword(email);

    if (error) {
      setError(error.message);
      showToast(error.message, 'error');
      setLoading(false);
    } else {
      showToast(t('login.resetSuccess'), 'success');
      setLoading(false);
      setIsResetMode(false); // Optionally return to login or show success state
    }
  };

  if (isResetMode) {
    return (
      <AuthLayout
        title={t('login.resetPasswordTitle')}
        subtitle={t('login.resetPasswordDesc')}
      >
        <form className="space-y-6" onSubmit={handleResetPassword}>
          <div>
            <label htmlFor="reset-email" className="block text-sm font-medium text-slate-300 mb-1">
              {t('login.email')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-500" />
              </div>
              <input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent focus:bg-slate-800 transition-all duration-200"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className="space-y-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-sky-500 hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-sky-500/25 hover:shadow-sky-400/30 hover:shadow-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  {t('login.loading')}
                </>
              ) : (
                t('login.sendResetLink')
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsResetMode(false)}
              className="w-full text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              {t('login.backToLogin')}
            </button>
          </div>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('login.title')}
      subtitle={t('login.subtitle')}
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
              {t('login.email')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-500" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent focus:bg-slate-800 transition-all duration-200"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
              {t('login.password')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-500" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent focus:bg-slate-800 transition-all duration-200"
                placeholder="••••••••"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-900/30 border border-red-800/50 p-4">
            <p className="text-sm text-red-400 text-center font-medium">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setIsResetMode(true)}
              className="text-sm font-medium text-sky-400 hover:text-sky-300 transition-colors"
            >
              {t('login.forgotPassword')}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-sky-500 hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-sky-500/25 hover:shadow-sky-400/30 hover:shadow-xl"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                {t('login.loading')}
              </>
            ) : (
              t('login.submit')
            )}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700/50"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-800 text-slate-400">O</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full flex justify-center items-center py-2.5 px-4 border border-slate-700 rounded-lg text-sm font-medium text-slate-300 bg-slate-800/50 hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-slate-700 transition-all duration-200"
          >
            <svg className="h-5 w-5 mr-2" aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12.0003 20.45c4.6667 0 8.45-3.7833 8.45-8.45 0-.75-.0667-1.4667-.1833-2.1667H12.0003v4.1167h4.8333c-.2083 1.125-1.25 3.3333-4.8333 3.3333-2.9 0-5.2667-2.35-5.2667-5.2833s2.3667-5.2833 5.2667-5.2833c1.3167 0 2.5.4667 3.4333 1.35l3.05-3.05C16.967 3.5167 14.6503 2.55 12.0003 2.55 6.7836 2.55 2.5503 6.7833 2.5503 12s4.2333 9.45 9.45 9.45z" fill="currentColor" />
            </svg>
            {t('login.continueGoogle')}
          </button>

          <div className="text-center pt-4">
            <span className="text-sm text-slate-400">
              {t('login.noAccount')}{" "}
            </span>
            <button
              type="button"
              onClick={onToggleMode}
              className="text-sm font-medium text-sky-400 hover:text-sky-300 transition-colors duration-200 underline underline-offset-4 decoration-sky-400/50 hover:decoration-sky-300"
            >
              {t('login.registerAction')}
            </button>
          </div>
        </div>
      </form>
    </AuthLayout>
  );
};
