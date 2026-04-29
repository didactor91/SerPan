import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Card, CardContent } from '@/components/ui/Card';
export function MetricCard({ label, value, unit, trend, icon }) {
    return (_jsx(Card, { children: _jsxs(CardContent, { className: "p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-muted-foreground", children: label }), _jsxs("p", { className: "text-2xl font-bold mt-1", children: [value, unit && (_jsx("span", { className: "text-sm font-normal text-muted-foreground ml-1", children: unit }))] })] }), icon && _jsx("div", { className: "text-muted-foreground", children: icon })] }), trend && (_jsx("div", { className: "mt-2", children: _jsx("span", { className: `text-xs ${trend === 'up'
                            ? 'text-red-500'
                            : trend === 'down'
                                ? 'text-green-500'
                                : 'text-muted-foreground'}`, children: trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→' }) }))] }) }));
}
