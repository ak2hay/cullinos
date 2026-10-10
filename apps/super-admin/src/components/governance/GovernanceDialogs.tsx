import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Dialog } from '@cullinos/ui';
import { rememberStepUpToken, useGovernanceStore } from '@/lib/governance';
import { iamApi } from '@/lib/platform-api';

const inputClass =
  'w-full rounded-lg border border-line bg-bg-card px-3 py-2 text-sm outline-none focus:border-accent';

function JustificationDialog({
  message,
  onDone,
}: {
  message: string;
  onDone: (v: { justification: string; ticketId?: string } | null) => void;
}) {
  const [text, setText] = useState('');
  const [ticketId, setTicketId] = useState('');
  const valid = text.trim().length >= 8;
  return (
    <Dialog
      open
      onClose={() => onDone(null)}
      title="Approval required"
      description={message}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onDone(null)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!valid}
            onClick={() => onDone({ justification: text.trim(), ticketId: ticketId.trim() || undefined })}
          >
            Send for approval
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-text-secondary">Why is this needed? (visible to approvers)</span>
          <textarea
            className={`${inputClass} mt-1 min-h-24`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
        </label>
        <label className="block text-sm">
          <span className="text-text-secondary">Support ticket ID (optional)</span>
          <input className={`${inputClass} mt-1`} value={ticketId} onChange={(e) => setTicketId(e.target.value)} />
        </label>
        {!valid ? <p className="text-xs text-text-muted">At least 8 characters.</p> : null}
      </div>
    </Dialog>
  );
}

function StepUpDialog({ message, onDone }: { message: string; onDone: (token: string | null) => void }) {
  const [challenge, setChallenge] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    iamApi
      .startStepUp()
      .then((r) => !cancelled && setChallenge(r.challengeToken))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  async function verify() {
    if (!challenge) return;
    setBusy(true);
    setError(null);
    try {
      const res = await iamApi.verifyStepUp(challenge, otp.trim());
      rememberStepUpToken(res.stepUpToken, Math.min(res.expiresInSeconds, 300));
      onDone(res.stepUpToken);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={() => onDone(null)}
      title="Confirm it's you"
      description={message}
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onDone(null)}>
            Cancel
          </Button>
          <Button size="sm" loading={busy} disabled={!challenge || otp.trim().length !== 6} onClick={verify}>
            Verify
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-secondary">
        {challenge ? 'We emailed you a 6-digit code.' : 'Sending a code to your email…'}
      </p>
      <input
        className={`${inputClass} mt-3 text-center font-mono text-lg tracking-[0.4em]`}
        inputMode="numeric"
        maxLength={6}
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
        autoFocus
      />
      {error ? <p className="mt-2 text-sm text-status-error">{error}</p> : null}
    </Dialog>
  );
}

/** Mounted once in the shell; serves prompts raised by apiRequest. */
export function GovernanceDialogs() {
  const prompt = useGovernanceStore((s) => s.prompt);
  const notice = useGovernanceStore((s) => s.notice);
  const setNotice = useGovernanceStore((s) => s.setNotice);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 12_000);
    return () => window.clearTimeout(t);
  }, [notice, setNotice]);

  return (
    <>
      {prompt?.kind === 'justification' ? (
        <JustificationDialog key="j" message={prompt.message} onDone={prompt.resolve} />
      ) : null}
      {prompt?.kind === 'step_up' ? <StepUpDialog key="s" message={prompt.message} onDone={prompt.resolve} /> : null}
      {notice ? (
        <div className="fixed bottom-4 right-4 z-50 w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-status-info/30 bg-bg-secondary p-4 shadow-lg">
          <p className="text-sm font-semibold">Sent for approval · {notice.ref}</p>
          <p className="mt-1 text-sm text-text-secondary">{notice.message}</p>
          <div className="mt-3 flex gap-3 text-sm">
            <Link to={`/approvals/${notice.id}`} className="font-medium text-accent hover:underline" onClick={() => setNotice(null)}>
              Track request
            </Link>
            <button type="button" className="text-text-muted hover:text-text-primary" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
