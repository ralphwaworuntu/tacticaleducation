import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import { getAssetUrl } from '@/lib/media';
import type { Tryout, TryoutDetail } from '@/types/exam';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useExamControlStatus } from '@/hooks/useExamControl';
import { useFullscreenExam } from '@/hooks/useFullscreenExam';
import { useExamBlocks } from '@/hooks/useExamBlocks';
import { ExamCountdownModal } from '@/components/dashboard/ExamCountdownModal';
import { ConfirmFinishModal } from '@/components/dashboard/ConfirmFinishModal';
import { QuestionNavigator } from '@/components/dashboard/QuestionNavigator';

type TryoutSession = {
  detail: TryoutDetail;
  resultId: string;
  durationMinutes: number;
};

type ApiErrorResponse = {
  message?: string;
  details?: { code?: string };
};

export function ExamTryoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const examStatus = useExamControlStatus();
  const examEnabled = Boolean(examStatus.data?.enabled && examStatus.data?.allowed);
  const { data: tryouts, isLoading } = useQuery({
    queryKey: ['exam-tryouts'],
    queryFn: () => apiGet<Tryout[]>('/ujian/tryouts'),
    enabled: examEnabled,
  });
  const { data: blocks, refetch: refetchBlocks } = useExamBlocks(examEnabled, '/ujian');
  const [session, setSession] = useState<TryoutSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | undefined>>({});
  const [result, setResult] = useState<{ score: number; correct: number; total: number; resultId: string } | null>(null);
  const [unlockCode, setUnlockCode] = useState('');
  const [countdownOpen, setCountdownOpen] = useState(false);
  const [countdownToken, setCountdownToken] = useState(0);
  const [pendingTryout, setPendingTryout] = useState<Tryout | null>(null);
  const returnToRef = useRef<string | null>(null);
  const [fullscreenGateOpen, setFullscreenGateOpen] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const tryoutBlock = blocks?.find((block) => block.type === 'TRYOUT');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeSubCategoryId, setActiveSubCategoryId] = useState<string | null>(null);
  const autoStartRef = useRef(false);
  const countdownStartRef = useRef(false);

  const categoryGroups = useMemo(() => {
    if (!tryouts) return [];
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        subCategories: Array<{ id: string; name: string; tryouts: Tryout[] }>;
      }
    >();
    tryouts.forEach((item) => {
      const category = item.subCategory.category;
      if (!map.has(category.id)) {
        map.set(category.id, { id: category.id, name: category.name, subCategories: [] });
      }
      const group = map.get(category.id)!;
      let subGroup = group.subCategories.find((sub) => sub.id === item.subCategory.id);
      if (!subGroup) {
        subGroup = { id: item.subCategory.id, name: item.subCategory.name, tryouts: [] };
        group.subCategories.push(subGroup);
      }
      subGroup.tryouts.push(item);
    });
    return Array.from(map.values());
  }, [tryouts]);

  const resolvedCategoryId = activeCategoryId ?? categoryGroups[0]?.id ?? null;

  const selectedCategory = useMemo(() => {
    if (!categoryGroups.length || !resolvedCategoryId) return null;
    return categoryGroups.find((category) => category.id === resolvedCategoryId) ?? null;
  }, [categoryGroups, resolvedCategoryId]);

  const resolvedSubCategoryId = activeSubCategoryId ?? selectedCategory?.subCategories[0]?.id ?? null;
  const selectedSubCategory =
    selectedCategory?.subCategories.find((subCategory) => subCategory.id === resolvedSubCategoryId) ?? null;

  const { request: requestFullscreen, exit: exitFullscreen, setViolationHandler, isSupported: fullscreenSupported } =
    useFullscreenExam({
      active: Boolean(session),
    });

  const violationMutation = useMutation({
    mutationFn: (reason: string) => apiPost('/ujian/blocks', { type: 'TRYOUT', reason }),
    onSuccess: () => refetchBlocks(),
  });

  const unlockMutation = useMutation({
    mutationFn: (code: string) => apiPost('/ujian/blocks/unlock', { type: 'TRYOUT', code }),
    onSuccess: () => {
      toast.success('Blokir tryout berhasil dibuka');
      setUnlockCode('');
      refetchBlocks();
    },
    onError: () => toast.error('Kode buka blokir tidak valid'),
  });

  const handleSessionReset = useCallback(
    (reason?: string) => {
      setSession((current) => {
        if (!current) return current;
        if (reason) {
          toast.error(`Sesi tryout dihentikan: ${reason}`);
        }
        setAnswers({});
        setResult(null);
        setCurrentQuestionIndex(0);
        setFinishConfirmOpen(false);
        return null;
      });
    },
    [],
  );

  useEffect(() => {
    setViolationHandler((reason) => {
      violationMutation.mutate(reason ?? 'Pelanggaran fullscreen');
      handleSessionReset(reason);
      exitFullscreen();
    });
    return () => setViolationHandler(null);
  }, [exitFullscreen, handleSessionReset, setViolationHandler, violationMutation]);

  useEffect(() => {
    return () => {
      exitFullscreen();
    };
  }, [exitFullscreen]);


  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const startMutation = useMutation({
    mutationFn: async (tryout: Tryout) => {
      const start = await apiPost<{ resultId: string; durationMinutes: number }>(`/ujian/tryouts/${tryout.slug}/start`);
      const detail = await apiGet<TryoutDetail>(`/ujian/tryouts/${tryout.slug}`);
      return { detail, resultId: start.resultId, durationMinutes: start.durationMinutes } satisfies TryoutSession;
    },
    onSuccess: (payload) => {
      setSession(payload);
      setAnswers({});
      setResult(null);
      setCurrentQuestionIndex(0);
      toast.success('Tryout dimulai, selamat mengerjakan!');
    },
    onError: (error) => {
      const apiError = error as AxiosError<ApiErrorResponse>;
      const serverMessage = apiError.response?.data?.message?.trim();
      const code = apiError.response?.data?.details?.code;
      if (code === 'TRYOUT_QUOTA_EXHAUSTED' && serverMessage) {
        toast.error(`Gagal Memulai Tryout - ${serverMessage}`);
      } else if (serverMessage) {
        toast.error(serverMessage);
      } else {
        toast.error('Gagal memulai tryout');
      }
      exitFullscreen();
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!session) throw new Error('No session');
      const { detail, resultId } = session;
      const payload = Object.entries(answers)
        .filter(([, optionId]) => optionId)
        .map(([questionId, optionId]) => ({ questionId, optionId }));
      return apiPost<{ resultId: string; score: number; correct: number; total: number }>(`/ujian/tryouts/${detail.slug}/submit`, {
        resultId,
        answers: payload,
      });
    },
    onSuccess: (payload) => {
      setResult(payload);
      setSession(null);
      setCurrentQuestionIndex(0);
      toast.success(`Tryout selesai. Skor kamu ${Math.round(payload.score)}%`);
      exitFullscreen();
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['exam-tryout-history'] });
      if (payload.resultId) {
        navigate(`/app/ujian/tryout/review/${payload.resultId}`);
      }
    },
    onError: () => toast.error('Gagal mengirim jawaban'),
  });

  const handleForceFinish = useCallback(() => {
    if (!session) {
      return;
    }
    setFinishConfirmOpen(true);
  }, [session]);

  const handleConfirmFinish = useCallback(() => {
    submitMutation.mutate(undefined, {
      onSettled: () => setFinishConfirmOpen(false),
    });
  }, [submitMutation]);

  const handleCancelFinish = useCallback(() => setFinishConfirmOpen(false), []);

  const questionList = useMemo(() => session?.detail.questions ?? [], [session]);
  const currentQuestion = questionList[currentQuestionIndex];
  const isFirstQuestion = currentQuestionIndex === 0;
  const isLastQuestion = currentQuestionIndex >= Math.max(questionList.length - 1, 0);
  const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString('id-ID') : null);
  const getScheduleText = (tryout: Tryout) => {
    const start = formatDateTime(tryout.openAt);
    const end = formatDateTime(tryout.closeAt);
    if (!start && !end) {
      return 'Tersedia sepanjang waktu';
    }
    return `${start ?? 'Segera'} - ${end ?? 'Tanpa batas'}`;
  };
  const getScheduleStatus = (tryout: Tryout) => {
    const now = nowTs;
    if (tryout.openAt && new Date(tryout.openAt).getTime() > now) {
      return { active: false, label: `Dibuka ${formatDateTime(tryout.openAt)}` };
    }
    if (tryout.closeAt && new Date(tryout.closeAt).getTime() < now) {
      return { active: false, label: 'Periode tryout berakhir' };
    }
    return { active: true, label: 'Sedang dibuka' };
  };

  const handleManualCancel = useCallback(() => {
    handleSessionReset('Membatalkan sesi');
    exitFullscreen();
    const fallback = returnToRef.current ?? '/app/ujian/tryout';
    navigate(fallback);
  }, [exitFullscreen, handleSessionReset, navigate]);

  const handleCountdownRequest = useCallback(
    async (item: Tryout) => {
      if (tryoutBlock) {
        toast.error('Akses tryout diblokir, masukkan kode buka blokir dari admin.');
        return;
      }
      countdownStartRef.current = false;
      setPendingTryout(item);
      if (fullscreenSupported && !document.fullscreenElement) {
        setFullscreenGateOpen(true);
        return;
      }
      setCountdownToken((prev) => prev + 1);
      setCountdownOpen(true);
    },
    [fullscreenSupported, tryoutBlock],
  );

  useEffect(() => {
    const state = location.state as { startTryoutSlug?: string; returnTo?: string } | null;
    const startFromStorage = sessionStorage.getItem('exam_tryout_start_slug');
    if (!examEnabled) return;
    const startSlug = state?.startTryoutSlug ?? startFromStorage ?? null;
    if (!startSlug || autoStartRef.current || !tryouts?.length) return;
    const target = tryouts.find((item) => item.slug === startSlug);
    returnToRef.current = state?.returnTo ?? `/app/ujian/tryout/detail/${startSlug}`;
    autoStartRef.current = true;
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    if (startFromStorage) {
      sessionStorage.removeItem('exam_tryout_start_slug');
    }
    if (!target) {
      toast.error('Tryout tidak ditemukan.');
      return;
    }
    window.setTimeout(() => handleCountdownRequest(target), 0);
  }, [examEnabled, handleCountdownRequest, location.pathname, location.search, location.state, navigate, tryouts]);

  const handleCountdownCancel = useCallback(() => {
    countdownStartRef.current = false;
    setCountdownOpen(false);
    setPendingTryout(null);
    exitFullscreen();
    const fallback = returnToRef.current ?? '/app/ujian/tryout';
    navigate(fallback);
  }, [exitFullscreen, navigate]);

  const handleCountdownComplete = useCallback(() => {
    if (!pendingTryout) {
      setCountdownOpen(false);
      return;
    }
    if (countdownStartRef.current) {
      return;
    }
    if (fullscreenSupported && !document.fullscreenElement) {
      setCountdownOpen(false);
      setFullscreenGateOpen(true);
      return;
    }
    countdownStartRef.current = true;
    startMutation.mutate(pendingTryout, {
      onSettled: () => {
        countdownStartRef.current = false;
        setCountdownOpen(false);
        setPendingTryout(null);
      },
    });
  }, [fullscreenSupported, pendingTryout, startMutation]);

  const handleFullscreenGate = useCallback(async () => {
    if (!pendingTryout) {
      setFullscreenGateOpen(false);
      return;
    }
    if (fullscreenSupported) {
      try {
        await requestFullscreen();
      } catch {
        toast.error('Mode layar penuh wajib diizinkan untuk memulai tryout.');
        setPendingTryout(null);
        const fallback = returnToRef.current ?? `/app/ujian/tryout/detail/${pendingTryout.slug}`;
        navigate(fallback);
        return;
      }
    }
    setFullscreenGateOpen(false);
    setCountdownToken((prev) => prev + 1);
    setCountdownOpen(true);
  }, [fullscreenSupported, navigate, pendingTryout, requestFullscreen]);

  const handleJumpToQuestion = useCallback((index: number) => {
    setCurrentQuestionIndex(index);
  }, []);

  const handlePrevQuestion = useCallback(() => {
    setCurrentQuestionIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleNextQuestion = useCallback(() => {
    setCurrentQuestionIndex((prev) => Math.min(prev + 1, Math.max(questionList.length - 1, 0)));
  }, [questionList.length]);

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

  if (tryoutBlock) {
    return (
      <section className="space-y-4 rounded-3xl border border-red-200 bg-red-50 p-6">
        <div>
          <p className="text-sm font-semibold text-red-800">Akses tryout kamu diblokir sementara.</p>
          <p className="mt-2 text-xs text-red-600">
            Sistem mendeteksi pelanggaran aturan anti-cheat. Masukkan kode buka blokir dari admin Tactical Education agar dapat mengerjakan kembali.
          </p>
          <p className="mt-2 text-xs text-slate-500">Terakhir pelanggaran: {new Date(tryoutBlock.blockedAt).toLocaleString('id-ID')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Kode 6 digit"
            value={unlockCode}
            onChange={(event) => setUnlockCode(event.target.value)}
            className="max-w-xs"
          />
          <Button onClick={() => unlockMutation.mutate(unlockCode)} disabled={unlockMutation.isPending || unlockCode.length < 6}>
            {unlockMutation.isPending ? 'Memverifikasi...' : 'Buka Blokir'}
          </Button>
        </div>
      </section>
    );
  }

  if (isLoading || !tryouts) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Kuota Tryout Ujian</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-900">
            {examStatus.data && examStatus.data.tryoutQuota > 0
              ? `${Math.max(examStatus.data.tryoutQuota - examStatus.data.tryoutsUsed, 0)} kali tersisa`
              : 'Tidak terbatas'}
          </h3>
          {examStatus.data && examStatus.data.tryoutQuota > 0 && (
            <p className="text-sm text-slate-500">
              Total {examStatus.data.tryoutQuota} - Terpakai {examStatus.data.tryoutsUsed}
            </p>
          )}
        </div>
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 text-sm text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Aturan Anti-Cheat</p>
          <ul className="mt-3 list-disc space-y-1 pl-4">
            <li>Tryout berjalan dalam mode layar penuh.</li>
            <li>Dilarang berpindah tab, mengecilkan layar, atau membuka aplikasi lain.</li>
            <li>Pelanggaran akan menghentikan sesi dan kuota tetap terhitung.</li>
          </ul>
        </div>
      </section>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Kategori Tryout</p>
            <h2 className="text-3xl font-bold text-slate-900">Pilih Ujian Sesuai Fokus</h2>
            <p className="text-sm text-slate-600">Tap kategori untuk melihat daftar tryout yang tersedia.</p>
          </div>
        </div>
        {categoryGroups.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Belum ada tryout yang tersedia.
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {categoryGroups.map((category) => {
                const isActive = resolvedCategoryId === category.id;
                const totalTryouts = category.subCategories.reduce((acc, subCategory) => acc + subCategory.tryouts.length, 0);
                return (
                  <Card
                    key={category.id}
                    className={`transition ${isActive ? 'border-brand-400 shadow-[0_15px_45px_rgba(63,81,181,0.12)]' : ''}`}
                  >
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Kategori</p>
                          <h3 className="text-xl font-semibold text-slate-900">{category.name}</h3>
                        </div>
                        <div className="rounded-2xl bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {totalTryouts} paket
                        </div>
                      </div>
                      <p className="text-sm text-slate-600">Paket tryout khusus fokus {category.name}.</p>
                      <Button
                        className="w-full"
                        variant={isActive ? 'primary' : 'outline'}
                        onClick={() => {
                          setActiveCategoryId(category.id);
                          setActiveSubCategoryId(null);
                        }}
                      >
                        {isActive ? 'Kategori Dipilih' : 'Pilih Kategori'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Sub Kategori</p>
                <h3 className="text-2xl font-semibold text-slate-900">{selectedCategory?.name ?? 'Pilih kategori'}</h3>
                <p className="text-sm text-slate-600">{selectedCategory?.subCategories.length ?? 0} sub kategori tersedia</p>
              </div>
              {selectedCategory?.subCategories.length ? (
                <div className="flex flex-wrap gap-3">
                  {selectedCategory.subCategories.map((subCategory) => {
                    const isActive = subCategory.id === resolvedSubCategoryId;
                    return (
                      <Button
                        key={subCategory.id}
                        variant={isActive ? 'primary' : 'outline'}
                        onClick={() => setActiveSubCategoryId(subCategory.id)}
                      >
                        {subCategory.name}
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  Sub kategori belum tersedia.
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Daftar Tryout</p>
                  <h3 className="text-2xl font-semibold text-slate-900">{selectedSubCategory?.name ?? 'Pilih sub kategori'}</h3>
                  <p className="text-sm text-slate-600">
                    {selectedSubCategory
                      ? `${selectedSubCategory.tryouts.length} paket tersedia`
                      : 'Belum ada tryout dalam sub kategori ini'}
                  </p>
                </div>
              </div>
              {selectedSubCategory ? (
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {selectedSubCategory.tryouts.map((item) => {
                    const status = getScheduleStatus(item);
                    return (
                      <Card key={item.id}>
                        <CardContent className="space-y-3 p-4">
                          {getAssetUrl(item.coverImageUrl) && (
                            <img
                              src={getAssetUrl(item.coverImageUrl)}
                              alt={item.name}
                              className="h-48 w-full rounded-3xl object-cover md:h-56"
                              loading="lazy"
                            />
                          )}
                          <p className="text-xs uppercase tracking-widest text-slate-500">
                            {item.subCategory.category.name} / {item.subCategory.name}
                          </p>
                          <h3 className="text-lg font-semibold text-slate-900">{item.name}</h3>
                          <p className="text-sm text-slate-600">{item.summary}</p>
                          <p className="text-[11px] text-slate-500">Jadwal: {getScheduleText(item)}</p>
                          <p className={`text-[11px] ${status.active ? 'text-emerald-600' : 'text-red-500'}`}>Status: {status.label}</p>
                          <Button
                            className="w-full"
                            variant={session?.detail.id === item.id ? 'outline' : 'primary'}
                            onClick={() => navigate(`/app/ujian/tryout/detail/${item.slug}`)}
                          >
                            Lihat Detail
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  Pilih sub kategori untuk melihat tryout yang tersedia.
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {session && typeof document !== 'undefined' &&
        createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-900/95">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 text-white">
            <div>
              <p className="text-xs uppercase tracking-[0.5em] text-white/60">Tryout Berlangsung</p>
              <h2 className="text-2xl font-semibold">{session.detail.name}</h2>
              <p className="text-sm text-white/70">Durasi {session.durationMinutes} menit - Tetap fokus di layar ini.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/30 px-4 py-2 text-center">
                <p className="text-xs uppercase text-white/60">Total Soal</p>
                <p className="text-lg font-bold">{questionList.length}</p>
              </div>
              <Button
                variant="outline"
                className="border-white/40 text-white hover:bg-white/10"
                type="button"
                onClick={handleForceFinish}
                disabled={submitMutation.isPending}
              >
                Akhiri Tryout
              </Button>
              <Button variant="ghost" className="text-white hover:bg-white/10" type="button" onClick={handleManualCancel}>
                Batalkan
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-10">
            <div className="mx-auto mt-4 flex max-w-6xl flex-col gap-6 lg:flex-row">
              <div className="flex-1 rounded-[36px] bg-white/95 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.55)]">
              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                {currentQuestion && (
                  <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <p className="text-sm font-semibold text-slate-900">
                      <span className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/15 text-xs font-bold text-brand-600">
                        {currentQuestionIndex + 1}
                      </span>
                      {currentQuestion.prompt}
                    </p>
                    {currentQuestion.imageUrl && (
                      <img
                        src={getAssetUrl(currentQuestion.imageUrl)}
                        alt="Soal"
                        className="mt-4 w-full rounded-2xl border border-slate-100 object-cover"
                        loading="lazy"
                      />
                    )}
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {currentQuestion.options.map((option, index) => {
                        const letter = String.fromCharCode(65 + index);
                        const active = answers[currentQuestion.id] === option.id;
                        return (
                          <label
                            key={option.id}
                            className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                              active
                                ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-inner'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name={currentQuestion.id}
                              value={option.id}
                              checked={active}
                              onChange={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: option.id }))}
                              className="hidden"
                              />
                            <span className="flex-1">
                              <span className="mr-2 font-semibold text-slate-500">{letter}.</span>
                              {option.label}
                            </span>
                            {option.imageUrl && (
                              <img src={getAssetUrl(option.imageUrl)} alt="Opsi" className="h-12 w-12 rounded-xl object-cover" loading="lazy" />
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-600">
                    Soal {currentQuestionIndex + 1} dari {questionList.length}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="muted" onClick={handlePrevQuestion} disabled={isFirstQuestion}>
                      Soal Sebelumnya
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleNextQuestion}
                      disabled={isLastQuestion}
                    >
                      Soal Berikutnya
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button size="lg" className="min-w-[180px]" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                    {submitMutation.isPending ? 'Mengirim jawaban...' : 'Kumpulkan Jawaban'}
                  </Button>
                </div>
              </form>
              </div>
              <div className="w-full shrink-0 lg:w-64">
                <QuestionNavigator
                  questions={questionList}
                  answers={answers}
                activeIndex={currentQuestionIndex}
                onJump={handleJumpToQuestion}
                />
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {result && !session && (
        <section className="rounded-3xl border border-brand-200 bg-brand-50 p-6 text-brand-800">
          <p className="text-sm font-semibold uppercase tracking-[0.3em]">Hasil Terakhir</p>
          <p className="mt-2 text-3xl font-bold">{Math.round(result.score)}%</p>
          <p className="text-sm">{result.correct}/{result.total} soal benar</p>
          {result.resultId && (
            <Button
              type="button"
                  variant="outline"
              className="mt-4"
              onClick={() => navigate(`/app/ujian/tryout/review/${result.resultId}`)}
            >
              Lihat Pembahasan
            </Button>
          )}
        </section>
      )}

      <ExamCountdownModal
        open={countdownOpen}
        resetKey={countdownToken}
        title="Mulai Tryout"
        subtitle="Setelah hitung mundur selesai, tryout dimulai dalam mode layar penuh."
        warning="Ujian Akan Di Blokir Saat Anda Meninggalkan Halaman Ujian - Harap Tetap berada di Halaman Ujian Ini dan Kerjakan seluruh soal sampai selesai"
        onComplete={handleCountdownComplete}
        onCancel={handleCountdownCancel}
      />
      {fullscreenGateOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
            <p className="text-xs uppercase tracking-[0.4em] text-brand-500">Persiapan Tryout</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Aktifkan Layar Penuh</h2>
            <p className="mt-2 text-sm text-slate-500">Klik tombol di bawah untuk masuk fullscreen lalu mulai tryout.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  const fallback = returnToRef.current ?? '/app/ujian/tryout';
                  setFullscreenGateOpen(false);
                  setPendingTryout(null);
                  navigate(fallback);
                }}
              >
                Batal
              </Button>
              <Button onClick={handleFullscreenGate} disabled={startMutation.isPending}>
                {startMutation.isPending ? 'Menyiapkan...' : 'Aktifkan & Mulai'}
              </Button>
            </div>
          </div>
        </div>
      )}
      <ConfirmFinishModal
        open={finishConfirmOpen}
        title="Akhiri tryout sekarang?"
        description="Soal yang belum dijawab akan dianggap salah. Pastikan kamu yakin sebelum menyelesaikan sesi ini."
        confirmText="Ya, akhiri sekarang"
        cancelText="Lanjutkan tryout"
        loading={submitMutation.isPending}
        onConfirm={handleConfirmFinish}
        onCancel={handleCancelFinish}
      />
    </div>
  );
}
