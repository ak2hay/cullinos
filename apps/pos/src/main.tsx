import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import { useAuthStore } from './stores/auth';
import { useCartStore } from './stores/cart';
import { useHeldOrdersStore } from './stores/heldOrders';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

useAuthStore.subscribe((state, prev) => {
  if (state.accessToken === prev.accessToken) return;
  queryClient.clear();
  useCartStore.getState().clear();
  useHeldOrdersStore.getState().clearAll();
});

const Router = import.meta.env.VITE_DESKTOP === 'true' ? HashRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <Router>
      <App />
    </Router>
  </QueryClientProvider>,
);
