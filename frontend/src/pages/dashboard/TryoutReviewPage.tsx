import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { TryoutPackageReview, TryoutReview } from '@/types/exam';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useMembershipStatus } from '@/hooks/useMembershipStatus';
import { MembershipRequired } from '@/components/dashboard/MembershipRequired';
import { CERMAT_MODE_LABELS } from '@/types/cermat';
import { isAxiosError } from 'axios';
import { PageHeader } from '@/components/common/PageHeader';
import { ExamReviewQuestionList, ExamReviewSummaryBar } from '@/components/dashboard/ExamReviewQuestions';

function tryoutListPath(categoryId?: string, subCategoryId?: string) {
  if (categoryId && subCategoryId) {
    return `/app/latihan/tryout/kategori/${categoryId}/sub/${subCategoryId}`;
  }
  if (categoryId) {
    return `/app/latihan/tryout/kategori/${categoryId}`;
  }
  return '/app/latihan/tryout';
}

export function TryoutReviewPage() {
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();
  const membership = useMembershipStatus();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['tryout-review', resultId],
    queryFn: () => apiGet<TryoutReview>(`/exams/tryouts/results/${resultId}/review`),
    enabled: Boolean(resultId),
  });
  const packageReviewQuery = useQuery({
    queryKey: ['tryout-package-review', resultId],
    queryFn: () => apiGet<TryoutPackageReview>(`/exams/tryouts/results/${resultId}/review-package`),
    enabled: Boolean(resultId && data?.tryout.isPsikoSession),
  });

  const completedAtLabel = data?.completedAt ? new Date(data.completedAt).toLocaleString('id-ID') : '-';
  const backToList = tryoutListPath(data?.tryout.subCategory?.category.id, data?.tryout.subCategory?.id);

  if (!resultId) {
    return <Navigate to="/app/latihan/tryout" replace />;
  }

  if (membership.isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (membership.data?.allowTryout === false) {
    return (
      <section className="rounded-3xl border border-brand-200 bg-brand-50 p-6 text-sm text-brand-800">
        Paket membership kamu tidak mencakup akses latihan tryout. Hubungi admin untuk upgrade paket.
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
        <p className="text-sm text-red-600">Gagal memuat pembahasan. Coba kembali.</p>
        <Button variant="outline" onClick={() => navigate('/app/latihan/tryout')}>
          Kembali ke Tryout
        </Button>
      </section>
    );
  }

  if (data.tryout.isPsikoSession && packageReviewQuery.isLoading) {
    return <Skeleton className="h-[420px]" />;
  }

  if (data.tryout.isPsikoSession && packageReviewQuery.data) {
    const packageData = packageReviewQuery.data;
    const packageBack = tryoutListPath(packageData.package.categoryId, packageData.package.subCategoryId);
    return (
      <section className="page-shell space-y-6">
        <PageHeader
          eyebrow="Pembahasan Paket Soal PSIKO"
          title={packageData.package.subCategoryName}
          description={`${packageData.package.totalSessions} sesi - Lanjutan kecermatan: ${CERMAT_MODE_LABELS[packageData.package.cermatMode]}`}
          action={
            <>
              <Button variant="outline" onClick={() => navigate(packageBack)}>
                Kembali
              </Button>
              <Button onClick={() => navigate('/app/latihan/tryout')}>Pilih Tryout Lain</Button>
            </>
          }
        />

        <ExamReviewSummaryBar
          score={packageData.overall.averageScore}
          correctCount={packageData.overall.totalCorrect}
          totalQuestions={packageData.overall.totalQuestions}
          meta={`${packageData.package.totalSessions} sesi · ${packageData.package.categoryName}`}
          statusLabel={packageData.overall.averageScore >= 70 ? 'Lulus' : 'Perlu Perbaikan'}
          passed={packageData.overall.averageScore >= 70}
        />

        <div className="space-y-8">
          {packageData.sections.map((section) => {
            const completedAt = section.completedAt ? new Date(section.completedAt).toLocaleString('id-ID') : '-';
            return (
              <div key={section.resultId} className="space-y-4">
                <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                        Section {section.sessionOrder}
                      </p>
                      <h2 className="text-xl font-semibold text-slate-900">{section.tryout.name}</h2>
                      <p className="text-sm text-slate-600">Selesai {completedAt}</p>
                    </div>
                    <div className="rounded-xl bg-white px-4 py-2 text-center shadow-sm">
                      <p className="text-xs uppercase text-slate-500">Skor Sesi</p>
                      <p className="text-2xl font-bold text-brand-600">{Math.round(section.score)}</p>
                    </div>
                  </div>
                </div>
                <ExamReviewQuestionList questions={section.questions} />
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="page-shell space-y-6">
      <PageHeader
        eyebrow="Pembahasan Tryout"
        title={data.tryout.name}
        description={`Diselesaikan ${completedAtLabel}`}
        action={
          <>
            <Button variant="outline" onClick={() => navigate(backToList)}>
              Kembali
            </Button>
            <Button onClick={() => navigate('/app/latihan/tryout')}>Pilih Tryout Lain</Button>
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
