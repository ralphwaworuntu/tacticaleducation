import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { PracticeReview } from '@/types/exam';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useMembershipStatus } from '@/hooks/useMembershipStatus';
import { MembershipRequired } from '@/components/dashboard/MembershipRequired';
import { isAxiosError } from 'axios';
import { PageHeader } from '@/components/common/PageHeader';
import { ExamReviewQuestionList, ExamReviewSummaryBar } from '@/components/dashboard/ExamReviewQuestions';

function practiceSetsPath(
  categorySlug?: string,
  subCategoryId?: string,
  subSubId?: string,
  base = '/app/latihan-soal',
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

export function PracticeReviewPage() {
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();
  const membership = useMembershipStatus();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['practice-review', resultId],
    queryFn: () => apiGet<PracticeReview>(`/exams/practice/results/${resultId}/review`),
    enabled: Boolean(resultId),
  });

  const completedAtLabel = data?.completedAt ? new Date(data.completedAt).toLocaleString('id-ID') : '-';
  const backToList = practiceSetsPath(
    data?.set.subSubCategory?.subCategory.category.slug,
    data?.set.subSubCategory?.subCategory.id,
    data?.set.subSubCategory?.id,
  );

  if (!resultId) {
    return <Navigate to="/app/latihan-soal" replace />;
  }

  if (membership.isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (membership.data?.allowPractice === false) {
    return (
      <section className="rounded-3xl border border-brand-200 bg-brand-50 p-6 text-sm text-brand-800">
        Paket membership kamu tidak mencakup akses latihan soal. Hubungi admin untuk upgrade paket.
      </section>
    );
  }

  if (isLoading || !data) {
    return <Skeleton className="h-[420px]" />;
  }

  if (isError) {
    if (isAxiosError(error) && error.response?.status === 403) {
      return <MembershipRequired status={membership.data} />;
    }
    return (
      <section className="space-y-4">
        <p className="text-sm text-red-600">Gagal memuat pembahasan latihan. Coba kembali.</p>
        <Button variant="outline" onClick={() => navigate('/app/latihan-soal')}>
          Kembali ke Latihan Soal
        </Button>
      </section>
    );
  }

  return (
    <section className="page-shell space-y-6">
      <PageHeader
        eyebrow="Pembahasan Latihan"
        title={data.set.title}
        description={`Diselesaikan ${completedAtLabel}`}
        action={
          <>
            <Button variant="outline" onClick={() => navigate(backToList)}>
              Kembali
            </Button>
            <Button onClick={() => navigate('/app/latihan-soal')}>Pilih Latihan Lain</Button>
          </>
        }
      />

      <ExamReviewSummaryBar
        score={data.score}
        correctCount={data.questions.filter((q) => q.isCorrect).length}
        totalQuestions={data.questions.length}
        meta={data.set.level ? `Level ${data.set.level}` : 'Latihan soal'}
        statusLabel={data.score >= 70 ? 'Baik' : 'Perlu Latihan Lagi'}
        passed={data.score >= 70}
      />

      <ExamReviewQuestionList questions={data.questions} showAnswerSummary />
    </section>
  );
}
