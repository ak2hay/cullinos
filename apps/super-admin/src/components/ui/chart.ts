import type { CSSProperties } from 'react';

export const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#0ea5e9', '#ec4899', '#8b5cf6'];

export const chartTooltipStyle: CSSProperties = {
  background: 'var(--color-bg-secondary)',
  color: 'var(--color-text-primary)',
  border: '1px solid var(--color-line)',
  borderRadius: 10,
  boxShadow: 'var(--shadow-md)',
  fontSize: 12,
};
