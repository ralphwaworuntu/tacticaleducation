import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { getAssetUrl } from '@/lib/media';
import type { TryoutReview } from '@/types/exam';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useExamControlStatus } from '@/hooks/useExamControl';

export function ExamTryoutReviewPage() {
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();
  const examStatus = useExamControlStatus();
  const examEnabled = Boolean(examStatus.data?.enabled && examStatus.data?.allowed);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['exam-tryout-review', resultId],
    queryFn: () => apiGet<TryoutReview>(`/ujian/tryouts/results/${resultId}/review`),
    enabled: Boolean(resultId && examEnabled),
  });

  const completedAtLabel = data?.completedAt ? new Date(data.completedAt).toLocaleString('id-ID') : '-';

  if (!resultId) {
    return <Navigate to="/app/ujian/tryout" replace />;
  }

  if (examStatus.isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (!examEnabled) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Akses ujian tidak tersedia untuk akun Anda. Hubungi admin jika seharusnya mendapatkan akses.
      </section>
    );
  }

  if (isLoading || !data) {
    return <Skeleton className="h-[420px]" />;
  }

  if (isError) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-red-600">Gagal memuat pembahasan. Coba kembali.</p>
        <Button variant="outline" onClick={() => navigate('/app/ujian/tryout')}>
          Kembali ke Tryout
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Pembahasan Tryout Ujian</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{data.tryout.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Diselesaikan {completedAtLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Kembali
          </Button>
          <Button onClick={() => navigate('/app/ujian/tryout')}>
            Pilih Tryout Lain
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Skor" />
          <CardContent>
            <p className="text-4xl font-bold text-brand-600">{Math.round(data.score)}%</p>
            <p className="text-sm text-slate-500">{data.questions.filter((q) => q.isCorrect).length}/{data.questions.length} soal benar</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Total Soal" />
          <CardContent>
            <p className="text-4xl font-bold text-slate-900">{data.questions.length}</p>
            <p className="text-sm text-slate-500">Durasi {data.tryout.durationMinutes} menit</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Status" />
          <CardContent>
            <Badge
              variant={data.score >= 70 ? 'success' : 'outline'}
              className={data.score >= 70 ? '' : 'border-rose-200 bg-rose-50 text-rose-600'}
            >
              {data.score >= 70 ? 'Lulus' : 'Perlu Perbaikan'}
            </Badge>
            <p className="mt-2 text-sm text-slate-500">
              Analisa setiap soal di bawah untuk memahami konsep penting.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {data.questions.map((question) => (
          <article key={question.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Soal #{question.order}</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">{question.prompt}</h2>
                {question.imageUrl && (
                  <img src={getAssetUrl(question.imageUrl)} alt="Soal" className="mt-3 w-full rounded-2xl border border-slate-100 object-cover" loading="lazy" />
                )}
              </div>
              <Badge
                variant="outline"
                className={question.isCorrect ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-rose-200 bg-rose-50 text-rose-600'}
              >
                {question.isCorrect ? 'Jawaban Kamu Benar' : 'Jawaban Kamu Salah'}
              </Badge>
            </div>
            <div className="mt-4 space-y-3">
              {question.options.map((option) => {
                const isUserChoice = question.userOptionId === option.id;
                const isCorrect = Boolean(option.isCorrect);
                const className = `rounded-2xl border p-4 text-sm transition ${
                  isCorrect
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : isUserChoice
                      ? 'border-rose-300 bg-rose-50 text-rose-700'
                      : 'border-slate-200 bg-white text-slate-700'
                }`;
                return (
                  <div key={option.id} className={className}>
                    <p className="font-semibold">{option.label}</p>
                    {option.imageUrl && (
                      <img src={getAssetUrl(option.imageUrl)} alt="Opsi" className="mt-2 h-20 w-20 rounded-xl object-cover" loading="lazy" />
                    )}
                    <p className="text-xs text-slate-500">
                      {isCorrect ? 'Jawaban benar' : isUserChoice ? 'Jawaban kamu' : 'Pilihan lain'}
                    </p>
                  </div>
                );
              })}
            </div>
            {question.explanation && (
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">Pembahasan</p>
                <p className="mt-2 whitespace-pre-line">{question.explanation}</p>
                {question.explanationImageUrl && (
                  <img
                    src={getAssetUrl(question.explanationImageUrl)}
                    alt="Ilustrasi pembahasan"
                    className="mt-3 w-full rounded-2xl border border-slate-100 object-cover"
                    loading="lazy"
                  />
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
