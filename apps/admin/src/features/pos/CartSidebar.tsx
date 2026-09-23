import { useState } from 'react';
import { PhoneField } from '@cullinos/ui';
import { formatMoney } from '@/lib/format';
import { useCartStore } from './cartStore';

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
  cashDisabled?: boolean;
  unpaidOrder?: UnpaidTicket | null;
  unpaidBalance?: { total: number; remaining: number; paid: number } | null;
  splitItems?: Array<{ id: string; name: string; quantity: number }>;
  splitSelectedIds?: string[];
  onToggleSplitItem?: (id: string) => void;
  onSplit?: () => void;
  splitLoading?: boolean;
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
  couponCode?: string;
  onCouponCodeChange?: (code: string) => void;
  manualDiscount?: number;
  onManualDiscountChange?: (amount: number) => void;
  partialCashAmount?: number;
  onPartialCashAmountChange?: (amount: number | undefined) => void;
}

export function CartSidebar({
  onCash,
  onOnline,
  cashDisabled = false,
  unpaidOrder,
  unpaidBalance = null,
  splitItems = [],
  splitSelectedIds = [],
  onToggleSplitItem,
  onSplit,
  splitLoading = false,
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
  couponCode = '',
  onCouponCodeChange,
  manualDiscount = 0,
  onManualDiscountChange,
  partialCashAmount,
  onPartialCashAmountChange,
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
    <aside className="flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-t border-white/5 bg-bg-secondary lg:w-[26rem] lg:border-l lg:border-t-0">
      <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-5 py-4">
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

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/10 bg-bg-primary/40 px-4 py-8 text-center">
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

        {counterMode ? (
          <div className="space-y-2">
            <div className="space-y-2">
              <PhoneField
                label="Phone (loyalty)"
                value={customerPhone}
                onChange={(phone) => onCustomerPhoneChange?.(phone)}
              />
              <button
                type="button"
                disabled={customerLookupLoading || !customerPhone.trim()}
                onClick={onLookupCustomer}
                className="w-full shrink-0 rounded-xl border border-white/10 bg-bg-elevated px-3 py-2.5 text-sm font-medium disabled:opacity-40"
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

                {/* Loyalty redeem — always visible when a customer is linked */}
                <div className="rounded-xl border border-white/10 bg-bg-primary/60 px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-text-secondary">Redeem loyalty points</p>
                    {loyaltySettings ? (
                      <span className="text-[10px] text-text-muted">
                        min {loyaltySettings.minRedeem} pts
                      </span>
                    ) : null}
                  </div>
                  {linkedCustomer.loyaltyPoints > 0 ? (
                    <>
                      <input
                        type="number"
                        min={0}
                        max={linkedCustomer.loyaltyPoints}
                        value={redeemPoints || ''}
                        onChange={(e) =>
                          onRedeemPointsChange?.(Math.max(0, Number(e.target.value) || 0))
                        }
                        placeholder={`0 – ${linkedCustomer.loyaltyPoints} pts available`}
                        className="w-full rounded-xl border border-white/10 bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-brand-primary"
                      />
                      {redeemPoints > 0 && loyaltySettings ? (
                        <p className="text-xs text-text-muted">
                          ≈ ₹{(redeemPoints * loyaltySettings.redemptionValue).toFixed(0)} off ·
                          balance after: {linkedCustomer.loyaltyPoints - redeemPoints} pts
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-xs text-text-muted">
                      No points yet — will earn on this order
                    </p>
                  )}
                </div>

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
            ) : (
              <p className="px-1 text-xs text-text-muted">Enter phone to redeem loyalty points</p>
            )}
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
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-xs text-text-muted">Coupon</label>
              <input
                value={couponCode}
                onChange={(e) => onCouponCodeChange?.(e.target.value)}
                placeholder="CODE"
                className="w-full rounded-xl border border-white/10 bg-bg-primary px-3 py-2 text-sm outline-none focus:border-brand-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-xs text-text-muted">Discount (₹)</label>
              <input
                type="number"
                min={0}
                value={manualDiscount || ''}
                onChange={(e) => onManualDiscountChange?.(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-white/10 bg-bg-primary px-3 py-2 text-sm outline-none focus:border-brand-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-xs text-text-muted">Pay amount (₹)</label>
              <input
                type="number"
                min={0}
                value={partialCashAmount ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  onPartialCashAmountChange?.(v === '' ? undefined : Number(v) || 0);
                }}
                placeholder="Full"
                className="w-full rounded-xl border border-white/10 bg-bg-primary px-3 py-2 text-sm outline-none focus:border-brand-primary"
              />
            </div>
          </div>
        ) : null}

        {unpaidOrder ? (
          <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 p-3 text-sm">
            <p className="font-medium">Order #{unpaidOrder.orderNumber} unpaid</p>
            {unpaidBalance ? (
              <p className="mt-1 font-mono text-xs text-text-secondary">
                Paid ₹{unpaidBalance.paid.toFixed(2)} · Remaining ₹
                {unpaidBalance.remaining.toFixed(2)} / ₹{unpaidBalance.total.toFixed(2)}
              </p>
            ) : null}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={checkoutLoading || cashDisabled}
                onClick={onRetryUnpaidCash}
                className="rounded-lg bg-brand-primary px-2 py-2 text-xs font-semibold text-bg-primary disabled:opacity-40"
              >
                Cash remainder
              </button>
              <button
                type="button"
                disabled={checkoutLoading}
                onClick={onRetryUnpaidOnline}
                className="rounded-lg border border-white/10 px-2 py-2 text-xs font-semibold disabled:opacity-40"
              >
                UPI remainder
              </button>
            </div>
            {splitItems.length > 1 ? (
              <div className="mt-3 space-y-2 border-t border-white/10 pt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Split bill
                </p>
                {splitItems.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={splitSelectedIds.includes(item.id)}
                      onChange={() => onToggleSplitItem?.(item.id)}
                    />
                    <span>
                      {item.quantity}× {item.name}
                    </span>
                  </label>
                ))}
                <button
                  type="button"
                  disabled={splitLoading || splitSelectedIds.length === 0}
                  onClick={onSplit}
                  className="w-full rounded-lg border border-white/10 px-2 py-2 text-xs font-semibold disabled:opacity-40"
                >
                  {splitLoading ? 'Splitting…' : 'Split selected items'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="shrink-0 space-y-3 border-t border-white/5 bg-bg-secondary p-4">
        {discountPaise > 0 ? (
          <div className="flex items-center justify-between text-sm text-text-muted">
            <span>Loyalty discount</span>
            <span className="font-mono">−{formatMoney(discountPaise)}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between text-lg">
          <span className="text-text-secondary">
            {unpaidBalance ? 'Remaining' : 'Subtotal'}
          </span>
          <span className="font-mono font-semibold text-brand-primary">
            {unpaidBalance
              ? `₹${unpaidBalance.remaining.toFixed(2)}`
              : formatMoney(duePaise)}
          </span>
        </div>

        <button
          type="button"
          disabled={!canCharge && !unpaidOrder}
          onClick={() => setTenderOpen(true)}
          className="h-14 w-full rounded-2xl bg-brand-primary text-lg font-bold text-bg-primary shadow-lg shadow-brand-primary/20 transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
        >
          {checkoutLoading
            ? 'Processing…'
            : unpaidOrder
              ? 'Pay remainder'
              : partialCashAmount
                ? 'Pay amount'
                : 'Pay full'}
        </button>

        {tenderOpen && (canCharge || unpaidOrder) ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={checkoutLoading || cashDisabled}
              onClick={() => {
                setTenderOpen(false);
                onCash();
              }}
              className="h-12 rounded-xl bg-brand-primary/20 font-medium text-brand-primary disabled:opacity-40"
            >
              {cashDisabled ? 'Cash (open shift)' : 'Cash (Enter)'}
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
