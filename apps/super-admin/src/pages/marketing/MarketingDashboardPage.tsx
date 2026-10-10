import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Download,
  Eye,
  FileText,
  Image,
  Inbox,
  LayoutTemplate,
  Menu,
  MessageSquareQuote,
  Newspaper,
  Palette,
  Rocket,
  Sparkles,
  Tag,
} from 'lucide-react';
import { Button } from '@cullinos/ui';
import { Card, PageHeader, SectionCard } from '@/components/ui';
import { Notice } from '@/components/common';
import { relativeTime } from '@/lib/format';
import { MARKETING_WEB_URL, marketingApi } from '@/lib/marketing-api';

const SECTIONS = [
  { to: '/marketing/inquiries', label: 'Inquiries', desc: 'Leads from the contact form', icon: Inbox },
  { to: '/marketing/media', label: 'Media library', desc: 'Upload and replace hero & mockup images', icon: Image },
  { to: '/marketing/hero', label: 'Hero carousel', desc: 'Edit home page slide copy and images', icon: LayoutTemplate },
  { to: '/marketing/pages', label: 'Pages & blocks', desc: 'Structured sections and copy blocks', icon: FileText },
  { to: '/marketing/theme', label: 'Theme', desc: 'Colors, fonts, and brand tokens', icon: Palette },
  { to: '/marketing/pricing', label: 'Pricing cards', desc: 'Marketing pricing display', icon: Tag },
  { to: '/marketing/testimonials', label: 'Testimonials', desc: 'Customer quotes and social proof', icon: MessageSquareQuote },
  { to: '/marketing/navigation', label: 'Navigation', desc: 'Header nav links', icon: Menu },
  { to: '/marketing/blog', label: 'Blog', desc: 'Create, edit, publish, delete posts', icon: Newspaper },
  { to: '/marketing/design-lab', label: 'Design lab', desc: 'Presets, prompts, and suggestions', icon: Sparkles },
];

export function MarketingDashboardPage() {
  const queryClient = useQueryClient();
  const { data: site } = useQuery({ queryKey: ['marketing', 'site'], queryFn: marketingApi.getSite });
  const { data: inquiryCount } = useQuery({
    queryKey: ['marketing', 'inquiries-count'],
    queryFn: marketingApi.countNewInquiries,
  });

  const seedMutation = useMutation({
    mutationFn: marketingApi.seedFromCode,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing'] }),
  });
  const publishMutation = useMutation({
    mutationFn: marketingApi.publish,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing'] }),
  });
  const previewMutation = useMutation({
    mutationFn: marketingApi.previewToken,
    onSuccess: ({ token }) => {
      window.open(`${MARKETING_WEB_URL}?preview=${token}`, '_blank');
    },
  });

  const newInquiries = inquiryCount?.count ?? 0;
  const lastPublished = site?.lastPublishedAt ? String(site.lastPublishedAt) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing CMS"
        description="Manage the public marketing site at cullinos.com — content, images, theme, blog, and contact inquiries."
      />

      {newInquiries > 0 ? (
        <Link
          to="/marketing/inquiries"
          className="flex items-center justify-between gap-4 rounded-xl border border-accent/30 bg-accent/8 px-5 py-4 transition hover:bg-accent/12"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Inbox size={18} aria-hidden="true" />
            </span>
            <span>
              <span className="block font-medium">
                {newInquiries} new website inquir{newInquiries === 1 ? 'y' : 'ies'}
              </span>
              <span className="block text-sm text-text-secondary">Open the inquiries inbox</span>
            </span>
          </span>
          <ArrowRight size={18} className="text-accent" aria-hidden="true" />
        </Link>
      ) : null}

      <SectionCard
        title="Publishing"
        description={lastPublished ? `Last published ${relativeTime(lastPublished)} · ${new Date(lastPublished).toLocaleString()}` : 'The site has never been published.'}
        actions={
          <>
            <Button size="sm" variant="ghost" loading={seedMutation.isPending} onClick={() => seedMutation.mutate()}>
              <Download size={16} aria-hidden="true" />
              Import from codebase
            </Button>
            <Button size="sm" variant="secondary" loading={previewMutation.isPending} onClick={() => previewMutation.mutate()}>
              <Eye size={16} aria-hidden="true" />
              Preview draft
            </Button>
            <Button size="sm" loading={publishMutation.isPending} onClick={() => publishMutation.mutate()}>
              <Rocket size={16} aria-hidden="true" />
              Publish site
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">Edits are saved as drafts. Preview them on the live site, then publish to go live.</p>
        {seedMutation.error ? <Notice tone="error" className="mt-3">{String(seedMutation.error.message)}</Notice> : null}
        {publishMutation.error ? <Notice tone="error" className="mt-3">{String(publishMutation.error.message)}</Notice> : null}
        {previewMutation.error ? <Notice tone="error" className="mt-3">{String(previewMutation.error.message)}</Notice> : null}
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map((item) => (
          <Link key={item.to} to={item.to} className="group rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <Card className="flex h-full items-start gap-4 p-5 transition group-hover:border-accent/40 group-hover:shadow-md">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <item.icon size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-medium">
                  {item.label}
                  {item.to === '/marketing/inquiries' && newInquiries > 0 ? (
                    <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-white">{newInquiries}</span>
                  ) : null}
                </span>
                <span className="mt-1 block text-sm text-text-secondary">{item.desc}</span>
              </span>
              <ArrowRight size={16} className="mt-1 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden="true" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
