import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
function formatAge(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
        const hrs = Math.floor(mins / 60);
        const remMins = mins % 60;
        return `${hrs}h ${remMins}m`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
function getAgeSeconds(createdAt) {
    return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
}
export function OrderTimer({ createdAt, urgentAfterMinutes = 15 }) {
    const [age, setAge] = useState(() => getAgeSeconds(createdAt));
    useEffect(() => {
        const interval = setInterval(() => {
            setAge(getAgeSeconds(createdAt));
        }, 1000);
        return () => clearInterval(interval);
    }, [createdAt]);
    const isUrgent = age >= urgentAfterMinutes * 60;
    return (_jsx("span", { className: `font-mono text-sm font-medium tabular-nums ${isUrgent ? 'text-status-error' : 'text-text-secondary'}`, children: formatAge(age) }));
}
