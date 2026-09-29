import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@cullinos/ui';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ImpersonationHandoff } from './components/auth/ImpersonationHandoff';
import App from './App';
import { useCartStore } from './features/pos/cartStore';
import { useHeldOrdersStore } from './features/pos/heldOrdersStore';
import { useAuthStore } from './stores/auth';
import './i18n';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

useAuthStore.subscribe((state, prev) => {
  if (state.accessToken === prev.accessToken) return;
  queryClient.clear();
  useCartStore.getState().clear();
  useHeldOrdersStore.getState().clearAll();
});

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ToastProvider>
        <ImpersonationHandoff />
        <App />
      </ToastProvider>
    </BrowserRouter>
  </QueryClientProvider>,
);
