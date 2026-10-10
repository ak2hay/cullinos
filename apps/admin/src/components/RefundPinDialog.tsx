import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button, Dialog } from '@cullinos/ui';
import { PinInput } from '@/components/PinInput';
import { ApiRequestError, ordersApi, refundPinApi, type Order } from '@/lib/api';
import { formatMoneyExact } from '@/lib/format';

export function RefundPinDialog({
  order,
  open,
  onClose,
  onRefunded,
}: {
  order: Order;
  open: boolean;
  onClose: () => void;
  onRefunded: (order: Order) => void;
}) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [externalPrompt, setExternalPrompt] = useState<string | null>(null);

  const pinStatus = useQuery({
    queryKey: ['refund-pin', 'status'],
    queryFn: refundPinApi.status,
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setPin('');
      setReason('');
      setError(null);
      setExternalPrompt(null);
    }
  }, [open]);

  const refundMutation = useMutation({
    mutationFn: (vars: { externalRefundConfirmed?: boolean }) =>
      ordersApi.refund(order.id, {
        pin,
        reason: reason.trim() || undefined,
        externalRefundConfirmed: vars.externalRefundConfirmed,
      }),
    onSuccess: (next) => {
      onRefunded(next);
    },
    onError: (err: Error, vars) => {
      if (
        err instanceof ApiRequestError &&
        err.code === 'EXTERNAL_REFUND_REQUIRED' &&
        !vars.externalRefundConfirmed
      ) {
        setExternalPrompt(err.message);
        return;
      }
      if (err instanceof ApiRequestError && err.code === 'REFUND_PIN_INVALID') setPin('');
      setError(err.message);
    },
  });

  const noPin = pinStatus.data && !pinStatus.data.isSet;
  const amount = order.paidAmount ?? order.totalAmount;

  function submit() {
    if (pin.length !== 4 || refundMutation.isPending) return;
    setError(null);
    refundMutation.mutate({});
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={t('orders.refundTitle', { number: order.orderNumber })}
      description={t('orders.refundDescription', { amount: formatMoneyExact(amount) })}
      footer={
        externalPrompt ? (
          <>
            <Button type="button" variant="secondary" onClick={() => setExternalPrompt(null)}>
              {t('orders.refundCancel')}
            </Button>
            <Button
              type="button"
              loading={refundMutation.isPending}
              onClick={() => refundMutation.mutate({ externalRefundConfirmed: true })}
            >
              {t('orders.refundExternalConfirm')}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('orders.refundCancel')}
            </Button>
            <Button
              type="button"
              loading={refundMutation.isPending}
              disabled={pin.length !== 4 || Boolean(noPin)}
              onClick={submit}
            >
              {t('orders.refundConfirm')}
            </Button>
          </>
        )
      }
    >
      {externalPrompt ? (
        <div className="space-y-2 text-sm">
          <p className="font-medium">{t('orders.refundExternalTitle')}</p>
          <p className="text-text-secondary">{externalPrompt}</p>
          <p className="text-text-muted">{t('orders.confirmExternalRefund')}</p>
        </div>
      ) : noPin ? (
        <div className="space-y-2 text-sm">
          <p className="text-text-secondary">{t('orders.refundNoPin')}</p>
          <Link to="/profile" className="font-medium text-brand-primary hover:underline">
            {t('orders.refundSetPin')}
          </Link>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <PinInput
            label={t('orders.refundPasscode')}
            value={pin}
            onChange={setPin}
            autoFocus
            disabled={refundMutation.isPending}
          />
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-text-secondary">{t('orders.refundReason')}</span>
            <input
              value={reason}
              maxLength={200}
              placeholder={t('orders.refundReasonPlaceholder')}
              onChange={(e) => setReason(e.target.value)}
              className="h-10 w-full rounded-lg border border-line bg-bg-elevated px-3 outline-none focus:border-brand-primary"
            />
          </label>
          {error ? <p className="text-sm text-status-error">{error}</p> : null}
        </form>
      )}
    </Dialog>
  );
}
