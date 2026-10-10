import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  Building2,
  CreditCard,
  Headset,
  Image,
  LayoutDashboard,
  Megaphone,
  Server,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';
import type { PlatformPermission } from '@/lib/permissions';

export type NavLeaf = {
  to: string;
  label: string;
  /** Any of these unlocks the item; omitted means every staff member. */
  permission?: PlatformPermission | PlatformPermission[];
  end?: boolean;
  external?: boolean;
  keywords?: string;
  badge?: 'approvals';
};

export type NavEntry =
  | (NavLeaf & { kind: 'leaf'; id: string; icon: LucideIcon; section?: string })
  | { kind: 'group'; id: string; label: string; icon: LucideIcon; children: NavLeaf[] };

const appOpsUrl = (
  import.meta.env.VITE_APP_OPS_URL?.trim() ||
  (import.meta.env.PROD ? 'https://app.cullinos.com' : 'http://localhost:5184')
).replace(/\/$/, '');

const supportPortalUrl = (
  import.meta.env.VITE_SUPPORT_URL?.trim() ||
  (import.meta.env.PROD ? 'https://support.cullinos.com' : 'http://localhost:5185')
).replace(/\/$/, '');

export const NAV: NavEntry[] = [
  { kind: 'leaf', id: 'dashboard', to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, permission: 'dashboard.read', section: 'Home' },
  {
    kind: 'leaf',
    id: 'tenants',
    to: '/tenants',
    label: 'Tenants',
    icon: Building2,
    permission: 'tenants.read',
    keywords: 'restaurants organizations customers',
    section: 'Customers',
  },
  { kind: 'leaf', id: 'users', to: '/users-report', label: 'Users', icon: Users, permission: 'tenants.read', keywords: 'users report staff accounts', section: 'Customers' },
  {
    kind: 'group',
    id: 'billing',
    label: 'Plans & Billing',
    icon: CreditCard,
    children: [
      { to: '/plans', label: 'Plans', permission: 'plans.read' },
      { to: '/subscriptions', label: 'Subscriptions', permission: 'subscriptions.manage' },
    ],
  },
  {
    kind: 'leaf',
    id: 'approvals',
    to: '/approvals',
    label: 'Approvals',
    icon: BadgeCheck,
    badge: 'approvals',
    keywords: 'inbox maker checker',
    section: 'Home',
  },
  {
    kind: 'group',
    id: 'ops',
    label: 'Platform Ops',
    icon: Server,
    children: [
      { to: '/reports', label: 'Ops overview', permission: 'reports.read', keywords: 'sla workload metrics' },
      { to: '/labs', label: 'Tenant labs', permission: 'labs.sql', keywords: 'sql sandbox' },
      { to: '/reports/jobs', label: 'Exports & bulk jobs', permission: ['reports.export', 'bulk.run'] },
      { to: '/health', label: 'System health', permission: 'health.read' },
      { to: appOpsUrl, label: 'Cullinos App Ops', permission: 'guest_ops.manage', external: true },
    ],
  },
  {
    kind: 'group',
    id: 'support',
    label: 'Support',
    icon: Headset,
    children: [
      { to: '/support/tickets', label: 'Tickets', permission: 'tickets.read', keywords: 'helpdesk sla' },
      {
        to: `${supportPortalUrl}/agent`,
        label: 'Support portal',
        permission: 'tickets.read',
        external: true,
        keywords: 'servicenow agent workspace knowledge base',
      },
      {
        to: '/support/grants',
        label: 'Tenant access grants',
        permission: ['tenants.impersonate', 'tenant_access.revoke', 'tickets.read'],
        keywords: 'impersonate open as tenant',
      },
      { to: '/people/shifts', label: 'Shifts & on-call', permission: ['directory.read', 'tickets.read'] },
    ],
  },
  {
    kind: 'group',
    id: 'marketing',
    label: 'Marketing CMS',
    icon: Megaphone,
    children: [
      { to: '/marketing', label: 'Overview', permission: 'marketing.manage' },
      { to: '/marketing/inquiries', label: 'Inquiries', permission: 'marketing.inquiries' },
      { to: '/marketing/pages', label: 'Pages', permission: 'marketing.manage' },
      { to: '/marketing/blog', label: 'Blog', permission: 'marketing.manage' },
      { to: '/marketing/pricing', label: 'Pricing', permission: 'marketing.manage' },
      { to: '/marketing/hero', label: 'Hero', permission: 'marketing.manage' },
      { to: '/marketing/testimonials', label: 'Testimonials', permission: 'marketing.manage' },
      { to: '/marketing/navigation', label: 'Navigation', permission: 'marketing.manage' },
      { to: '/marketing/theme', label: 'Theme', permission: 'marketing.manage' },
      { to: '/marketing/design-lab', label: 'Design lab', permission: 'marketing.manage' },
      { to: '/promo-email', label: 'Promo email', permission: 'promo.send' },
    ],
  },
  { kind: 'leaf', id: 'media', to: '/marketing/media', label: 'Media', icon: Image, permission: 'marketing.manage', section: 'Marketing CMS' },
  {
    kind: 'group',
    id: 'people',
    label: 'People & Access',
    icon: UserCog,
    children: [
      { to: '/people', label: 'Directory', permission: 'directory.read', keywords: 'employees staff' },
      { to: '/people/org-chart', label: 'Org chart', permission: 'directory.read' },
      { to: '/team', label: 'Platform accounts', permission: 'team.manage', keywords: 'invite staff' },
      { to: '/iam/org', label: 'Departments & teams', permission: ['iam.read', 'directory.read'] },
      { to: '/iam/roles', label: 'Roles', permission: ['iam.read', 'iam.assign'], keywords: 'permissions rbac' },
      { to: '/iam/assignments', label: 'Role assignments', permission: ['iam.read', 'iam.assign'] },
      { to: '/access/my-reviews', label: 'My access reviews', keywords: 'certify' },
    ],
  },
  {
    kind: 'group',
    id: 'governance',
    label: 'Governance',
    icon: ShieldCheck,
    children: [
      { to: '/activity', label: 'Staff activity log', permission: 'activity.read', keywords: 'audit employee id' },
      { to: '/audit', label: 'Tenant audit log', permission: 'audit.read' },
      { to: '/approvals/policies', label: 'Approval policies', permission: ['approvals.policies', 'approvals.read_all'] },
      { to: '/access/reviews', label: 'Access reviews', permission: 'access_reviews.manage' },
      { to: '/access/sessions', label: 'Sessions', permission: 'sessions.manage' },
      { to: '/access/security', label: 'Security policy', permission: 'security.manage', keywords: 'ip allowlist step-up' },
    ],
  },
  {
    kind: 'leaf',
    id: 'settings',
    to: '/settings',
    label: 'System Settings',
    icon: Settings,
    permission: 'settings.manage',
    keywords: 'platform settings config',
    section: 'System',
  },
];

export type NavHit = { section: string; entryId: string; leaf: NavLeaf };

function matches(leaf: NavLeaf, pathname: string) {
  if (leaf.external) return false;
  return leaf.end || leaf.to === '/' ? pathname === leaf.to : pathname === leaf.to || pathname.startsWith(`${leaf.to}/`);
}

/** Longest matching nav leaf for a path, with the label to show as its breadcrumb parent. */
export function findNavLeaf(pathname: string): NavHit | null {
  let best: NavHit | null = null;
  for (const entry of NAV) {
    const leaves = entry.kind === 'leaf' ? [entry] : entry.children;
    for (const leaf of leaves) {
      if (matches(leaf, pathname) && (!best || leaf.to.length > best.leaf.to.length)) {
        best = { section: entry.kind === 'leaf' ? (entry.section ?? 'Home') : entry.label, entryId: entry.id, leaf };
      }
    }
  }
  return best;
}
