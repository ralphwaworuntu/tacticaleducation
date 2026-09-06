import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useMembershipStatus } from '@/hooks/useMembershipStatus';
import { isDocumentFullscreen, useFullscreenExam } from '@/hooks/useFullscreenExam';
import { useExamBlocks } from '@/hooks/useExamBlocks';
import { useExamBlockConfig } from '@/hooks/useExamBlockConfig';
import { ExamCountdownModal } from '@/components/dashboard/ExamCountdownModal';
import { ExamFullscreenGateModal } from '@/components/dashboard/ExamFullscreenGateModal';
import { ConfirmFinishModal } from '@/components/dashboard/ConfirmFinishModal';
import { ExamTakingOverlay, ExamQuestionPanel } from '@/components/dashboard/ExamTakingOverlay';
import { PageHeader } from '@/components/common/PageHeader';
import { buildTryoutDisplayItems, getPsikoSequenceBySubCategory, isPolriPsikoTryout } from '@/utils/tryoutPackage';
import { ExamQuestionOptions } from '@/components/dashboard/ExamQuestionOptions';
import { setSingleAnswer, toggleMultiAnswer } from '@/lib/examAnswers';

type TryoutSession = {
  detail: TryoutDetail;
  resultId: string;
  durationMinutes: number;
};

type StartTryoutResponse = {
  resultId: string;
  durationMinutes: number;
  startedSlug?: string;
  sessionOrder?: number | null;
};

type SubmitTryoutResponse = {
  resultId: string;
  score: number;
  correct: number;
  total: number;
  nextCermatMode?: 'NUMBER' | 'LETTER' | 'IMAGE';
  nextSession?: {
    slug: string;
    name: string;
    sessionOrder: number | null;
    breakSeconds: number;
  };
};

type ApiErrorResponse = {
  message?: string;
  details?: { code?: string };
};

