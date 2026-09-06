import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { PracticeReview } from '@/types/exam';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useExamControlStatus } from '@/hooks/useExamControl';
import { PageHeader } from '@/components/common/PageHeader';
import { ExamReviewQuestionList, ExamReviewSummaryBar } from '@/components/dashboard/ExamReviewQuestions';

function practiceSetsPath(
  categorySlug?: string,
  subCategoryId?: string,
  subSubId?: string,
  base = '/app/ujian/soal',
) {
  if (categorySlug && subCategoryId && subSubId) {
    return `${base}/kategori/${categorySlug}/sub/${subCategoryId}/subsub/${subSubId}`;
  }
  if (categorySlug && subCategoryId) {
    return `${base}/kategori/${categorySlug}/sub/${subCategoryId}`;
  }
  if (categorySlug) {
    return `${base}/kategori/${categorySlug}`;
  }
  return base;
}

export function ExamPracticeReviewPage() {
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();
  const examStatus = useExamControlStatus();
  const examEnabled = Boolean(examStatus.data?.enabled && examStatus.data?.allowed);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['exam-practice-review', resultId],
    queryFn: () => apiGet<PracticeReview>(`/ujian/practice/results/${resultId}/review`),
    enabled: Boolean(resultId && examEnabled),
  });

  const completedAtLabel = data?.completedAt ? new Date(data.completedAt).toLocaleString('id-ID') : '-';
  const backToList = practiceSetsPath(
    data?.set.subSubCategory?.subCategory.category.slug,
    data?.set.subSubCategory?.subCategory.id,
    data?.set.subSubCategory?.id,
  );

  if (!resultId) {
    return <Navigate to="/app/ujian/soal" replace />;
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
        <p className="text-sm text-red-600">Gagal memuat pembahasan ujian. Coba kembali.</p>
        <Button variant="outline" onClick={() => navigate('/app/ujian/soal')}>
          Kembali ke Ujian Soal
        </Button>
      </section>
    );
  }

  return (
    <section className="page-shell space-y-6">
      <PageHeader
        eyebrow="Pembahasan Ujian"
        title={data.set.title}
        description={`Diselesaikan ${completedAtLabel}`}
        action={
          <>
            <Button variant="outline" onClick={() => navigate(backToList)}>
              Kembali
            </Button>
            <Button onClick={() => navigate('/app/ujian/soal')}>Pilih Ujian Lain</Button>
          </>
        }
      />

      <ExamReviewSummaryBar
        score={data.score}
        correctCount={data.questions.filter((q) => q.isCorrect).length}
        totalQuestions={data.questions.length}
        meta={data.set.level ? `Level ${data.set.level}` : 'Ujian soal'}
        statusLabel={data.score >= 70 ? 'Baik' : 'Perlu Ujian Lagi'}
        passed={data.score >= 70}
      />

      <ExamReviewQuestionList questions={data.questions} showAnswerSummary />
    </section>
  );
}
