import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AgentShell } from '@/components/AgentShell';
import { PortalShell } from '@/components/PortalShell';
import { LoginPage } from '@/pages/LoginPage';
import { AgentDashboardPage } from '@/pages/agent/AgentDashboardPage';
import { AgentGrantsPage } from '@/pages/agent/AgentGrantsPage';
import { AgentKnowledgePage } from '@/pages/agent/AgentKnowledgePage';
import { AgentShiftsPage } from '@/pages/agent/AgentShiftsPage';
import { AgentNewTicketPage } from '@/pages/agent/AgentNewTicketPage';
import { AgentQueuePage } from '@/pages/agent/AgentQueuePage';
import { AgentTicketPage } from '@/pages/agent/AgentTicketPage';
import { ArticlePage } from '@/pages/portal/ArticlePage';
import { MyTicketsPage } from '@/pages/portal/MyTicketsPage';
import { PortalHomePage } from '@/pages/portal/PortalHomePage';
import { PortalTicketPage } from '@/pages/portal/PortalTicketPage';
import { RaiseTicketPage } from '@/pages/portal/RaiseTicketPage';
import { useSession, type SessionMode } from '@/stores/session';

function RequireMode({ mode, children }: { mode: SessionMode; children: ReactNode }) {
  const session = useSession();
  const location = useLocation();
  if (!session.accessToken || !session.mode) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  if (session.mode !== mode) return <Navigate to={session.mode === 'agent' ? '/agent' : '/'} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/agent"
        element={
          <RequireMode mode="agent">
            <AgentShell />
          </RequireMode>
        }
      >
        <Route index element={<Navigate to="queue/mine" replace />} />
        <Route path="queue/:queue" element={<AgentQueuePage />} />
        <Route path="tickets/new" element={<AgentNewTicketPage />} />
        <Route path="tickets/:id" element={<AgentTicketPage />} />
        <Route path="knowledge" element={<AgentKnowledgePage />} />
        <Route path="dashboard" element={<AgentDashboardPage />} />
        <Route path="grants" element={<AgentGrantsPage />} />
        <Route path="shifts" element={<AgentShiftsPage />} />
      </Route>
      <Route
        path="/"
        element={
          <RequireMode mode="customer">
            <PortalShell />
          </RequireMode>
        }
      >
        <Route index element={<PortalHomePage />} />
        <Route path="tickets" element={<MyTicketsPage />} />
        <Route path="tickets/new" element={<RaiseTicketPage />} />
        <Route path="tickets/:id" element={<PortalTicketPage />} />
        <Route path="kb/:slug" element={<ArticlePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
