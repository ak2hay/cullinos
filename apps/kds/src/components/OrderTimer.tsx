import { useEffect, useState } from 'react';

function formatAge(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getAgeSeconds(createdAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
}

interface OrderTimerProps {
  createdAt: string;
  urgentAfterMinutes?: number;
}

export function OrderTimer({ createdAt, urgentAfterMinutes = 15 }: OrderTimerProps) {
  const [age, setAge] = useState(() => getAgeSeconds(createdAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setAge(getAgeSeconds(createdAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const isUrgent = age >= urgentAfterMinutes * 60;

  return (
    <span
      className={`font-mono text-sm font-medium tabular-nums ${isUrgent ? 'text-status-error' : 'text-text-secondary'}`}
    >
      {formatAge(age)}
    </span>
  );
}
