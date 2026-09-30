import { useId } from 'react';
import { smoothPath } from './chart-utils';

export function Sparkline({
  values,
  color,
  width = 96,
  height = 36,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const gradientId = `spark-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  if (values.length < 2) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pad = 3;
  const points = values.map((v, i) => ({
    x: (i / (values.length - 1)) * width,
    y: pad + (1 - (v - min) / span) * (height - pad * 2),
  }));
  const line = smoothPath(points);
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.28 }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} className="animate-fade-in" />
      <path
        d={line}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        style={{
          stroke: color,
          ['--ui-draw-length' as string]: 1,
          animation: 'ui-draw 900ms var(--ease-out) both',
        }}
      />
    </svg>
  );
}
