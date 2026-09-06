import { useState } from 'react';
import { formatMoney } from '@/lib/format';
import { useCartStore } from '@/stores/cart';

interface UnpaidTicket {
  id: string;
  orderNumber: string;
}

export interface PosCustomer {
  id: string;
  name: string;
  phone: string | null;
  loyaltyPoints: number;
}

interface CartSidebarProps {
  onCash: () => void;
  onOnline: () => void;
  unpaidOrder?: UnpaidTicket | null;
  onRetryUnpaidCash?: () => void;
  onRetryUnpaidOnline?: () => void;
  onHold: () => void;
  onClear: () => void;
  checkoutLoading: boolean;
  holdLoading: boolean;
  counterMode?: boolean;
  customerName?: string;
  onCustomerNameChange?: (name: string) => void;
  customerPhone?: string;
  onCustomerPhoneChange?: (phone: string) => void;
  onLookupCustomer?: () => void;
  customerLookupLoading?: boolean;
  linkedCustomer?: PosCustomer | null;
  onClearCustomer?: () => void;
  orderType?: 'takeaway' | 'dine_in';
  onOrderTypeChange?: (type: 'takeaway' | 'dine_in') => void;
  tipAmount?: number;
  onTipChange?: (tip: number) => void;
  rewards?: Array<{ id: string; name: string; pointsCost: number; affordable: boolean }>;
  onRedeemReward?: (rewardId: string) => void;
  redeemRewardLoading?: boolean;
  redeemPoints?: number;
  onRedeemPointsChange?: (points: number) => void;
  loyaltySettings?: { minRedeem: number; redemptionValue: number } | null;
}

