import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '@cullinos/ui';
import { PageHeader, SectionCard } from '@/components/ui';
import { inputClass, LabeledInput, MutationError, Notice, splitList } from '@/components/common';
import { iamApi } from '@/lib/platform-api';

export function SecurityPolicyPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['super-admin', 'security-policy'], queryFn: iamApi.security });
  const [stepUp, setStepUp] = useState(false);
  const [allowlist, setAllowlist] = useState('');
  useEffect(() => {
    if (!query.data) return;
    setStepUp(query.data.stepUpCritical);
    setAllowlist(query.data.globalIpAllowlist.join('\n'));
  }, [query.data]);
  const save = useMutation({
    mutationFn: () => iamApi.updateSecurity({ stepUpCritical: stepUp, globalIpAllowlist: splitList(allowlist) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['super-admin', 'security-policy'] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Security policy" description="Platform-wide controls for every staff session. Changes go through approval." />
      {save.isSuccess ? <Notice tone="success">Saved.</Notice> : null}
      <SectionCard title="Step-up verification">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" checked={stepUp} onChange={(e) => setStepUp(e.target.checked)} />
          <span>
            Ask for an emailed one-time code before critical actions (deleting tenants, wallet adjustments, role grants, secret changes and
            similar). A code is valid for a few minutes across actions.
          </span>
        </label>
      </SectionCard>
      <SectionCard title="Network allowlist">
        <LabeledInput
          label="Allowed IPs / IPv4 CIDR ranges"
          hint="One per line. Empty means any network. Your current IP must be included or the change is refused. Teams and roles can add stricter lists."
        >
          <textarea className={`${inputClass} min-h-32 font-mono text-xs`} value={allowlist} onChange={(e) => setAllowlist(e.target.value)} />
        </LabeledInput>
      </SectionCard>
      <MutationError error={save.error} />
      <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>
        Save policy
      </Button>
    </div>
  );
}
