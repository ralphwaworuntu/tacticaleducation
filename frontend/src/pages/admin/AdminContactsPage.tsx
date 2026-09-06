import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  status: string;
  createdAt: string;
};

type ContactMessageResponse = {
  items: ContactMessage[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export function AdminContactsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery<ContactMessageResponse>({
    queryKey: ['admin-contact-messages', page],
    queryFn: () => apiGet<ContactMessageResponse>('/admin/contacts/messages', { params: { page } }),
    placeholderData: keepPreviousData,
  });

  if (isLoading || !data) {
    return <Skeleton className="h-96" />;
  }

  return (
    <section className="page-shell">
      <PageHeader variant="panel"
        eyebrow="Admin"
        title="Pesan Hubungi Kami"
        description="Pantau semua pesan yang dikirim via halaman Hubungi Kami."
      />

      <Card>
        <CardContent className="p-0">
          <div className="admin-table-wrap border-0 rounded-none">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Kontak</th>
                  <th>Pesan</th>
                  <th>Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((message) => (
                  <tr key={message.id}>
                    <td>
                      <p className="font-semibold text-slate-900">{message.name}</p>
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">{message.status}</p>
                    </td>
                    <td>
                      <p>
                        <a href={`mailto:${message.email}`} className="text-brand-600">
                          {message.email}
                        </a>
                      </p>
                      {message.phone && <p className="text-xs text-slate-500">WA: {message.phone}</p>}
                    </td>
                    <td>
                      <p className="line-clamp-3 whitespace-pre-line">{message.message}</p>
                    </td>
                    <td className="whitespace-nowrap text-xs text-slate-500">
                      {new Date(message.createdAt).toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-sm text-slate-500">
                      Belum ada pesan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-xs text-slate-500">
            <span>
              Halaman {data.page} dari {Math.max(data.pages, 1)} • Total {data.total} pesan
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}>
                Sebelumnya
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={page >= data.pages}
                onClick={() => setPage((prev) => Math.min(prev + 1, data.pages))}
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
