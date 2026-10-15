import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@cullinos/ui';
import { AuthError, AuthLayout, AuthNote } from '@/components/auth/AuthLayout';
import { inputClass, LabeledInput } from '@/components/common';
import { approvalsApi } from '@/lib/platform-api';

const STATUS_COPY: Record<string, string> = {
  approved: 'This request is approved.',
  executing: 'This request is approved and running.',
  executed: 'This request was approved and applied.',
  rejected: 'This request was rejected.',
  expired: 'This request expired before enough approvals.',
  cancelled: 'The requester cancelled this request.',
};

/** Landing page for the Approve / Reject buttons in approval emails; works without signing in. */
export function EmailApprovalPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [decision, setDecision] = useState<'approved' | 'rejected'>(
    params.get('action') === 'reject' ? 'rejected' : 'approved',
  );
  const [comment, setComment] = useState('');

  const preview = useQuery({
    queryKey: ['approval-email', token],
    queryFn: () => approvalsApi.emailPreview(token),
    enabled: token.length >= 20,
    retry: false,
  });
  const decide = useMutation({
    mutationFn: () => approvalsApi.emailDecide(token, decision, comment.trim() || undefined),
  });

  const data = decide.data ?? preview.data;
  const rejecting = decision === 'rejected';

  return (
    <AuthLayout
      title={data ? `${data.ref} · ${rejecting ? 'Reject' : 'Approve'}` : 'Approval request'}
      subtitle={data ? data.title : undefined}
    >
      {!token || token.length < 20 ? (
        <AuthError>This approval link is incomplete. Open it again from the email.</AuthError>
      ) : preview.isLoading ? (
        <AuthNote>Loading request…</AuthNote>
      ) : preview.error && !data ? (
        <AuthError>{preview.error instanceof Error ? preview.error.message : 'This approval link is not valid'}</AuthError>
      ) : data ? (
        <div className="space-y-4">
          <dl className="space-y-3 rounded-xl border border-line bg-bg-elevated p-4 text-sm">
            <div>
              <dt className="text-text-muted">Requested by</dt>
              <dd className="font-medium">{data.requestedBy ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Reason</dt>
              <dd className="whitespace-pre-wrap">{data.justification}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Action</dt>
              <dd className="font-mono text-xs">{data.actionKey}</dd>
            </div>
          </dl>

          {decide.data ? (
            <AuthNote>
              Your {decide.data.recorded === 'approved' ? 'approval' : 'rejection'} was recorded.{' '}
              {STATUS_COPY[decide.data.status] ?? 'More approvals are still needed.'}
            </AuthNote>
          ) : data.canDecide ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                decide.mutate();
              }}
            >
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={rejecting ? 'secondary' : 'primary'}
                  className="flex-1"
                  onClick={() => setDecision('approved')}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  variant={rejecting ? 'danger' : 'secondary'}
                  className="flex-1"
                  onClick={() => setDecision('rejected')}
                >
                  Reject
                </Button>
              </div>
              <LabeledInput
                label={rejecting ? 'Why are you rejecting it?' : 'Comment (optional)'}
                hint="Shared with the requester."
              >
                <textarea
                  className={`${inputClass} min-h-20`}
                  required={rejecting}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </LabeledInput>
              {decide.error ? (
                <AuthError>{decide.error instanceof Error ? decide.error.message : 'Could not record your decision'}</AuthError>
              ) : null}
              <Button
                type="submit"
                variant={rejecting ? 'danger' : 'primary'}
                className="w-full"
                loading={decide.isPending}
                disabled={rejecting && !comment.trim()}
              >
                Confirm {rejecting ? 'rejection' : 'approval'}
              </Button>
              <p className="text-xs text-text-muted">
                Signed as {data.approverName ?? 'you'}. This link works once and expires{' '}
                {new Date(data.linkExpiresAt).toLocaleString()}.
              </p>
            </form>
          ) : (
            <AuthNote>
              {data.status !== 'pending'
                ? (STATUS_COPY[data.status] ?? `This request is ${data.status}.`)
                : data.linkState === 'used'
                  ? 'You already used this link.'
                  : 'This link has expired.'}{' '}
              Sign in to review it in the platform.
            </AuthNote>
          )}

          <Link to={`/approvals/${data.requestId}`} className="block text-center text-sm text-accent hover:underline">
            Open in the platform
          </Link>
        </div>
      ) : null}
    </AuthLayout>
  );
}
