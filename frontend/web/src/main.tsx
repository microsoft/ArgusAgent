import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { adoptTokenFromUrl } from './api';
import { BootSplash } from './components/BootSplash';
import { I18nProvider } from './i18n';
import { queryRetryPolicy } from './hooks';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './index.css';

// Runs before the first request so a QR-paired phone is authenticated for
// every later load, not just the one carrying `?token=`.
adoptTokenFromUrl();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 3_000, retry: queryRetryPolicy, refetchOnWindowFocus: false },
  },
});

function WebApp() {
  const [booting, setBooting] = useState(true);
  return (
    <>
      <App />
      {booting ? <BootSplash onDone={() => setBooting(false)} /> : null}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <WebApp />
      </I18nProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
