import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Card, CardHeader, Input, PageShell, useToast } from '@cullinos/ui';
import { menuApi, outletsApi, type OutletKitchenStation } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const KDS_BASE =
  (import.meta.env.VITE_KDS_URL as string | undefined) ??
  (import.meta.env.PROD ? 'https://kds.cullinos.com' : 'http://localhost:5174');

function stationScreenUrl(outletId: string, code: string) {
  const base = KDS_BASE.replace(/\/$/, '');
  return `${base}/?outletId=${encodeURIComponent(outletId)}&station=${encodeURIComponent(code)}`;
}

export function StationsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const selectedOutletId = useAuthStore((s) => s.selectedOutletId);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [scope, setScope] = useState<'all' | 'selected'>('all');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const stationsQuery = useQuery({
    queryKey: ['menu', 'kitchen-stations', 'outlets'],
    queryFn: menuApi.listOutletStations,
  });

  const outlets = outletsQuery.data ?? [];
  const stations = stationsQuery.data ?? [];
  const multiOutlet = outlets.length > 1;
  const selectedOutletName = outlets.find((o) => o.id === selectedOutletId)?.name ?? 'this outlet';

  function refresh(next?: OutletKitchenStation[]) {
    if (next) queryClient.setQueryData(['menu', 'kitchen-stations', 'outlets'], next);
    queryClient.invalidateQueries({ queryKey: ['menu', 'kitchen-stations'] });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      menuApi.createStation({
        name: name.trim(),
        code: code.trim() || undefined,
        outletIds: scope === 'selected' && selectedOutletId ? [selectedOutletId] : undefined,
      }),
    onSuccess: (next) => {
      toast.success('Station saved.');
      setName('');
      setCode('');
      refresh(next);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name?: string; isActive?: boolean }) =>
      menuApi.updateStation(id, payload),
    onSuccess: (next) => {
      setRenaming(null);
      refresh(next);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: menuApi.deleteStation,
    onSuccess: (next) => {
      toast.success('Station removed.');
      refresh(next);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const byOutlet = outlets.map((outlet) => ({
    outlet,
    stations: stations.filter((s) => s.outletId === outlet.id),
  }));

  return (
    <PageShell
      title="Kitchen stations"
      description="Split kitchen tickets (KOTs) by station — e.g. Tandoor, Chinese, Bar, Desserts. Each station gets its own ticket and its own KDS screen."
    >
      <Card>
        <CardHeader title="How routing works" />
        <ol className="list-decimal space-y-1 pl-5 text-sm text-text-secondary">
          <li>Create the stations your kitchen has.</li>
          <li>
            In <strong>Menu → Categories</strong>, set a category&apos;s ticket station (all its
            items go there). Override single items in the item editor.
          </li>
          <li>
            When an order is sent, one KOT prints per station. Items without a station go on the
            main kitchen ticket.
          </li>
          <li>Open each station&apos;s KDS link on the screen mounted at that station.</li>
        </ol>
      </Card>

      <Card>
        <CardHeader title="Add station" />
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) {
              toast.error('Enter a station name.');
              return;
            }
            createMutation.mutate();
          }}
        >
          <Input
            label="Station name"
            placeholder="Tandoor"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Code (optional)"
            placeholder="TANDOOR"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          {multiOutlet ? (
            <label className="space-y-1 text-sm">
              <span className="text-text-secondary">Outlets</span>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as 'all' | 'selected')}
                className="block h-11 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
              >
                <option value="all">All outlets</option>
                <option value="selected">Only {selectedOutletName}</option>
              </select>
            </label>
          ) : null}
          <div className="flex items-end">
            <Button type="submit" loading={createMutation.isPending}>
              Add station
            </Button>
          </div>
        </form>
        <p className="mt-2 text-xs text-text-muted">
          The code links categories and items to the station across outlets (letters, digits, _ or
          -). Leave it blank to generate one from the name.
        </p>
      </Card>

      {stationsQuery.isLoading ? (
        <p className="text-sm text-text-muted">Loading stations…</p>
      ) : (
        byOutlet.map(({ outlet, stations: outletStations }) => (
          <Card key={outlet.id} padding="none" className="overflow-hidden">
            <div className="border-b border-white/5 px-4 py-3">
              <p className="font-medium">{outlet.name}</p>
              <p className="text-xs text-text-muted">
                Main kitchen screen:{' '}
                <a
                  href={stationScreenUrl(outlet.id, 'DEFAULT')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-primary hover:underline"
                >
                  open KDS
                </a>
              </p>
            </div>
            {outletStations.length === 0 ? (
              <p className="px-4 py-6 text-sm text-text-muted">
                No stations yet — every item goes on one kitchen ticket.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/5 bg-bg-secondary text-text-muted">
                    <th className="px-4 py-3 font-medium">Station</th>
                    <th className="px-4 py-3 font-medium">Code</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">KDS screen</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {outletStations.map((station) => (
                    <tr key={station.id} className="border-b border-white/5">
                      <td className="px-4 py-3 font-medium">
                        {renaming?.id === station.id ? (
                          <form
                            className="flex gap-2"
                            onSubmit={(e) => {
                              e.preventDefault();
                              updateMutation.mutate({ id: station.id, name: renaming.name });
                            }}
                          >
                            <Input
                              label=""
                              value={renaming.name}
                              onChange={(e) => setRenaming({ id: station.id, name: e.target.value })}
                            />
                            <Button type="submit" size="sm" loading={updateMutation.isPending}>
                              Save
                            </Button>
                          </form>
                        ) : (
                          station.name
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-text-secondary">{station.code}</td>
                      <td className="px-4 py-3">
                        <label className="flex cursor-pointer items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-brand-primary"
                            checked={station.isActive}
                            disabled={updateMutation.isPending}
                            onChange={(e) =>
                              updateMutation.mutate({ id: station.id, isActive: e.target.checked })
                            }
                          />
                          {station.isActive ? 'Receiving tickets' : 'Paused'}
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={stationScreenUrl(station.outletId, station.code)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-brand-primary hover:underline"
                        >
                          Open KDS
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setRenaming({ id: station.id, name: station.name })}
                          >
                            Rename
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            loading={deleteMutation.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete ${station.name} at ${outlet.name}? Its items will go on the main kitchen ticket.`,
                                )
                              ) {
                                deleteMutation.mutate(station.id);
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        ))
      )}
    </PageShell>
  );
}
