import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { TryoutReview } from '@/types/exam';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useExamControlStatus } from '@/hooks/useExamControl';
import { PageHeader } from '@/components/common/PageHeader';
import { ExamReviewQuestionList, ExamReviewSummaryBar } from '@/components/dashboard/ExamReviewQuestions';

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
  const backToList =
    data?.tryout.subCategory?.category.id && data.tryout.subCategory.id
      ? `/app/ujian/tryout/kategori/${data.tryout.subCategory.category.id}/sub/${data.tryout.subCategory.id}`
      : '/app/ujian/tryout';

  if (!resultId) {
    return <Navigate to="/app/ujian/tryout" replace />;
  }

  if (examStatus.isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (!examEnabled) {
    return (
      <section className="rounded-3xl border border-brand-200 bg-brand-50 p-6 text-sm text-brand-800">
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
    <section className="page-shell space-y-6">
      <PageHeader
        eyebrow="Pembahasan Tryout Ujian"
        title={data.tryout.name}
        description={`Diselesaikan ${completedAtLabel}`}
        action={
          <>
            <Button variant="outline" onClick={() => navigate(backToList)}>
              Kembali
            </Button>
            <Button onClick={() => navigate('/app/ujian/tryout')}>Pilih Tryout Lain</Button>
          </>
        }
      />

      <ExamReviewSummaryBar
        score={data.score}
        correctCount={data.questions.filter((q) => q.isCorrect).length}
        totalQuestions={data.questions.length}
        meta={`Durasi ${data.tryout.durationMinutes} menit`}
        statusLabel={data.score >= 70 ? 'Lulus' : 'Perlu Perbaikan'}
        passed={data.score >= 70}
      />

      <ExamReviewQuestionList questions={data.questions} />
    </section>
  );
}
