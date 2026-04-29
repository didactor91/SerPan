import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const Label = React.forwardRef(({ className, required, children, ...props }, ref) => (_jsxs("label", { ref: ref, className: twMerge(clsx('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)), ...props, children: [children, required && _jsx("span", { className: "text-destructive ml-1", children: "*" })] })));
Label.displayName = 'Label';
export { Label };
