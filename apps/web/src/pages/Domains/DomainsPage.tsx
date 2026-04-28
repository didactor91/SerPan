import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface Certificate {
  domain: string;
  issuer: string;
  notAfter: string; // API returns notAfter, not expiryDate
  notBefore?: string;
  daysUntilExpiry: number;
}

interface CertsResponse {
  data: {
    certificates: Certificate[];
  };
}

function getCertStatusColor(daysUntilExpiry: number): 'default' | 'secondary' | 'destructive' {
  if (daysUntilExpiry > 30) return 'default'; // green
  if (daysUntilExpiry >= 7) return 'secondary'; // yellow
  return 'destructive'; // red
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export function DomainsPage() {
  const [searchFilter, setSearchFilter] = useState('');

  const { data, isLoading, error } = useQuery<CertsResponse>({
    queryKey: ['proxy-certs'],
    queryFn: () => apiClient.get('/proxy/certs'),
    refetchInterval: 60000, // Refresh every minute
  });

  const certificates = data?.data?.certificates ?? [];

  const filteredCerts = searchFilter
    ? certificates.filter((cert) => cert.domain.toLowerCase().includes(searchFilter.toLowerCase()))
    : certificates;

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Domains</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Domains</h1>
        <p className="text-destructive">Failed to load certificates</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Domains</h1>
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Filter domains..."
          className="h-10 px-3 rounded-md border border-input bg-background text-sm w-64"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Domain</th>
                <th className="text-left p-3 font-medium">Issuer</th>
                <th className="text-center p-3 font-medium">TLS Status</th>
                <th className="text-right p-3 font-medium">Expiry</th>
                <th className="text-right p-3 font-medium">Days Left</th>
              </tr>
            </thead>
            <tbody>
              {filteredCerts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    {searchFilter ? 'No domains match your filter' : 'No domains configured'}
                  </td>
                </tr>
              ) : (
                filteredCerts.map((cert, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-3 font-medium">{cert.domain}</td>
                    <td className="p-3 text-muted-foreground">{cert.issuer}</td>
                    <td className="p-3 text-center">
                      <Badge variant={getCertStatusColor(cert.daysUntilExpiry)}>
                        {cert.daysUntilExpiry > 30
                          ? 'Valid'
                          : cert.daysUntilExpiry >= 7
                            ? 'Expiring Soon'
                            : 'Expired'}
                      </Badge>
                    </td>
                    <td className="p-3 text-right text-muted-foreground">
                      {formatDate(cert.notAfter)}
                    </td>
                    <td className="p-3 text-right">
                      <span
                        className={
                          cert.daysUntilExpiry < 7
                            ? 'text-destructive font-medium'
                            : cert.daysUntilExpiry < 30
                              ? 'text-yellow-500'
                              : 'text-muted-foreground'
                        }
                      >
                        {cert.daysUntilExpiry}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