export function CartSidebar({
  onCash,
  onOnline,
  unpaidOrder,
  onRetryUnpaidCash,
  onRetryUnpaidOnline,
  onHold,
  onClear,
  checkoutLoading,
  holdLoading,
  counterMode = false,
  customerName = '',
  onCustomerNameChange,
  customerPhone = '',
  onCustomerPhoneChange,
  onLookupCustomer,
  customerLookupLoading,
  linkedCustomer,
  onClearCustomer,
  orderType = 'takeaway',
  onOrderTypeChange,
  tipAmount = 0,
  onTipChange,
  rewards = [],
  onRedeemReward,
  redeemRewardLoading,
  redeemPoints = 0,
  onRedeemPointsChange,
  loyaltySettings = null,
}: CartSidebarProps) {
  const lines = useCartStore((s) => s.lines);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const subtotal = useCartStore((s) => s.subtotal());
  const itemCount = useCartStore((s) => s.itemCount());
  const [tenderOpen, setTenderOpen] = useState(false);
  const canCharge = lines.length > 0 && !checkoutLoading;
  const tipPaise = tipAmount ? tipAmount * 100 : 0;
  const discountPaise =
    redeemPoints > 0 && loyaltySettings
      ? Math.round(redeemPoints * loyaltySettings.redemptionValue * 100)
      : 0;
  const duePaise = Math.max(0, subtotal + tipPaise - discountPaise);

  return (
    <aside className="flex w-full shrink-0 flex-col border-t border-white/5 bg-bg-secondary lg:w-[26rem] lg:border-l lg:border-t-0">
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">Current order</h2>
          <p className="text-sm text-text-muted">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </p>
        </div>
        {itemCount > 0 ? (
          <span className="rounded-full bg-brand-primary/15 px-3 py-1 font-mono text-sm font-semibold text-brand-primary">
            {formatMoney(duePaise)}
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {lines.length === 0 ? (
          <div className="flex h-full min-h-[8rem] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/10 bg-bg-primary/40 px-4 py-8 text-center">
            <p className="text-sm font-medium text-text-secondary">Cart is empty</p>
            <p className="text-xs text-text-muted">Tap menu items to build the order</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {lines.map((line) => (
              <li
                key={line.menuItemId}
                className="rounded-xl border border-white/5 bg-bg-card/90 p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium leading-tight">{line.name}</p>
                  <button
                    type="button"
                    onClick={() => removeItem(line.menuItemId)}
                    className="text-sm text-text-muted hover:text-status-error"
                    aria-label="Remove item"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQuantity(line.menuItemId, line.quantity - 1)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-elevated text-lg font-bold active:scale-95"
                    >
                      −
                    </button>
                    <span className="min-w-[2rem] text-center font-mono text-lg">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(line.menuItemId, line.quantity + 1)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/20 text-lg font-bold text-brand-primary active:scale-95"
                    >
                      +
                    </button>
                  </div>
                  <span className="font-mono text-brand-primary">
                    {formatMoney(line.unitPrice * line.quantity)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t border-white/5 p-4">
        {counterMode ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="tel"
                placeholder="Phone (loyalty)"
                value={customerPhone}
                onChange={(e) => onCustomerPhoneChange?.(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onLookupCustomer?.();
                  }
                }}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
              />
              <button
                type="button"
                disabled={customerLookupLoading || !customerPhone.trim()}
                onClick={onLookupCustomer}
                className="shrink-0 rounded-xl border border-white/10 bg-bg-elevated px-3 text-sm font-medium disabled:opacity-40"
              >
                {customerLookupLoading ? '…' : 'Find'}
              </button>
            </div>
            {linkedCustomer ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{linkedCustomer.name}</p>
                    <p className="text-xs text-brand-primary">
                      {linkedCustomer.loyaltyPoints} pts wallet
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClearCustomer}
                    className="text-xs text-text-muted hover:text-text-primary"
                  >
                    Clear
                  </button>
                </div>
                {linkedCustomer.loyaltyPoints > 0 ? (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-text-muted">
                      Redeem points
                      {loyaltySettings ? ` (min ${loyaltySettings.minRedeem})` : ''}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={linkedCustomer.loyaltyPoints}
                      value={redeemPoints || ''}
                      onChange={(e) =>
                        onRedeemPointsChange?.(Math.max(0, Number(e.target.value) || 0))
                      }
                      placeholder="0"
                      className="w-full rounded-xl border border-white/10 bg-bg-primary px-3 py-2 text-sm outline-none focus:border-brand-primary"
                    />
                    {redeemPoints > 0 && loyaltySettings ? (
                      <p className="text-xs text-text-muted">
                        ≈ ₹{(redeemPoints * loyaltySettings.redemptionValue).toFixed(0)} off ·
                        balance after: {linkedCustomer.loyaltyPoints - redeemPoints} pts
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {rewards.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-text-muted">Redeem rewards</p>
                    {rewards.map((reward) => (
                      <button
                        key={reward.id}
                        type="button"
                        disabled={!reward.affordable || redeemRewardLoading}
                        onClick={() => onRedeemReward?.(reward.id)}
                        className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-left text-xs disabled:opacity-40"
                      >
                        <span>{reward.name}</span>
                        <span className="font-mono text-brand-primary">{reward.pointsCost} pts</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <input
              type="text"
              placeholder="Name on order"
              value={customerName}
              onChange={(e) => onCustomerNameChange?.(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-bg-primary px-3 py-2.5 text-sm outline-none focus:border-brand-primary"
            />
            <div className="grid grid-cols-2 gap-2">
              {(['takeaway', 'dine_in'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onOrderTypeChange?.(type)}
                  className={`rounded-xl border px-2 py-3 text-sm font-semibold transition active:scale-[0.98] ${
                    orderType === type
                      ? 'border-brand-primary bg-brand-primary text-bg-primary shadow-md shadow-brand-primary/20'
                      : 'border-white/10 bg-bg-elevated text-text-secondary'
                  }`}
                >
                  {type === 'takeaway' ? 'Pickup' : 'Eat in'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-xs text-text-muted">Tip (₹)</label>
              <input
                type="number"
                min={0}
                value={tipAmount || ''}
                onChange={(e) => onTipChange?.(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-white/10 bg-bg-primary px-3 py-2 text-sm outline-none focus:border-brand-primary"
              />
            </div>
          </div>
        ) : null}

        {discountPaise > 0 ? (
          <div className="flex items-center justify-between text-sm text-text-muted">
            <span>Loyalty discount</span>
            <span className="font-mono">−{formatMoney(discountPaise)}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between text-lg">
          <span className="text-text-secondary">Subtotal</span>
          <span className="font-mono font-semibold text-brand-primary">
            {formatMoney(duePaise)}
          </span>
        </div>

        {unpaidOrder ? (
          <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 p-3 text-sm">
            <p className="font-medium">Order #{unpaidOrder.orderNumber} unpaid</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={checkoutLoading}
                onClick={onRetryUnpaidCash}
                className="rounded-lg bg-brand-primary px-2 py-2 text-xs font-semibold text-bg-primary disabled:opacity-40"
              >
                Cash
              </button>
              <button
                type="button"
                disabled={checkoutLoading}
                onClick={onRetryUnpaidOnline}
                className="rounded-lg border border-white/10 px-2 py-2 text-xs font-semibold disabled:opacity-40"
              >
                UPI / card
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          disabled={!canCharge}
          onClick={() => setTenderOpen(true)}
          className="h-14 w-full rounded-2xl bg-brand-primary text-lg font-bold text-bg-primary shadow-lg shadow-brand-primary/20 transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
        >
          {checkoutLoading ? 'Processing…' : 'Charge'}
        </button>

        {tenderOpen && canCharge ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={checkoutLoading}
              onClick={() => {
                setTenderOpen(false);
                onCash();
              }}
              className="h-12 rounded-xl bg-brand-primary/20 font-medium text-brand-primary disabled:opacity-40"
            >
              Cash (Enter)
            </button>
            <button
              type="button"
              disabled={checkoutLoading}
              onClick={() => {
                setTenderOpen(false);
                onOnline();
              }}
              className="h-12 rounded-xl border border-white/10 font-medium disabled:opacity-40"
            >
              UPI / card
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={lines.length === 0 || holdLoading}
            onClick={onHold}
            className="h-12 rounded-xl border border-white/10 bg-bg-elevated font-medium transition active:scale-[0.98] disabled:opacity-40"
          >
            {holdLoading ? 'Holding…' : 'Hold (H)'}
          </button>
          <button
            type="button"
            disabled={lines.length === 0}
            onClick={onClear}
            className="h-12 rounded-xl border border-white/10 bg-bg-elevated font-medium text-status-error transition active:scale-[0.98] disabled:opacity-40"
          >
            Clear (Esc)
          </button>
        </div>
      </div>
    </aside>
  );
}
