import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import { getAssetUrl } from '@/lib/media';
import type { PracticeCategory, PracticeSet } from '@/types/exam';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useExamControlStatus } from '@/hooks/useExamControl';
import { isDocumentFullscreen, useFullscreenExam } from '@/hooks/useFullscreenExam';
import { useExamBlocks } from '@/hooks/useExamBlocks';
import { useExamBlockConfig } from '@/hooks/useExamBlockConfig';
import { useMembershipStatus } from '@/hooks/useMembershipStatus';
import { ExamCountdownModal } from '@/components/dashboard/ExamCountdownModal';
import { ExamFullscreenGateModal } from '@/components/dashboard/ExamFullscreenGateModal';
import { ExamTakingOverlay, ExamQuestionPanel } from '@/components/dashboard/ExamTakingOverlay';
import { PageHeader } from '@/components/common/PageHeader';
import { ConfirmFinishModal } from '@/components/dashboard/ConfirmFinishModal';
import { ExamQuestionOptions } from '@/components/dashboard/ExamQuestionOptions';
import { buildExamSubmitPayload, setSingleAnswer, toggleMultiAnswer } from '@/lib/examAnswers';

export function ExamPracticePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const examStatus = useExamControlStatus();
  const examEnabled = Boolean(examStatus.data?.enabled && examStatus.data?.allowed);
  const membership = useMembershipStatus();
  const hasActiveMembership = Boolean(membership.data?.isActive);
  const { data: categories, isLoading } = useQuery({
    queryKey: ['exam-practice-categories'],
    queryFn: () => apiGet<PracticeCategory[]>('/ujian/practice/categories'),
    enabled: examEnabled,
  });
  const { data: blocks, refetch: refetchBlocks } = useExamBlocks(examEnabled, '/ujian');
  const { data: blockConfig } = useExamBlockConfig(examEnabled, '/ujian');
  const [activeCategorySlug, setActiveCategorySlug] = useState<string | null>(null);
  const [activeSubCategoryId, setActiveSubCategoryId] = useState<string | null>(null);
  const [activeSubSubCategoryId, setActiveSubSubCategoryId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PracticeSet | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<{ score: number; correct: number; total: number; resultId: string } | null>(null);
  const [examActive, setExamActive] = useState(false);
  const [countdownOpen, setCountdownOpen] = useState(false);
  const [countdownToken, setCountdownToken] = useState(0);
  const [fullscreenGateOpen, setFullscreenGateOpen] = useState(false);
  const [pendingGateSet, setPendingGateSet] = useState<PracticeSet | null>(null);
  const [unlockCode, setUnlockCode] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [recentSet, setRecentSet] = useState<{ title: string; category: string } | null>(null);
  const autoStartRef = useRef(false);
  const returnToRef = useRef<string | null>(null);
  const pendingStartRef = useRef<string | null>(null);
  const skipCountdownRef = useRef(false);
  const practiceBlock = blocks?.find((block) => block.type === 'PRACTICE');
  const examBlockEnabled = blockConfig?.examEnabled ?? true;
  const { request: requestFullscreen, exit: exitFullscreen, setViolationHandler, isSupported: fullscreenSupported } =
    useFullscreenExam({
      active: examActive && examBlockEnabled,
    });

  const violationMutation = useMutation({
    mutationFn: (reason: string) => apiPost('/ujian/blocks', { type: 'PRACTICE', reason }),
    onSuccess: () => refetchBlocks(),
  });

  const unlockMutation = useMutation({
    mutationFn: (code: string) => apiPost('/ujian/blocks/unlock', { type: 'PRACTICE', code }),
    onSuccess: () => {
      toast.success('Blokir ujian terbuka kembali');
      setUnlockCode('');
      refetchBlocks();
    },
    onError: () => toast.error('Kode buka blokir tidak valid'),
  });

  useEffect(() => {
    if (!examBlockEnabled) {
      setViolationHandler(null);
      return undefined;
    }
    const handler = (reason: string) => {
      setExamActive(false);
      setDetail(null);
      exitFullscreen();
      toast.error(`Ujian dibatalkan: ${reason}`);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setResult(null);
      setFinishConfirmOpen(false);
      violationMutation.mutate(reason);
    };
    setViolationHandler(handler);
    return () => setViolationHandler(null);
  }, [examBlockEnabled, exitFullscreen, setViolationHandler, violationMutation]);


  const loadSet = useMutation<PracticeSet, Error, string>({
    mutationFn: (slug: string) => apiGet<PracticeSet>(`/ujian/practice/${slug}`),
  });

  const syncReturnTo = useCallback((payload: PracticeSet) => {
    const categorySlug = payload.subSubCategory.subCategory.category.slug;
    if (!returnToRef.current || returnToRef.current.includes('/detail/')) {
      returnToRef.current = categorySlug
        ? `/app/ujian/soal/kategori/${categorySlug}/sub/${payload.subSubCategory.subCategory.id}/subsub/${payload.subSubCategory.id}`
        : '/app/ujian/soal';
    }
  }, []);

  const startSession = useCallback(
    (payload: PracticeSet) => {
      if (fullscreenSupported && !isDocumentFullscreen()) {
        setPendingGateSet(payload);
        setFullscreenGateOpen(true);
        setCountdownOpen(false);
        return;
      }
      syncReturnTo(payload);
      setDetail(payload);
      setRecentSet({
        title: payload.title,
        category: `${payload.subSubCategory.subCategory.category.name} / ${payload.subSubCategory.subCategory.name} / ${payload.subSubCategory.name}`,
      });
      setAnswers({});
      setResult(null);
      setExamActive(true);
      setCurrentQuestionIndex(0);
      setFinishConfirmOpen(false);
      setCountdownOpen(false);
      setFullscreenGateOpen(false);
      setPendingGateSet(null);
    },
    [fullscreenSupported, syncReturnTo],
  );

  const handleFullscreenGate = useCallback(async () => {
    const payload = pendingGateSet ?? detail;
    if (!payload) {
      setFullscreenGateOpen(false);
      return;
    }
    if (fullscreenSupported) {
      try {
        await requestFullscreen();
        if (!isDocumentFullscreen()) {
          throw new Error('Fullscreen tidak aktif');
        }
      } catch {
        toast.error('Mode layar penuh wajib diaktifkan untuk memulai ujian.');
        setFullscreenGateOpen(false);
        setPendingGateSet(null);
        setDetail(null);
        const fallback = returnToRef.current ?? `/app/ujian/soal/detail/${payload.slug}`;
        navigate(fallback);
        return;
      }
    }
    setFullscreenGateOpen(false);
    setPendingGateSet(null);
    // Setelah layar penuh aktif → hitung mundur → baru mulai soal
    syncReturnTo(payload);
    setDetail(payload);
    setRecentSet({
      title: payload.title,
      category: `${payload.subSubCategory.subCategory.category.name} / ${payload.subSubCategory.subCategory.name} / ${payload.subSubCategory.name}`,
    });
    setAnswers({});
    setResult(null);
    setExamActive(false);
    setCurrentQuestionIndex(0);
    setFinishConfirmOpen(false);
    setCountdownToken((prev) => prev + 1);
    setCountdownOpen(true);
  }, [detail, fullscreenSupported, navigate, pendingGateSet, requestFullscreen, syncReturnTo]);

  const beginCountdown = useCallback(
    (payload: PracticeSet) => {
      if (fullscreenSupported && !isDocumentFullscreen()) {
        setPendingGateSet(payload);
        setFullscreenGateOpen(true);
        return;
      }
      syncReturnTo(payload);
      setDetail(payload);
      setRecentSet({
        title: payload.title,
        category: `${payload.subSubCategory.subCategory.category.name} / ${payload.subSubCategory.subCategory.name} / ${payload.subSubCategory.name}`,
      });
      setAnswers({});
      setResult(null);
      setExamActive(false);
      setCurrentQuestionIndex(0);
      setFinishConfirmOpen(false);
      setCountdownToken((prev) => prev + 1);
      setCountdownOpen(true);
    },
    [fullscreenSupported, syncReturnTo],
  );

  const handleStartFromSlug = useCallback(
    (slug: string, _skipCountdown = false) => {
      loadSet.mutate(slug, {
        onSuccess: (payload) => {
          beginCountdown(payload);
        },
        onError: (error) => {
          console.error('load practice set failed', error);
          const message = isAxiosError(error)
            ? (error.response?.data as { message?: string })?.message
            : error instanceof Error
              ? error.message
              : null;
          toast.error(message ?? 'Gagal memuat ujian soal. Coba ulangi lagi.');
          if (isAxiosError(error) && error.response?.status === 423) {
            refetchBlocks();
          }
        },
      });
    },
    [beginCountdown, loadSet, refetchBlocks],
  );

  useEffect(() => {
    const state = location.state as { startPractice?: { slug: string }; returnTo?: string; skipCountdown?: boolean } | null;
    const startFromQuery = searchParams.get('start');
    const startFromStorage = sessionStorage.getItem('exam_practice_start_slug');
    const skipCountdown = state?.skipCountdown === true || searchParams.get('skipCountdown') === '1';
    const slug = state?.startPractice?.slug ?? startFromQuery ?? startFromStorage ?? null;
    if (!slug) return;
    returnToRef.current = state?.returnTo ?? '/app/ujian/soal';
    pendingStartRef.current = slug;
    skipCountdownRef.current = skipCountdown;
    if (startFromStorage) {
      sessionStorage.removeItem('exam_practice_start_slug');
    }
    if (startFromQuery) {
      const search = new URLSearchParams(window.location.search);
      search.delete('start');
      search.delete('skipCountdown');
      const next = search.toString();
      window.history.replaceState(null, '', next ? `/app/ujian/soal/mulai?${next}` : '/app/ujian/soal/mulai');
    }
    if (skipCountdown && !startFromQuery) {
      const search = new URLSearchParams(window.location.search);
      search.delete('skipCountdown');
      const next = search.toString();
      window.history.replaceState(null, '', next ? `/app/ujian/soal/mulai?${next}` : '/app/ujian/soal/mulai');
    }
  }, [location.state, searchParams]);

  useEffect(() => {
    const slug = pendingStartRef.current;
    if (!slug || autoStartRef.current) return;
    if (!examEnabled) return;
    if (practiceBlock) {
      toast.error('Akses ujian diblokir. Masukkan kode buka blokir dari admin.');
      pendingStartRef.current = null;
      const fallback = returnToRef.current ?? `/app/ujian/soal/detail/${slug}`;
      navigate(fallback);
      return;
    }
    autoStartRef.current = true;
    pendingStartRef.current = null;
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    window.setTimeout(() => handleStartFromSlug(slug, skipCountdownRef.current), 0);
  }, [examEnabled, handleStartFromSlug, location.pathname, location.search, navigate, practiceBlock]);


  const questions = detail?.questions ?? [];
  const currentQuestion = questions[currentQuestionIndex];
  const fallbackSlug = categories?.[0]?.slug ?? null;
  const slugExists = activeCategorySlug ? categories?.some((category) => category.slug === activeCategorySlug) : false;
  const currentSlug = slugExists ? activeCategorySlug : fallbackSlug;
  const selectedCategory = categories?.find((category) => category.slug === currentSlug) ?? null;
  const availableSubCategories = selectedCategory?.subCategories ?? [];
  const fallbackSubCategoryId = availableSubCategories[0]?.id ?? null;
  const subCategoryExists = activeSubCategoryId
    ? availableSubCategories.some((subCategory) => subCategory.id === activeSubCategoryId)
    : false;
  const currentSubCategoryId = subCategoryExists ? activeSubCategoryId : fallbackSubCategoryId;
  const selectedSubCategory = availableSubCategories.find((subCategory) => subCategory.id === currentSubCategoryId) ?? null;
  const availableSubSubs = selectedSubCategory?.subSubs ?? [];
  const fallbackSubSubId = availableSubSubs[0]?.id ?? null;
  const subSubExists = activeSubSubCategoryId
    ? availableSubSubs.some((subSub) => subSub.id === activeSubSubCategoryId)
    : false;
  const currentSubSubId = subSubExists ? activeSubSubCategoryId : fallbackSubSubId;
  const selectedSubSub = availableSubSubs.find((subSub) => subSub.id === currentSubSubId) ?? null;
  const availableSets = selectedSubSub?.sets ?? [];

  const submit = useMutation({
    mutationFn: () => {
      if (!detail) throw new Error('No set');
      const payload = buildExamSubmitPayload(answers);
      return apiPost<{ resultId: string; score: number; correct: number; total: number }>(`/ujian/practice/${detail.slug}/submit`, {
        answers: payload,
      });
    },
    onSuccess: (payload) => {
      setResult(payload);
      toast.success(`Ujian selesai. Skor ${Math.round(payload.score)}%`);
      setExamActive(false);
      setDetail(null);
      setAnswers({});
      exitFullscreen();
      setCurrentQuestionIndex(0);
      setFinishConfirmOpen(false);
      if (payload.resultId) {
        navigate(`/app/ujian/soal/review/${payload.resultId}`, { replace: true });
      }
    },
    onError: () => toast.error('Gagal mengirim jawaban'),
  });

  const handleForceFinishPractice = useCallback(() => {
    if (!detail) {
      return;
    }
    setFinishConfirmOpen(true);
  }, [detail]);

  const handleConfirmPracticeFinish = useCallback(() => {
    submit.mutate(undefined, {
      onSettled: () => setFinishConfirmOpen(false),
    });
  }, [submit]);

  const handleCancelPracticeFinish = useCallback(() => setFinishConfirmOpen(false), []);

  const handleStartPractice = useCallback(() => {
    if (!detail) return;
    startSession(detail);
  }, [detail, startSession]);

  const handleCancelPractice = useCallback(() => {
    setExamActive(false);
    setDetail(null);
    setAnswers({});
    exitFullscreen();
    setCurrentQuestionIndex(0);
    toast.error('Ujian dibatalkan. Mulai ulang untuk meneruskan.');
    const fallback = returnToRef.current ?? '/app/ujian/soal';
    navigate(fallback);
  }, [exitFullscreen, navigate]);

  const handleCancelCountdown = useCallback(() => {
    setCountdownOpen(false);
    exitFullscreen();
    setDetail(null);
    const fallback = returnToRef.current ?? '/app/ujian/soal';
    navigate(fallback);
  }, [exitFullscreen, navigate]);

  const handleJumpToQuestion = useCallback((index: number) => {
    setCurrentQuestionIndex(index);
  }, []);

  const handlePrevQuestion = useCallback(() => {
    setCurrentQuestionIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleNextQuestion = useCallback(() => {
    setCurrentQuestionIndex((prev) => Math.min(prev + 1, Math.max(questions.length - 1, 0)));
  }, [questions.length]);

  if (examStatus.isLoading) {
    return <Skeleton className="h-72" />;
  }

  if (!examEnabled) {
    return (
      <section className="rounded-3xl border border-brand-200 bg-brand-50 p-6 text-sm text-brand-800">
        Akses ujian tidak tersedia untuk akun Anda. Hubungi admin jika seharusnya mendapatkan akses.
      </section>
    );
  }

  if (practiceBlock) {
    return (
      <section className="space-y-4">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-semibold text-red-800">Akses ujian kamu sedang diblokir.</p>
          <p className="mt-2 text-xs text-red-600">
            Sistem mendeteksi kamu meninggalkan halaman pengerjaan. Hubungi admin melalui WhatsApp untuk mendapatkan kode buka blokir, lalu masukkan di bawah ini.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Input
              placeholder="Kode 6 digit"
              value={unlockCode}
              onChange={(event) => setUnlockCode(event.target.value)}
              className="max-w-xs"
            />
            <Button onClick={() => unlockMutation.mutate(unlockCode)} disabled={unlockMutation.isPending || unlockCode.length < 6}>
              {unlockMutation.isPending ? 'Membuka...' : 'Buka Blokir'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Terakhir pelanggaran: {new Date(practiceBlock.blockedAt).toLocaleString('id-ID')}</p>
        </div>
      </section>
    );
  }

  if (isLoading || !categories) {
    return <Skeleton className="h-72" />;
  }

  return (
    <section className="page-shell space-y-8">
      <PageHeader
        title="Ujian Soal"
        description="Pilih paket ujian berbasis kategori untuk mengukur kemampuanmu."
        action={
          <Button variant="outline" onClick={() => navigate('/app/ujian/soal/riwayat')}>
            Lihat Riwayat Ujian
          </Button>
        }
      />
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Kuota Ujian Soal</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-900">
            {examStatus.data && examStatus.data.examQuota > 0
              ? `${Math.max(examStatus.data.examQuota - examStatus.data.examsUsed, 0)} kali tersisa`
              : 'Tidak terbatas'}
          </h3>
          {examStatus.data && examStatus.data.examQuota > 0 && (
            <p className="text-sm text-slate-500">
              Total {examStatus.data.examQuota} - Terpakai {examStatus.data.examsUsed}
            </p>
          )}
        </div>
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 text-sm text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Aturan Anti-Cheat</p>
          <ul className="mt-3 list-disc space-y-1 pl-4">
            <li>Ujian berjalan dalam mode layar penuh.</li>
            <li>Dilarang berpindah tab atau membuka aplikasi lain.</li>
            <li>Pelanggaran akan menghentikan sesi dan kuota tetap terhitung.</li>
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => {
            const isActive = currentSlug === category.slug;
            const setCount = category.subCategories.reduce(
              (total, subCategory) => total + subCategory.subSubs.reduce((acc, subSub) => acc + subSub.sets.length, 0),
              0,
            );
            return (
              <Card
                key={category.id}
                className={`transition hover:-translate-y-1 ${isActive ? 'border-brand-400 shadow-[0_15px_45px_rgba(63,81,181,0.15)]' : ''}`}
              >
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Kategori</p>
                      <h3 className="text-xl font-semibold text-slate-900">{category.name}</h3>
                    </div>
                    <Badge variant="brand" className="text-[11px]">
                      {setCount} paket
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-3">Ujian tematik dengan soal pilihan ganda terkini.</p>
                  <Button
                    variant={isActive ? 'primary' : 'outline'}
                    className="w-full"
                    onClick={() => {
                      setActiveCategorySlug(category.slug);
                      setActiveSubCategoryId(null);
                      setActiveSubSubCategoryId(null);
                      setDetail(null);
                    }}
                  >
                    {isActive ? 'Kategori Dipilih' : 'Jelajahi Paket'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {categories.length === 0 && <p className="text-sm text-slate-500">Belum ada kategori ujian.</p>}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Sub Kategori</p>
          <h2 className="text-2xl font-semibold text-slate-900">{selectedCategory?.name ?? 'Pilih kategori dulu'}</h2>
          <p className="text-sm text-slate-600">{availableSubCategories.length} sub kategori tersedia.</p>
        </div>
        {availableSubCategories.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            Sub kategori belum tersedia untuk kategori ini.
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {availableSubCategories.map((subCategory) => {
              const isActive = subCategory.id === currentSubCategoryId;
              return (
                <Button
                  key={subCategory.id}
                  variant={isActive ? 'primary' : 'outline'}
                  onClick={() => {
                    setActiveSubCategoryId(subCategory.id);
                    setActiveSubSubCategoryId(null);
                  }}
                >
                  {subCategory.name}
                </Button>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Sub Sub Kategori</p>
          <h2 className="text-2xl font-semibold text-slate-900">{selectedSubCategory?.name ?? 'Pilih sub kategori dulu'}</h2>
          <p className="text-sm text-slate-600">{availableSubSubs.length} kelompok soal tersedia.</p>
        </div>
        {availableSubSubs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            Sub sub kategori belum tersedia untuk sub kategori ini.
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {availableSubSubs.map((subSub) => {
              const isActive = subSub.id === currentSubSubId;
              return (
                <Button key={subSub.id} variant={isActive ? 'primary' : 'outline'} onClick={() => setActiveSubSubCategoryId(subSub.id)}>
                  {subSub.name}
                </Button>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Paket Ujian</p>
            <h2 className="text-2xl font-semibold text-slate-900">{selectedSubSub?.name ?? 'Pilih sub sub kategori dulu'}</h2>
            <p className="text-sm text-slate-600">{availableSets.length} paket siap dikerjakan.</p>
          </div>
        </div>
        {availableSets.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Pilih kategori ujian untuk melihat paket soal.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {availableSets.map((set) => {
              const activeSet = detail?.id === set.id && (examActive || countdownOpen);
              const buttonLabel = activeSet ? 'Sedang Berjalan' : 'Lihat Detail';
              return (
                <Card
                  key={set.id}
                  className={activeSet ? 'border-brand-400 shadow-[0_15px_45px_rgba(63,81,181,0.12)]' : ''}
                >
                  <CardContent className="space-y-3 p-5">
                    {getAssetUrl(set.coverImageUrl) && (
                      <img
                        src={getAssetUrl(set.coverImageUrl)}
                        alt={set.title}
                        className="h-44 w-full rounded-3xl object-cover md:h-52"
                        loading="lazy"
                      />
                    )}
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="uppercase tracking-widest">{set.level ?? 'Umum'}</span>
                      <Badge variant="outline">Siap dikerjakan</Badge>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">{set.title}</h3>
                    <p className="text-sm text-slate-600 line-clamp-3">{set.description}</p>
                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {set.isFree && <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">Gratis</span>}
                      {!hasActiveMembership && !set.isFree && (
                        <span className="rounded-full bg-brand-100 px-2 py-1 text-brand-700">Butuh Paket</span>
                      )}
                    </div>
                    <Button
                      className="w-full"
                      variant={activeSet ? 'primary' : 'outline'}
                      onClick={() => navigate(`/app/ujian/soal/detail/${set.slug}`)}
                      disabled={activeSet}
                    >
                      {buttonLabel}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {result && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-500">Hasil Terakhir</p>
              <h3 className="text-2xl font-semibold text-slate-900">{recentSet?.title ?? 'Ujian Terakhir'}</h3>
              {recentSet && <p className="text-sm text-slate-500">Kategori {recentSet.category}</p>}
              <p className="mt-2 text-sm text-slate-600">
                Skor {Math.round(result.score)}% - {result.correct}/{result.total} soal benar
              </p>
            </div>
            {result.resultId && (
              <Button variant="outline" onClick={() => navigate(`/app/ujian/soal/review/${result.resultId}`)}>
                Lihat Pembahasan
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <ExamTakingOverlay
        open={Boolean(detail && examActive)}
        eyebrow="Ujian Soal"
        title={detail?.title ?? 'Ujian'}
        subtitle={
          detail
            ? `Kategori ${detail.subSubCategory.subCategory.category.name} / ${detail.subSubCategory.subCategory.name} / ${detail.subSubCategory.name}`
            : undefined
        }
        timeLeftLabel={null}
        questions={questions}
        answers={answers}
        activeIndex={currentQuestionIndex}
        onJump={handleJumpToQuestion}
        onPrev={handlePrevQuestion}
        onNext={handleNextQuestion}
        onFinish={handleForceFinishPractice}
        onCancel={handleCancelPractice}
        submitPending={submit.isPending}
        finishLabel="Akhiri Ujian"
        cancelLabel="Batalkan"
      >
        {currentQuestion ? (
          <ExamQuestionPanel
            index={currentQuestionIndex}
            prompt={currentQuestion.prompt}
            imageUrl={getAssetUrl(currentQuestion.imageUrl)}
            multipleCorrect={Boolean(currentQuestion.multipleCorrect)}
          >
            <ExamQuestionOptions
              questionId={currentQuestion.id}
              options={currentQuestion.options}
              multipleCorrect={Boolean(currentQuestion.multipleCorrect)}
              selectedIds={answers[currentQuestion.id] ?? []}
              onSelectSingle={(optionId) =>
                setAnswers((prev) => setSingleAnswer(prev, currentQuestion.id, optionId))
              }
              onToggleMulti={(optionId) =>
                setAnswers((prev) => toggleMultiAnswer(prev, currentQuestion.id, optionId))
              }
            />
          </ExamQuestionPanel>
        ) : null}
      </ExamTakingOverlay>
      <ExamCountdownModal
        open={countdownOpen}
        resetKey={countdownToken}
        title="Mulai Ujian"
        subtitle="Tetap berada di halaman ini hingga selesai."
        warning={
          examBlockEnabled
            ? 'Ujian Akan Di Blokir Saat Anda Meninggalkan Halaman Ujian - Harap Tetap berada di Halaman Ujian Ini dan Kerjakan seluruh soal sampai selesai'
            : null
        }
        onComplete={handleStartPractice}
        onCancel={handleCancelCountdown}
      />
      <ExamFullscreenGateModal
        open={fullscreenGateOpen}
        eyebrow="Persiapan Ujian"
        onConfirm={handleFullscreenGate}
        onCancel={() => {
          setFullscreenGateOpen(false);
          setPendingGateSet(null);
          const fallback = returnToRef.current ?? '/app/ujian/soal';
          navigate(fallback);
        }}
      />
      <ConfirmFinishModal
        open={finishConfirmOpen}
        title="Akhiri ujian sekarang?"
        description="Jawaban yang sudah terisi otomatis disimpan. Kamu masih bisa meninjau pembahasan setelah selesai."
        confirmText="Ya, akhiri"
        cancelText="Lanjutkan Ujian"
        loading={submit.isPending}
        onConfirm={handleConfirmPracticeFinish}
        onCancel={handleCancelPracticeFinish}
      />
    </section>
  );
}

