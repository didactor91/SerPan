import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
function getCertStatusColor(daysUntilExpiry) {
    if (daysUntilExpiry > 30)
        return 'default';
    if (daysUntilExpiry >= 7)
        return 'secondary';
    return 'destructive';
}
function formatDate(dateStr) {
    try {
        return new Date(dateStr).toLocaleDateString();
    }
    catch {
        return dateStr;
    }
}
function CertTable({ certificates, searchFilter }) {
    const filteredCerts = searchFilter
        ? certificates.filter((cert) => cert.domain.toLowerCase().includes(searchFilter.toLowerCase()))
        : certificates;
    return (_jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b bg-muted/50", children: [_jsx("th", { className: "text-left p-3 font-medium", children: "Domain" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Issuer" }), _jsx("th", { className: "text-center p-3 font-medium", children: "TLS Status" }), _jsx("th", { className: "text-right p-3 font-medium", children: "Expiry" }), _jsx("th", { className: "text-right p-3 font-medium", children: "Days Left" })] }) }), _jsx("tbody", { children: filteredCerts.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "p-6 text-center text-muted-foreground", children: searchFilter ? 'No domains match your filter' : 'No domains configured' }) })) : (filteredCerts.map((cert, index) => (_jsxs("tr", { className: "border-b", children: [_jsx("td", { className: "p-3 font-medium", children: cert.domain }), _jsx("td", { className: "p-3 text-muted-foreground", children: cert.issuer }), _jsx("td", { className: "p-3 text-center", children: _jsx(Badge, { variant: getCertStatusColor(cert.daysUntilExpiry), children: cert.daysUntilExpiry > 30
                                            ? 'Valid'
                                            : cert.daysUntilExpiry >= 7
                                                ? 'Expiring Soon'
                                                : 'Expired' }) }), _jsx("td", { className: "p-3 text-right text-muted-foreground", children: formatDate(cert.notAfter) }), _jsx("td", { className: "p-3 text-right", children: _jsx("span", { className: cert.daysUntilExpiry < 7
                                            ? 'text-destructive font-medium'
                                            : cert.daysUntilExpiry < 30
                                                ? 'text-yellow-500'
                                                : 'text-muted-foreground', children: cert.daysUntilExpiry }) })] }, index)))) })] }) }) }));
}
export function DomainsPage() {
    const [searchFilter, setSearchFilter] = useState('');
    const { data, isLoading, error } = useQuery({
        queryKey: ['proxy-certs'],
        queryFn: () => apiClient.get('/proxy/certs'),
        refetchInterval: 60000,
    });
    const certificates = data?.data.certificates ?? [];
    if (isLoading) {
        return (_jsxs("div", { className: "p-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-6", children: "Domains" }), _jsx("p", { className: "text-muted-foreground", children: "Loading..." })] }));
    }
    if (error) {
        return (_jsxs("div", { className: "p-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-6", children: "Domains" }), _jsx("p", { className: "text-destructive", children: "Failed to load certificates" })] }));
    }
    return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Domains" }), _jsx("input", { type: "text", value: searchFilter, onChange: (e) => setSearchFilter(e.target.value), placeholder: "Filter domains...", className: "h-10 px-3 rounded-md border border-input bg-background text-sm w-64" })] }), _jsx(CertTable, { certificates: certificates, searchFilter: searchFilter })] }));
}
