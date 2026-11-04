import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Radio, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api';
import { liveQuizApi } from '../api';
import type { QuizListItem, QuizSettings } from '../types';
import { SettingsForm } from './SettingsForm';

type Props = {
  quiz: QuizListItem | null;
  onClose: () => void;
};

export function StartSessionDialog({ quiz, onClose }: Props) {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<QuizSettings | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const defaults = useQuery({ queryKey: ['live-quiz', 'settings'], queryFn: liveQuizApi.getSettings, enabled: Boolean(quiz) });
  const detail = useQuery({
    queryKey: ['live-quiz', 'quiz', quiz?.id],
    queryFn: () => liveQuizApi.getQuiz(quiz!.id),
    enabled: Boolean(quiz),
  });

  useEffect(() => {
    if (defaults.data && detail.data) {
      setSettings({ ...defaults.data.settings, ...(detail.data.settings ?? {}) });
    }
  }, [defaults.data, detail.data]);

  useEffect(() => {
    if (!quiz) setSettings(null);
  }, [quiz]);

  if (!quiz) return null;

  const start = async () => {
    if (!settings) return;
    setSubmitting(true);
    try {
      const session = await liveQuizApi.createSession(quiz.id, settings);
      toast.success(`Sesi dibuat. PIN: ${session.pin}`);
      navigate(`/admin/live-quiz/host/${session.id}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Gagal membuat sesi.'));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 px-4 py-8">
      <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow-label">Mulai sesi live</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">{quiz.title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {quiz.questionCount} soal. Atur pengaturan sesi ini; PIN dan kode QR dibuat setelah sesi dibuat.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6">
          {settings ? (
            <SettingsForm value={settings} onChange={setSettings} />
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">Memuat pengaturan…</p>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button onClick={start} isLoading={submitting} disabled={!settings}>
            <Radio className="h-4 w-4" />
            Buat sesi & buka layar tutor
          </Button>
        </div>
      </div>
    </div>
  );
}
