import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getBusinessTypeRules, outletUsesTables, type BusinessType } from '@cullinos/shared';
import { Button, useToast } from '@cullinos/ui';
import { OutletQrCard } from '@/components/ordering/OutletQrCard';
import { outletsApi, type Outlet } from '@/lib/api';

export function TableSystemCard({
  outlets,
  outlet,
  onSelectOutlet,
  businessType,
  enabledModules,
  orgSlug,
}: {
  outlets: Outlet[];
  outlet: Outlet | undefined;
  onSelectOutlet: (outletId: string) => void;
  businessType: BusinessType | null;
  enabledModules?: readonly string[] | null;
  orgSlug?: string | null;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const categoryDefault = getBusinessTypeRules(businessType).tables;
  const usesTables = outletUsesTables(businessType, outlet ?? null);
  const hasOverride = typeof outlet?.tablesEnabled === 'boolean';
  const planLacksTables = Array.isArray(enabledModules) && !enabledModules.includes('tables');

  const save = useMutation({
    meta: { autosave: true },
    mutationFn: (tablesEnabled: boolean | null) => {
      if (!outlet) throw new Error(t('settings.selectOutletForTables'));
      return outletsApi.update(outlet.id, { tablesEnabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlets'] });
      toast.success(t('settings.tablesSaved', { outlet: outlet?.name ?? '' }));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <div className="space-y-3 rounded-xl border border-line-subtle bg-bg-card p-5">
        <div>
          <h2 className="font-semibold">{t('settings.tableSystem')}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t('settings.tableSystemHint')}</p>
        </div>

        {outlets.length > 1 ? (
          <label className="block max-w-xs space-y-1">
            <span className="text-sm font-medium">{t('settings.tableSystemOutlet')}</span>
            <select
              value={outlet?.id ?? ''}
              onChange={(e) => onSelectOutlet(e.target.value)}
              className="h-11 w-full rounded-lg border border-line bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
            >
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {!outlet ? (
          <p className="text-sm text-text-muted">{t('settings.selectOutletForTables')}</p>
        ) : (
          <>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line-subtle bg-bg-elevated px-3 py-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-brand-primary"
                checked={usesTables}
                disabled={save.isPending}
                onChange={(e) => save.mutate(e.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium">{t('settings.useTables')}</span>
                <span className="block text-xs text-text-muted">
                  {usesTables ? t('settings.useTablesOnHint') : t('settings.useTablesOffHint')}
                </span>
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
              <span>
                {t('settings.tablesDefault', {
                  state: categoryDefault ? t('settings.tablesDefaultOn') : t('settings.tablesDefaultOff'),
                })}
              </span>
              {hasOverride ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={save.isPending}
                  onClick={() => save.mutate(null)}
                >
                  {t('settings.resetTablesDefault')}
                </Button>
              ) : null}
            </div>
            {usesTables && planLacksTables ? (
              <p className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-sm text-status-warning">
                {t('settings.tablesPlanNote')}
              </p>
            ) : null}
          </>
        )}
      </div>

      {outlet && !usesTables ? (
        <OutletQrCard orgSlug={orgSlug} outletSlug={outlet.slug} outletName={outlet.name} />
      ) : null}
    </>
  );
}
