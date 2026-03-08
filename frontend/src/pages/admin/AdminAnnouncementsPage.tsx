import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, apiGet } from '@/lib/api';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import type { PackageOption } from '@/types/landing';
import { LandingSectionManager, type LandingItem, type LandingResourceConfig } from '@/components/admin/LandingSectionManager';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

type LandingAnnouncement = {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  imageUrl?: string | null;
  targetAll?: boolean;
  targetPackageIds?: string[];
};

type LandingOverview = {
  announcements: LandingAnnouncement[];
};

const announcementSection: LandingResourceConfig = {
  key: 'announcements',
  title: 'Pengumuman',
  endpoint: 'announcements',
  primaryField: 'title',
  fields: [
    { name: 'title', label: 'Judul' },
    { name: 'body', label: 'Konten', type: 'textarea' },
    { name: 'targetAll', label: 'Kirim ke semua member', type: 'boolean', defaultValue: 1 },
    { name: 'targetPackageIds', label: 'Target paket membership', type: 'packages' },
  ],
  uploadField: {
    name: 'image',
    label: 'Gambar Pengumuman (Opsional)',
    previewKey: 'imageUrl',
    helper: 'Gunakan JPG/PNG/WEBP maksimal 4MB.',
    accept: 'image/*',
  },
};

export function AdminAnnouncementsPage() {
  const { accessToken } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['admin-landing'], queryFn: () => apiGet<LandingOverview>('/admin/landing') });
  const { data: packages } = useQuery({ queryKey: ['admin-packages'], queryFn: () => apiGet<PackageOption[]>('/admin/packages') });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await api.get('/admin/announcements/export', {
        responseType: 'blob',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'pengumuman.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Gagal mengunduh CSV pengumuman');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading || !data) {
    return <Skeleton className="h-80" />;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Pengumuman</h1>
          <p className="mt-2 text-sm text-slate-500">Kelola pengumuman yang tampil di area member.</p>
        </div>
        <Button type="button" variant="outline" onClick={handleExport} disabled={isExporting}>
          {isExporting ? 'Mengunduh...' : 'Download CSV'}
        </Button>
      </div>
      <LandingSectionManager
        config={announcementSection}
        items={data.announcements as LandingItem[]}
        packageOptions={packages ?? []}
      />
    </section>
  );
}
