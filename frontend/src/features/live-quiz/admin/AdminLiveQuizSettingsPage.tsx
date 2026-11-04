import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RotateCcw, Save } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiErrorMessage } from '@/lib/api';
import { liveQuizApi } from '../api';
import type { QuizSettings } from '../types';
import { SettingsForm } from './SettingsForm';

export function AdminLiveQuizSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['live-quiz', 'settings'], queryFn: liveQuizApi.getSettings });
  const [settings, setSettings] = useState<QuizSettings | null>(null);

  useEffect(() => {
    if (data) setSettings(data.settings);
  }, [data]);

  const save = useMutation({
    mutationFn: (value: QuizSettings) => liveQuizApi.saveSettings(value),
    onSuccess: (result) => {
      toast.success('Pengaturan default disimpan.');
      setSettings(result.settings);
      void queryClient.invalidateQueries({ queryKey: ['live-quiz', 'settings'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Gagal menyimpan pengaturan.')),
  });

  return (
    <div className="page-shell">
      <PageHeader
        variant="panel"
        eyebrow="Live Quiz"
        title="Pengaturan default"
        description="Nilai awal untuk setiap kuis dan sesi baru. Kuis atau sesi tertentu masih dapat mengubahnya."
        action={
          <>
            <Button variant="outline" onClick={() => data && setSettings(data.defaults)} disabled={!data}>
              <RotateCcw className="h-4 w-4" />
              Kembalikan bawaan
            </Button>
            <Button onClick={() => settings && save.mutate(settings)} isLoading={save.isPending} disabled={!settings}>
              <Save className="h-4 w-4" />
              Simpan
            </Button>
          </>
        }
      />
      <Card>
        <CardContent className="py-6">
          {isLoading || !settings ? <Skeleton className="h-64" /> : <SettingsForm value={settings} onChange={setSettings} />}
        </CardContent>
      </Card>
    </div>
  );
}
