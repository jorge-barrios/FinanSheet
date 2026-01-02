import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocalization } from '../../hooks/useLocalization';
import { useToast } from '../../context/ToastContext';
import { AuthLayout } from './AuthLayout';
import { Lock, Loader2 } from 'lucide-react';

export const UpdatePasswordForm: React.FC = () => {
    const { updatePassword, clearPasswordRecovery } = useAuth();
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

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
        const { error } = await updatePassword(password);

        if (error) {
            setError(error.message);
            showToast(error.message, 'error');
            setLoading(false);
        } else {
            setSuccess(true);
            setLoading(false);
            showToast(t('updatePassword.success'), 'success');
        }
    };

    if (success) {
        return (
            <AuthLayout
                title={t('updatePassword.successTitle')}
                subtitle=""
            >
                <div className="text-center space-y-6">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-900/30 border border-green-800/50">
                        <Lock className="h-8 w-8 text-green-400" />
                    </div>
                    <p className="text-slate-300">
                        {t('updatePassword.successMessage')}
                    </p>
                    <button
                        onClick={clearPasswordRecovery}
                        className="text-sky-400 hover:text-sky-300 font-medium transition-colors underline underline-offset-4 decoration-sky-400/50 hover:decoration-sky-300"
                    >
                        {t('updatePassword.continue')}
                    </button>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title={t('updatePassword.title')}
            subtitle={t('updatePassword.subtitle')}
        >
            <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="new-password" className="block text-sm font-medium text-slate-300 mb-1">
                            {t('updatePassword.newPassword')}
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-slate-500" />
                            </div>
                            <input
                                id="new-password"
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full pl-10 pr-3 py-2.5 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent focus:bg-slate-800 transition-all duration-200"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-300 mb-1">
                            {t('updatePassword.confirmPassword')}
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-slate-500" />
                            </div>
                            <input
                                id="confirm-password"
                                name="confirmPassword"
                                type="password"
                                autoComplete="new-password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
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
                        t('updatePassword.submit')
                    )}
                </button>
            </form>
        </AuthLayout>
    );
};
