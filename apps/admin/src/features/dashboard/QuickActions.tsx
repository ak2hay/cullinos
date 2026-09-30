import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChartColumn, CirclePlus, Package, Settings, TicketPercent, UtensilsCrossed } from 'lucide-react';

export interface QuickAction {
  to: string;
  label: string;
  hint: string;
  icon: ReactNode;
  tone: string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    to: '/pos',
    label: 'Create order',
    hint: 'Take a new order',
    icon: <CirclePlus size={22} />,
    tone: 'bg-status-success/10 text-status-success hover:bg-status-success/15',
  },
  {
    to: '/menu',
    label: 'Add menu item',
    hint: 'Manage menu',
    icon: <UtensilsCrossed size={22} />,
    tone: 'bg-status-info/10 text-status-info hover:bg-status-info/15',
  },
  {
    to: '/inventory',
    label: 'Manage inventory',
    hint: 'Stock & usage',
    icon: <Package size={22} />,
    tone: 'bg-status-warning/10 text-status-warning hover:bg-status-warning/15',
  },
  {
    to: '/coupons',
    label: 'Create offer',
    hint: 'Discounts & promos',
    icon: <TicketPercent size={22} />,
    tone: 'bg-status-new/10 text-status-new hover:bg-status-new/15',
  },
  {
    to: '/reports',
    label: 'View reports',
    hint: 'Sales & analytics',
    icon: <ChartColumn size={22} />,
    tone: 'bg-status-error/10 text-status-error hover:bg-status-error/15',
  },
  {
    to: '/settings',
    label: 'Outlet settings',
    hint: 'Configure outlet',
    icon: <Settings size={22} />,
    tone: 'bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/15',
  },
];

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) {
    return <p className="py-6 text-center text-sm text-text-muted">No shortcuts available for your role.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {actions.map((action) => (
        <Link
          key={action.to}
          to={action.to}
          className={`group flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-4 text-center transition-[background-color,transform] duration-200 hover:-translate-y-0.5 active:scale-[0.98] ${action.tone}`}
        >
          <span className="transition-transform duration-200 group-hover:scale-110">{action.icon}</span>
          <span className="text-sm font-semibold">{action.label}</span>
          <span className="text-[11px] text-text-muted">{action.hint}</span>
        </Link>
      ))}
    </div>
  );
}
