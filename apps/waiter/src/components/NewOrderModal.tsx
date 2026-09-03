import { Button } from '@/components/ui/Form';

interface NewOrderModalProps {
  tableName: string;
  onQrOrder: () => void;
  onWaiterOrder: () => void;
  onClose: () => void;
  loading?: boolean;
}

export function NewOrderModal({
  tableName,
  onQrOrder,
  onWaiterOrder,
  onClose,
  loading,
}: NewOrderModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold">New order — {tableName}</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Let guests scan a QR code to order from their phones, or take the order yourself.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Button loading={loading} onClick={onQrOrder}>
            Show QR to customers
          </Button>
          <Button variant="secondary" onClick={onWaiterOrder}>
            Take order on waiter app
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
