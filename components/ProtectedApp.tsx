import React from 'react';
import { useAuth } from '../context/AuthContext';
import { AuthPage } from './Auth/AuthPage';
import App from '../App';

export const ProtectedApp: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          {/* Spinning ring with sky blue accent */}
          <div className="relative inline-block">
            <div className="w-16 h-16 rounded-full border-4 border-slate-700 border-t-sky-500 animate-spin"></div>
            <div className="absolute inset-0 rounded-full bg-sky-500/10 blur-xl"></div>
          </div>
          <p className="mt-6 text-slate-200 font-medium text-lg">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <App />;
};
