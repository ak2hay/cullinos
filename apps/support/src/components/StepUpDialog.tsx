import { useEffect, useState } from 'react';
import { Button, Dialog } from '@cullinos/ui';
import { Notice, inputClass } from '@/components/common';
import { errorMessage } from '@/lib/api';
import { rememberStepUpToken, useStepUpStore } from '@/lib/step-up';
import { agentApi } from '@/lib/support-api';

function StepUpForm({ message, onDone }: { message: string; onDone: (token: string | null) => void }) {
  const [challenge, setChallenge] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    agentApi
      .startStepUp()
      .then((r) => !cancelled && setChallenge(r.challengeToken))
      .catch((e: unknown) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  async function verify() {
    if (!challenge) return;
    setBusy(true);
    setError(null);
    try {
      const res = await agentApi.verifyStepUp(challenge, otp.trim());
      rememberStepUpToken(res.stepUpToken, Math.min(res.expiresInSeconds, 300));
      onDone(res.stepUpToken);
    } catch (e) {
      setError(errorMessage(e));
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
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">{challenge ? 'We emailed you a 6-digit code.' : 'Sending a code to your email…'}</p>
        <input
          className={inputClass}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
        />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </Dialog>
  );
}

export function StepUpDialog() {
  const prompt = useStepUpStore((s) => s.prompt);
  if (!prompt) return null;
  return <StepUpForm message={prompt.message} onDone={prompt.resolve} />;
}
