import { useQuery } from '@tanstack/react-query';
import { appOpenHref, isAndroid, orderApi, playStoreHref } from '@/lib/api';

export function AppBanner({
  org,
  outlet,
  table,
  session,
}: {
  org?: string;
  outlet?: string;
  table?: string;
  session?: string;
}) {
  const config = useQuery({
    queryKey: ['app-config'],
    queryFn: () => orderApi.appConfig(),
    staleTime: 10 * 60_000,
    retry: false,
  });

  const q = new URLSearchParams();
  if (table) q.set('table', table);
  if (session) q.set('session', session);
  const qs = q.toString() ? `?${q.toString()}` : '';
  const scheme =
    org && outlet
      ? `cullinos://outlet/${encodeURIComponent(org)}/${encodeURIComponent(outlet)}${qs}`
      : 'cullinos://outlet';

  const playUrl = config.data?.playStoreUrl?.trim() || '';

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle bg-bg-card px-4 py-2.5 text-sm">
      <p className="text-text-secondary">Have the Cullinos app?</p>
      <div className="flex items-center gap-3">
        <a href={appOpenHref({ org, outlet, table, session })} className="font-semibold text-brand-primary">
          Open the app
        </a>
        {playUrl ? (
          <a href={playStoreHref(playUrl, scheme)} className="font-semibold text-brand-primary" rel="noopener">
            {isAndroid() ? 'Google Play' : 'Get the app'}
          </a>
        ) : null}
      </div>
    </div>
  );
}
