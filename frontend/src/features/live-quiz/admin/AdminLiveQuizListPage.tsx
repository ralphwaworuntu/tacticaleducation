import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Pencil, Play, Plus, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiErrorMessage } from '@/lib/api';
import { liveQuizApi } from '../api';
import { formatDateTime } from '../format';
import type { QuizListItem } from '../types';
import { StartSessionDialog } from './StartSessionDialog';

export function AdminLiveQuizListPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<QuizListItem | null>(null);
  const [toStart, setToStart] = useState<QuizListItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['live-quiz', 'quizzes', search],
    queryFn: () => liveQuizApi.listQuizzes(search.trim() || undefined),
  });

  const duplicate = useMutation({
    mutationFn: (id: string) => liveQuizApi.duplicateQuiz(id),
    onSuccess: () => {
      toast.success('Kuis diduplikasi.');
      void queryClient.invalidateQueries({ queryKey: ['live-quiz'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Gagal menduplikasi kuis.')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => liveQuizApi.deleteQuiz(id),
    onSuccess: () => {
      toast.success('Kuis dihapus.');
      setToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ['live-quiz'] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Gagal menghapus kuis.'));
      setToDelete(null);
    },
  });

  return (
    <div className="page-shell">
      <PageHeader
        variant="panel"
        eyebrow="Live Quiz"
        title="Kuis saya"
        description="Buat kuis dari awal atau impor dari bank soal Tryout/Latihan, lalu mulai sesi live."
        action={
          <Button asChild>
            <Link to="/admin/live-quiz/kuis/baru">
              <Plus className="h-4 w-4" />
              Buat kuis
            </Link>
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-11"
          placeholder="Cari judul kuis…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : data?.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((quiz) => (
            <Card key={quiz.id}>
              <CardContent className="flex h-full flex-col gap-4 py-5">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold text-slate-900">{quiz.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {quiz.questionCount} soal · {quiz.sessionCount}x dimainkan
                    {quiz.subject ? ` · ${quiz.subject}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Diubah {formatDateTime(quiz.updatedAt)}</p>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => setToStart(quiz)} disabled={quiz.questionCount === 0}>
                    <Play className="h-3.5 w-3.5" />
                    Mulai sesi
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/admin/live-quiz/kuis/${quiz.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    title="Duplikat"
                    onClick={() => duplicate.mutate(quiz.id)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-red-600 hover:bg-red-50 hover:text-red-700"
                    title="Hapus"
                    onClick={() => setToDelete(quiz)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-500">
            Belum ada kuis. Klik <strong>Buat kuis</strong> untuk memulai.
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Hapus kuis?"
        description={`Kuis "${toDelete?.title ?? ''}" akan dihapus permanen. Kuis yang sudah pernah dimainkan tidak dapat dihapus.`}
        confirmText="Hapus"
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
      <StartSessionDialog quiz={toStart} onClose={() => setToStart(null)} />
    </div>
  );
}
