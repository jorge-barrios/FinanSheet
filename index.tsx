
import React from 'react';
import ReactDOM from 'react-dom/client';
import { LocalizationProvider } from './context/LocalizationContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { FeatureFlagsProvider } from './context/FeatureFlagsContext';
import { CommitmentsProvider } from './context/CommitmentsContext';
import { ProtectedApp } from './components/ProtectedApp';
import ToastContainer from './components/ToastContainer';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LocalizationProvider>
          <FeatureFlagsProvider>
            <ToastProvider>
              <CommitmentsProvider>
                <ProtectedApp />
                <ToastContainer />
              </CommitmentsProvider>
            </ToastProvider>
          </FeatureFlagsProvider>
        </LocalizationProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
