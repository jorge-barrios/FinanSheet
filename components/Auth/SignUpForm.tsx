import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocalization } from '../../hooks/useLocalization';
import { useToast } from '../../context/ToastContext';
import { AuthLayout } from './AuthLayout';
import { Mail, Lock, Loader2, CheckCircle2 } from 'lucide-react';

interface SignUpFormProps {
  onToggleMode: () => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({ onToggleMode }) => {
  const { signUp } = useAuth();
  const { t } = useLocalization();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (password !== confirmPassword) {
      const errorMsg = t('signup.passwordMismatch');
      setError(errorMsg);
      showToast(errorMsg, 'error');
      return;
    }

    if (password.length < 6) {
      const errorMsg = t('signup.passwordTooShort');
      setError(errorMsg);
      showToast(errorMsg, 'error');
      return;
    }

    setLoading(true);

    const { error } = await signUp(email, password);

    if (error) {
      setError(error.message);
      showToast(t('signup.error'), 'error');
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      showToast(t('signup.successToast'), 'success');
    }
  };

  if (success) {
    return (
      <AuthLayout
        title={t('signup.success.title')}
        subtitle=""
      >
        <div className="text-center space-y-6">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-slate-600 dark:text-slate-300">
            {t('signup.success.message')}
          </p>
          <button
            onClick={onToggleMode}
            className="text-sky-600 hover:text-sky-500 font-medium transition-colors"
          >
            {t('signup.success.backToLogin')}
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('signup.title')}
      subtitle={t('signup.subtitle')}
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              {t('signup.email')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all duration-200"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              {t('signup.password')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all duration-200"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
              {t('signup.confirmPassword')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all duration-200"
                placeholder="••••••••"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-600 text-center font-medium">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                {t('signup.loading')}
              </>
            ) : (
              t('signup.submit')
            )}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={onToggleMode}
              className="text-sm font-medium text-sky-600 hover:text-sky-500 transition-colors duration-200"
            >
              {t('signup.hasAccount')}
            </button>
          </div>
        </div>
      </form>
    </AuthLayout>
  );
};
