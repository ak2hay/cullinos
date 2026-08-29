import { jsx as _jsx } from "react/jsx-runtime";
import { CULLINOS_BRAND } from '@/lib/api';
export function PoweredByFooter() {
    return (_jsx("footer", { className: "border-t border-white/10 py-4 text-center", children: _jsx("p", { className: "text-xs text-text-muted", children: CULLINOS_BRAND.poweredBy }) }));
}