export function TryoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const membership = useMembershipStatus();
  const hasActiveMembership = Boolean(membership.data?.isActive);
  const { data: tryouts, isLoading } = useQuery({
    queryKey: ['tryouts'],
    queryFn: () => apiGet<Tryout[]>('/exams/tryouts'),
  });
  const { data: blocks, refetch: refetchBlocks } = useExamBlocks(Boolean(membership.data?.isActive));
  const { data: blockConfig } = useExamBlockConfig(Boolean(membership.data?.isActive));
  const [session, setSession] = useState<TryoutSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
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
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isPsikoBreaking, setIsPsikoBreaking] = useState(false);
  const [psikoBreakLeft, setPsikoBreakLeft] = useState(0);
  const [pendingPsikoTryout, setPendingPsikoTryout] = useState<Tryout | null>(null);
  const [isPreparingNextPsikoSession, setIsPreparingNextPsikoSession] = useState(false);
  const tryoutBlock = blocks?.find((block) => block.type === 'TRYOUT');
  const tryoutBlockEnabled = blockConfig?.tryoutEnabled ?? true;
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeSubCategoryId, setActiveSubCategoryId] = useState<string | null>(null);
  const autoStartRef = useRef(false);
  const countdownStartRef = useRef(false);
  const skipCountdownRef = useRef(false);
  const endTimeRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const autoSubmitRef = useRef(false);
  const isStartingFromPsikoBreakRef = useRef(false);
  const psikoAutoStartLockedRef = useRef(false);

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

  const resolveInitialPsikoTryout = useCallback(
    (item: Tryout) => {
      if (!isPolriPsikoTryout(item)) {
        return item;
      }
      const sequence = getPsikoSequenceBySubCategory(tryouts ?? [], item.subCategory.id);
      return sequence[0] ?? item;
    },
    [tryouts],
  );

  const resolvedCategoryId = activeCategoryId ?? categoryGroups[0]?.id ?? null;

  const selectedCategory = useMemo(() => {
    if (!categoryGroups.length || !resolvedCategoryId) return null;
    return categoryGroups.find((category) => category.id === resolvedCategoryId) ?? null;
  }, [categoryGroups, resolvedCategoryId]);

  const resolvedSubCategoryId = activeSubCategoryId ?? selectedCategory?.subCategories[0]?.id ?? null;
  const selectedSubCategory =
    selectedCategory?.subCategories.find((subCategory) => subCategory.id === resolvedSubCategoryId) ?? null;
  const selectedDisplayItems = useMemo(
    () => (selectedSubCategory ? buildTryoutDisplayItems(selectedSubCategory.tryouts) : []),
    [selectedSubCategory],
  );

  const { request: requestFullscreen, exit: exitFullscreen, setViolationHandler, isSupported: fullscreenSupported } =
    useFullscreenExam({
    active: Boolean(session) && tryoutBlockEnabled,
  });

  const violationMutation = useMutation({
    mutationFn: (reason: string) => apiPost('/exams/blocks', { type: 'TRYOUT', reason }),
    onSuccess: () => refetchBlocks(),
  });

  const unlockMutation = useMutation({
    mutationFn: (code: string) => apiPost('/exams/blocks/unlock', { type: 'TRYOUT', code }),
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
        endTimeRef.current = null;
        setTimeLeft(null);
        autoSubmitRef.current = false;
        setIsPsikoBreaking(false);
        setPsikoBreakLeft(0);
        setPendingPsikoTryout(null);
        setIsPreparingNextPsikoSession(false);
        psikoAutoStartLockedRef.current = false;
        isStartingFromPsikoBreakRef.current = false;
        return null;
      });
    },
    [],
  );

  useEffect(() => {
    if (!tryoutBlockEnabled) {
      setViolationHandler(null);
      return undefined;
    }
    setViolationHandler((reason) => {
      violationMutation.mutate(reason ?? 'Pelanggaran fullscreen');
      handleSessionReset(reason);
      exitFullscreen();
    });
    return () => setViolationHandler(null);
  }, [exitFullscreen, handleSessionReset, setViolationHandler, tryoutBlockEnabled, violationMutation]);


  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const startMutation = useMutation({
    mutationFn: async (tryout: Tryout) => {
      const start = await apiPost<StartTryoutResponse>(`/exams/tryouts/${tryout.slug}/start`);
      const startedSlug = start.startedSlug ?? tryout.slug;
      const detail = await apiGet<TryoutDetail>(`/exams/tryouts/${startedSlug}`);
      return {
        detail,
        resultId: start.resultId,
        durationMinutes: start.durationMinutes,
        requestedSlug: tryout.slug,
      };
    },
    onSuccess: (payload) => {
      setSession({
        detail: payload.detail,
        resultId: payload.resultId,
        durationMinutes: payload.durationMinutes,
      });
      setAnswers({});
      setResult(null);
      setCurrentQuestionIndex(0);
      autoSubmitRef.current = false;
      setIsPsikoBreaking(false);
      setPsikoBreakLeft(0);
      setPendingPsikoTryout(null);
      setIsPreparingNextPsikoSession(false);
      psikoAutoStartLockedRef.current = false;
      if (payload.requestedSlug !== payload.detail.slug) {
        toast.info('PSIKO dimulai dari sesi urutan paling awal yang tersedia.');
      }
      if (payload.durationMinutes > 0) {
        endTimeRef.current = Date.now() + payload.durationMinutes * 60 * 1000;
        setTimeLeft(Math.ceil(payload.durationMinutes * 60));
      } else {
        endTimeRef.current = null;
        setTimeLeft(null);
      }
      if (isStartingFromPsikoBreakRef.current) {
        // Auto transition antar sesi PSIKO: tidak tampilkan toast agar pengalaman tetap mulus.
      } else {
        toast.success('Tryout dimulai, selamat mengerjakan!');
      }
      isStartingFromPsikoBreakRef.current = false;
    },
    onError: (error) => {
      isStartingFromPsikoBreakRef.current = false;
      setIsPreparingNextPsikoSession(false);
      psikoAutoStartLockedRef.current = false;
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
      const payload = detail.questions.map((question) => {
        const optionIds = answers[question.id] ?? [];
        return {
          questionId: question.id,
          ...(optionIds.length
            ? { optionIds, optionId: optionIds.length === 1 ? optionIds[0] : undefined }
            : {}),
        };
      });
      return apiPost<SubmitTryoutResponse>(`/exams/tryouts/${detail.slug}/submit`, {
        resultId,
        answers: payload,
      });
    },
    onSuccess: (payload) => {
      if (payload.nextSession) {
        const nextTryout = tryouts?.find((item) => item.slug === payload.nextSession?.slug) ?? null;
        if (nextTryout) {
          setResult(null);
          setSession(null);
          setAnswers({});
          setCurrentQuestionIndex(0);
          endTimeRef.current = null;
          setTimeLeft(null);
          setPendingPsikoTryout(nextTryout);
          setPsikoBreakLeft(Math.max(0, payload.nextSession.breakSeconds ?? 0));
          setIsPsikoBreaking(true);
          return;
        }
      }
      if (payload.nextCermatMode) {
        setSession(null);
        setCurrentQuestionIndex(0);
        exitFullscreen();
        endTimeRef.current = null;
        setTimeLeft(null);
        queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
        queryClient.invalidateQueries({ queryKey: ['tryout-history'] });
        toast.success('Paket PSIKO selesai. Lanjut ke tes kecermatan.');
        navigate(`/app/tes-kecermatan?mode=${payload.nextCermatMode}&autoStart=1`, {
          state: { fromPsiko: true, cermatMode: payload.nextCermatMode },
        });
        return;
      }
      setResult(payload);
      setSession(null);
      setCurrentQuestionIndex(0);
      toast.success(`Tryout selesai. Skor kamu ${Math.round(payload.score)}`);
      exitFullscreen();
      endTimeRef.current = null;
      setTimeLeft(null);
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['tryout-history'] });
      if (payload.resultId) {
        navigate(`/app/latihan/tryout/review/${payload.resultId}`, { replace: true });
      }
    },
    onError: () => toast.error('Gagal mengirim jawaban'),
  });

  useEffect(() => {
    if (!session || !endTimeRef.current) {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return undefined;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endTimeRef.current! - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0 && !autoSubmitRef.current) {
        autoSubmitRef.current = true;
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        toast.error('Waktu tryout habis. Jawaban otomatis dikumpulkan.');
        submitMutation.mutate();
      }
    };

    tick();
    timerRef.current = window.setInterval(tick, 1000);
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [session, submitMutation]);

  useEffect(() => {
    if (!isPsikoBreaking || !pendingPsikoTryout || psikoBreakLeft <= 0) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setPsikoBreakLeft((previous) => (previous <= 1 ? 0 : previous - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isPsikoBreaking, pendingPsikoTryout, psikoBreakLeft]);

  useEffect(() => {
    if (!isPsikoBreaking || !pendingPsikoTryout || psikoBreakLeft > 0) {
      return;
    }
    if (psikoAutoStartLockedRef.current) {
      return;
    }
    psikoAutoStartLockedRef.current = true;
    const nextTryout = pendingPsikoTryout;
    if (!nextTryout) {
      psikoAutoStartLockedRef.current = false;
      return;
    }
    setIsPsikoBreaking(false);
    setPsikoBreakLeft(0);
    setPendingPsikoTryout(null);
    setIsPreparingNextPsikoSession(true);
    const beginNextSession = async () => {
      if (fullscreenSupported && !isDocumentFullscreen()) {
        try {
          await requestFullscreen();
        } catch {
          toast.error('Gagal masuk fullscreen untuk sesi PSIKO berikutnya.');
          setIsPreparingNextPsikoSession(false);
          psikoAutoStartLockedRef.current = false;
          navigate(returnToRef.current ?? '/app/latihan/tryout');
          return;
        }
      }
      isStartingFromPsikoBreakRef.current = true;
      startMutation.mutate(nextTryout, {
        onSettled: () => {
          setIsPreparingNextPsikoSession(false);
          psikoAutoStartLockedRef.current = false;
        },
      });
    };
    void beginNextSession();
  }, [fullscreenSupported, isPsikoBreaking, navigate, pendingPsikoTryout, psikoBreakLeft, requestFullscreen, startMutation]);

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

  const formatTimeLeft = (value: number | null) => {
    if (value === null) return 'Tanpa batas';
    const minutes = Math.floor(value / 60);
    const seconds = value % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleCancelFinish = useCallback(() => setFinishConfirmOpen(false), []);

  const questionList = useMemo(() => session?.detail.questions ?? [], [session]);
  const currentQuestion = questionList[currentQuestionIndex];
  const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString('id-ID') : null);
  const getScheduleText = (tryout: { openAt?: string | null; closeAt?: string | null }) => {
    const start = formatDateTime(tryout.openAt);
    const end = formatDateTime(tryout.closeAt);
    if (!start && !end) {
      return 'Tersedia sepanjang waktu';
    }
    return `${start ?? 'Segera'} - ${end ?? 'Tanpa batas'}`;
  };
  const getScheduleStatus = (tryout: { openAt?: string | null; closeAt?: string | null }) => {
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
    const fallback = returnToRef.current ?? '/app/latihan/tryout';
    navigate(fallback);
  }, [exitFullscreen, handleSessionReset, navigate]);

  const handleCountdownRequest = useCallback(
    async (item: Tryout, _skipCountdown = false) => {
      const targetTryout = resolveInitialPsikoTryout(item);
      if (!hasActiveMembership && !targetTryout.isFree) {
        toast.error('Aktifkan paket untuk mulai tryout.');
        return;
      }
      if (tryoutBlock) {
        toast.error('Akses tryout diblokir, masukkan kode buka blokir dari admin.');
        return;
      }
      countdownStartRef.current = false;
      setPendingTryout(targetTryout);
      skipCountdownRef.current = false;
      // Urutan: layar penuh → hitung mundur → mulai soal
      if (fullscreenSupported) {
        setFullscreenGateOpen(true);
        return;
      }
      setCountdownToken((prev) => prev + 1);
      setCountdownOpen(true);
    },
    [fullscreenSupported, hasActiveMembership, resolveInitialPsikoTryout, tryoutBlock],
  );

  useEffect(() => {
    const state = location.state as { startTryoutSlug?: string; returnTo?: string; skipCountdown?: boolean } | null;
    const startFromStorage = sessionStorage.getItem('tryout_start_slug');
    const skipCountdown = state?.skipCountdown === true || new URLSearchParams(location.search).get('skipCountdown') === '1';
    const startSlug = state?.startTryoutSlug ?? startFromStorage ?? null;
    if (!startSlug || autoStartRef.current || !tryouts?.length) return;
    const target = tryouts.find((item) => item.slug === startSlug);
    returnToRef.current =
      state?.returnTo ??
      (target
        ? `/app/latihan/tryout/kategori/${target.subCategory.category.id}/sub/${target.subCategory.id}`
        : '/app/latihan/tryout');
    autoStartRef.current = true;
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    if (startFromStorage) {
      sessionStorage.removeItem('tryout_start_slug');
    }
    if (skipCountdown) {
      const search = new URLSearchParams(location.search);
      search.delete('skipCountdown');
      const next = search.toString();
      window.history.replaceState(null, '', next ? `${location.pathname}?${next}` : location.pathname);
    }
    if (!target) {
      toast.error('Tryout tidak ditemukan.');
      return;
    }
    window.setTimeout(() => handleCountdownRequest(target, skipCountdown), 0);
  }, [handleCountdownRequest, location.pathname, location.search, location.state, navigate, tryouts]);

  const handleCountdownCancel = useCallback(() => {
    countdownStartRef.current = false;
    setCountdownOpen(false);
    setPendingTryout(null);
    exitFullscreen();
    const fallback = returnToRef.current ?? '/app/latihan/tryout';
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
    if (fullscreenSupported && !isDocumentFullscreen()) {
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
        if (!isDocumentFullscreen()) {
          throw new Error('Fullscreen tidak aktif');
        }
      } catch {
        toast.error('Mode layar penuh wajib diizinkan untuk memulai tryout.');
        setPendingTryout(null);
        const fallback = returnToRef.current ?? `/app/latihan/tryout/detail/${pendingTryout.slug}`;
        navigate(fallback);
        return;
      }
    }
    setFullscreenGateOpen(false);
    skipCountdownRef.current = false;
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

  if (membership.isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (hasActiveMembership && membership.data?.allowTryout === false) {
    return (
      <section className="rounded-3xl border border-brand-200 bg-brand-50 p-6 text-sm text-brand-800">
        Paket membership kamu tidak mencakup akses latihan tryout. Hubungi admin untuk upgrade paket.
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
    <section className="page-shell">
      {!hasActiveMembership && (
        <section className="rounded-3xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
          Kamu belum memiliki paket aktif. Kamu tetap bisa melihat daftar tryout, tetapi hanya tryout gratis yang bisa dikerjakan.
        </section>
      )}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Kuota Tryout</p>
          {hasActiveMembership ? (
            <>
              <h3 className="mt-2 text-3xl font-bold text-slate-900">
                {membership.data?.tryoutRemaining === null || membership.data?.tryoutRemaining === undefined
                  ? 'Tidak terbatas'
                  : `${membership.data.tryoutRemaining} kali tersisa`}
              </h3>
              {typeof membership.data?.tryoutQuota === 'number' && (
                <p className="text-sm text-slate-500">
                  Total {membership.data.tryoutQuota} - Terpakai {membership.data.tryoutUsed ?? 0}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Aktifkan paket untuk mendapatkan kuota tryout.</p>
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
        <PageHeader
          eyebrow="Kategori Tryout"
          title="Pilih Latihan Sesuai Fokus"
          description="Tap kategori untuk melihat daftar tryout yang tersedia."
        />
        {categoryGroups.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Belum ada tryout yang tersedia.
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {categoryGroups.map((category) => {
                const isActive = resolvedCategoryId === category.id;
                const totalTryouts = category.subCategories.reduce(
                  (acc, subCategory) => acc + buildTryoutDisplayItems(subCategory.tryouts).length,
                  0,
                );
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
                      ? `${selectedDisplayItems.length} paket tersedia`
                      : 'Belum ada tryout dalam sub kategori ini'}
                  </p>
                </div>
              </div>
              {selectedSubCategory ? (
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {selectedDisplayItems.map((item) => {
                    const status = getScheduleStatus(item);
                    const startTryout = item.sessions[0] ?? null;
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
                            {item.isPackage && (
                              <p className="text-xs text-slate-500">
                                Detail sesi: {item.sessions.map((session) => `S${session.sessionOrder}`).join(', ')}
                              </p>
                            )}
                            <p className="text-[11px] text-slate-500">Jadwal: {getScheduleText(item)}</p>
                            <p className={`text-[11px] ${status.active ? 'text-emerald-600' : 'text-red-500'}`}>Status: {status.label}</p>
                            <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              {item.isPackage && (
                                <span className="rounded-full bg-brand-100 px-2 py-1 text-brand-700">{item.packageLabel}</span>
                              )}
                              {item.isFree && <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">Gratis</span>}
                              {!hasActiveMembership && !item.isFree && (
                                <span className="rounded-full bg-brand-100 px-2 py-1 text-brand-700">Butuh Paket</span>
                              )}
                            </div>
                            <Button
                              className="w-full"
                              variant={session?.detail.slug === (startTryout?.slug ?? item.slug) ? 'outline' : 'primary'}
                              onClick={() => navigate(`/app/latihan/tryout/detail/${startTryout?.slug ?? item.slug}`)}
                            >
                            {item.isPackage ? 'Lihat Paket Soal' : 'Lihat Detail'}
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

      <ExamTakingOverlay
        open={Boolean(session)}
        eyebrow="Tryout Berlangsung"
        title={session?.detail.name ?? 'Tryout'}
        subtitle={session ? `Durasi ${session.durationMinutes} menit · Tetap fokus di layar ini` : undefined}
        timeLeftLabel={session ? formatTimeLeft(timeLeft) : null}
        questions={questionList}
        answers={answers}
        activeIndex={currentQuestionIndex}
        onJump={handleJumpToQuestion}
        onPrev={handlePrevQuestion}
        onNext={handleNextQuestion}
        onFinish={handleForceFinish}
        onCancel={handleManualCancel}
        submitPending={submitMutation.isPending}
        finishLabel="Akhiri Tryout"
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

      {result && !session && (
        <section className="rounded-3xl border border-brand-200 bg-brand-50 p-6 text-brand-800">
          <p className="text-sm font-semibold uppercase tracking-[0.3em]">Hasil Terakhir</p>
          <p className="mt-2 text-3xl font-bold">{Math.round(result.score)}</p>
          <p className="text-sm">{result.correct}/{result.total} soal benar</p>
          {result.resultId && (
            <Button
              type="button"
                  variant="outline"
              className="mt-4"
              onClick={() => navigate(`/app/latihan/tryout/review/${result.resultId}`)}
            >
              Lihat Pembahasan
            </Button>
          )}
        </section>
      )}

      {isPsikoBreaking && pendingPsikoTryout && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/80 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Jeda Sesi PSIKO</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">
              Persiapan Mengikuti {pendingPsikoTryout.name}
            </h3>
            <p className="mt-3 text-4xl font-bold text-brand-600">{psikoBreakLeft}s</p>
            <p className="mt-2 text-sm text-slate-500">Sesi berikutnya akan dimulai otomatis.</p>
          </div>
        </div>
      )}
      {isPreparingNextPsikoSession && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/80 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">PSIKO</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Memuat Sesi Berikutnya</h3>
            <p className="mt-2 text-sm text-slate-500">Mohon tunggu, soal sedang disiapkan.</p>
            <div className="mx-auto mt-4 h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        </div>
      )}

    <ExamCountdownModal
      open={countdownOpen}
      resetKey={countdownToken}
      title="Mulai Tryout"
      subtitle="Setelah hitung mundur selesai, tryout dimulai dalam mode layar penuh."
      warning={
        tryoutBlockEnabled
          ? 'Ujian Akan Di Blokir Saat Anda Meninggalkan Halaman Ujian - Harap Tetap berada di Halaman Ujian Ini dan Kerjakan seluruh soal sampai selesai'
          : null
      }
      onComplete={handleCountdownComplete}
      onCancel={handleCountdownCancel}
    />
      {fullscreenGateOpen && (
        <ExamFullscreenGateModal
          open={fullscreenGateOpen}
          eyebrow="Persiapan Tryout"
          loading={startMutation.isPending}
          onConfirm={handleFullscreenGate}
          onCancel={() => {
            const fallback = returnToRef.current ?? '/app/latihan/tryout';
            setFullscreenGateOpen(false);
            setPendingTryout(null);
            navigate(fallback);
          }}
        />
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
    </section>
  );
}
