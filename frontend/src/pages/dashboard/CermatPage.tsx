import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMembershipStatus } from '@/hooks/useMembershipStatus';
import { MembershipRequired } from '@/components/dashboard/MembershipRequired';
import { Skeleton } from '@/components/ui/skeleton';
import { useFullscreenExam } from '@/hooks/useFullscreenExam';
import { useExamBlocks } from '@/hooks/useExamBlocks';
import { useExamBlockConfig } from '@/hooks/useExamBlockConfig';
import { ExamCountdownModal } from '@/components/dashboard/ExamCountdownModal';
import { CermatExamOverlay } from '@/components/dashboard/CermatExamOverlay';
import { CERMAT_MODE_ACCENT, CermatModePreview } from '@/components/dashboard/CermatModePreview';
import { PageHeader } from '@/components/common/PageHeader';
import {
  CERMAT_MODE_LABELS,
  DEFAULT_CERMAT_CONFIG,
  formatCermatConfigSummary,
  type CermatConfig,
  type CermatMode,
} from '@/types/cermat';

type CermatSession = {
  attemptId: string;
  sessionId: string;
  timerSeconds: number;
  baseSet: string[];
  mode: CermatMode;
  questions: Array<{ order: number; sequence: string[] }>;
  sessionIndex: number;
  totalSessions: number;
  breakSeconds: number;
  questionCount: number;
};

const MODE_LABELS: Record<CermatMode, { reference: string; prompt: string; button: string }> = {
  NUMBER: {
    reference: 'Angka Referensi',
    prompt: 'Pilih angka referensi yang tidak muncul pada deret di atas.',
    button: 'Mulai Tes Angka',
  },
  LETTER: {
    reference: 'Huruf Referensi',
    prompt: 'Pilih huruf referensi yang tidak muncul pada deret di atas.',
    button: 'Mulai Tes Huruf',
  },
  IMAGE: {
    reference: 'Gambar Referensi',
    prompt: 'Pilih huruf gambar referensi yang tidak muncul pada deret di atas.',
    button: 'Mulai Tes Gambar',
  },
};

function getTestVariants(config: CermatConfig): Array<{ mode: CermatMode; title: string; description: string }> {
  const { totalSessions, questionCount, durationSeconds, breakSeconds } = config;
  const sessionInfo = `${totalSessions} sesi, masing-masing ${questionCount} soal selama ${durationSeconds} detik, dengan jeda ${breakSeconds} detik antar sesi`;

  return [
    {
      mode: 'IMAGE',
      title: 'Tes Kecermatan Gambar Hilang',
      description:
        `5 gambar referensi ditampilkan dengan label A-E. Tiap soal menampilkan 4 gambar — tentukan huruf gambar yang hilang. Total ${sessionInfo}.`,
    },
    {
      mode: 'LETTER',
      title: 'Tes Kecermatan Huruf Hilang',
      description:
        `Dengan 5 huruf referensi yang diacak dari A-Z, kamu harus menentukan huruf mana yang tidak tampil. Total ${sessionInfo}.`,
    },
    {
      mode: 'NUMBER',
      title: 'Tes Kecermatan Angka Hilang',
      description:
        `Sistem membangkitkan 5 angka acak sebagai referensi. Kerjakan ${sessionInfo}.`,
    },
  ];
}

export function CermatPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const membership = useMembershipStatus();
  const { data: blocks, refetch: refetchBlocks } = useExamBlocks(Boolean(membership.data?.isActive));
  const { data: blockConfig } = useExamBlockConfig(Boolean(membership.data?.isActive));
  const cermatBlock = blocks?.find((block) => block.type === 'CERMAT');
  const cermatBlockEnabled = blockConfig?.cermatEnabled ?? true;
  const [unlockCode, setUnlockCode] = useState('');
  const { data: cermatConfig = DEFAULT_CERMAT_CONFIG } = useQuery({
    queryKey: ['cermat-config'],
    queryFn: () => apiGet<CermatConfig>('/exams/cermat/config'),
    enabled: membership.data?.isActive === true && membership.data?.allowCermat !== false,
  });
  const testVariants = useMemo(() => getTestVariants(cermatConfig), [cermatConfig]);
  const configSummary = useMemo(() => formatCermatConfigSummary(cermatConfig), [cermatConfig]);
  const [session, setSession] = useState<CermatSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [breakLeft, setBreakLeft] = useState(0);
  const [isBreaking, setIsBreaking] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string | null>>({});
  const [result, setResult] = useState<
    {
      attemptId?: string;
      mode?: CermatMode;
      averageScore: number;
      totalCorrect: number;
      totalQuestions: number;
      sessions: Array<{ sessionIndex: number; score: number; correct: number; total: number }>;
    } | null
  >(null);
  const [resultCountdown, setResultCountdown] = useState(0);
  const [pendingResultAttemptId, setPendingResultAttemptId] = useState<string | null>(null);
  const [pendingMode, setPendingMode] = useState<CermatMode | null>(null);
  const [pendingNext, setPendingNext] = useState<CermatSession | null>(null);
  const [pendingSession, setPendingSession] = useState<CermatSession | null>(null);
  const [countdownOpen, setCountdownOpen] = useState(false);
  const [countdownToken, setCountdownToken] = useState(0);
  const autoSubmitRef = useRef<string>('');
  const autoStartOnceRef = useRef(false);
  const answersRef = useRef<Record<number, string | null>>({});
  const timerRef = useRef<number | null>(null);
  const endTimeRef = useRef<number | null>(null);

  const { request: requestFullscreen, exit: exitFullscreen, setViolationHandler, isSupported: fullscreenSupported } = useFullscreenExam({
    active: Boolean(session) && cermatBlockEnabled,
  });

  const violationMutation = useMutation({
    mutationFn: (reason: string) => apiPost('/exams/blocks', { type: 'CERMAT', reason }),
    onSuccess: () => refetchBlocks(),
  });

  const unlockMutation = useMutation({
    mutationFn: (code: string) => apiPost('/exams/blocks/unlock', { type: 'CERMAT', code }),
    onSuccess: () => {
      toast.success('Blokir kecermatan terbuka kembali');
      setUnlockCode('');
      refetchBlocks();
    },
    onError: () => toast.error('Kode buka blokir tidak valid'),
  });

  const currentQuestion = useMemo(() => session?.questions[currentIndex], [session, currentIndex]);
  const forcedMode = useMemo(() => {
    const mode = new URLSearchParams(location.search).get('mode');
    if (mode === 'LETTER' || mode === 'NUMBER' || mode === 'IMAGE') return mode as CermatMode;
    return null;
  }, [location.search]);
  const autoStartRequested = useMemo(() => new URLSearchParams(location.search).get('autoStart') === '1', [location.search]);

  useEffect(() => {
    autoStartOnceRef.current = false;
  }, [forcedMode, autoStartRequested]);

  const submitMutation = useMutation({
    mutationFn: ({ sessionId, answerMap }: { sessionId: string; answerMap: Record<number, string | null> }) => {
      const payload = Object.entries(answerMap).map(([order, value]) => ({
        order: Number(order),
        value: typeof value === 'string' ? value : null,
      }));
      return apiPost<{
        completed: boolean;
        sessionSummary?: { sessionIndex: number; score: number; correct: number; total: number };
        nextSession?: CermatSession;
        summary?: {
          attemptId: string;
          mode?: CermatMode;
          averageScore: number;
          totalCorrect: number;
          totalQuestions: number;
          sessions: Array<{ sessionIndex: number; score: number; correct: number; total: number }>;
        };
      }>(
        `/exams/cermat/session/${sessionId}/submit`,
        { answers: payload },
      );
    },
    onSuccess: (payload) => {
      if (payload.completed && payload.summary) {
        setResult(payload.summary);
        setSession(null);
        setCurrentIndex(0);
        setTimeLeft(60);
        setBreakLeft(0);
        setIsBreaking(false);
        setPendingNext(null);
        endTimeRef.current = null;
        exitFullscreen();
        setPendingResultAttemptId(payload.summary.attemptId);
        setResultCountdown(5);
        toast.success(`Tes selesai. Rata-rata ${payload.summary.averageScore}%`);
        return;
      }
      if (payload.nextSession) {
        setCurrentIndex(0);
        setTimeLeft(0);
        setAnswers({});
        setPendingNext(payload.nextSession);
        setBreakLeft(payload.nextSession.breakSeconds ?? 5);
        setIsBreaking(true);
        endTimeRef.current = null;
      }
    },
    onError: () => toast.error('Gagal mengirim jawaban'),
  });

  const startMutation = useMutation({
    mutationFn: (mode: CermatMode) => apiPost<CermatSession>('/exams/cermat/session', { mode }),
    onMutate: (mode) => {
      setPendingMode(mode);
    },
    onSuccess: (payload) => {
      setPendingSession(payload);
      setCountdownToken((prev) => prev + 1);
      setCountdownOpen(true);
    },
    onError: () => {
      toast.error('Gagal memulai sesi');
      exitFullscreen();
    },
    onSettled: () => setPendingMode(null),
  });

  const handleAdvance = useCallback(
    (value?: string | null) => {
      if (!session || !currentQuestion || submitMutation.isPending) return;
      const nextAnswers = { ...answers, [currentQuestion.order]: typeof value === 'string' ? value : null };
      answersRef.current = nextAnswers;
      setAnswers(nextAnswers);
      const isLast = currentIndex + 1 >= session.questions.length;
      if (isLast) {
        submitMutation.mutate({ sessionId: session.sessionId, answerMap: nextAnswers });
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
    },
    [answers, currentQuestion, currentIndex, session, submitMutation],
  );

  useEffect(() => {
    autoSubmitRef.current = '';
  }, [session?.sessionId]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (resultCountdown <= 0 || !pendingResultAttemptId) return undefined;
    const timer = window.setTimeout(() => {
      if (resultCountdown <= 1) {
        const attemptId = pendingResultAttemptId;
        setResultCountdown(0);
        setPendingResultAttemptId(null);
        setResult(null);
        navigate(attemptId ? `/app/tes-kecermatan/riwayat/${attemptId}` : '/app/tes-kecermatan/riwayat');
        return;
      }
      setResultCountdown((prev) => prev - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [navigate, pendingResultAttemptId, resultCountdown]);

  useEffect(() => {
    if (!session && !countdownOpen && resultCountdown <= 0) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [session, countdownOpen, resultCountdown]);

  useEffect(() => {
    if (!session || isBreaking) {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return undefined;
    }
    if (timerRef.current !== null) {
      return undefined;
    }
    timerRef.current = window.setInterval(() => {
      if (!endTimeRef.current) return;
      const next = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      setTimeLeft(next);
    }, 250);
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [session, isBreaking]);

  useEffect(() => {
    if (!session || isBreaking) return;
    if (timeLeft > 0) return;
    if (!submitMutation.isPending && autoSubmitRef.current !== session.sessionId) {
      autoSubmitRef.current = session.sessionId;
      submitMutation.mutate({ sessionId: session.sessionId, answerMap: answersRef.current });
    }
  }, [isBreaking, session, submitMutation, timeLeft]);

  useEffect(() => {
    if (!pendingNext || breakLeft <= 0 || !isBreaking) return;
    const timer = window.setInterval(() => {
      setBreakLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pendingNext, breakLeft, isBreaking]);

  useEffect(() => {
    if (!(pendingNext && breakLeft === 0 && isBreaking)) return;
    const timer = window.setTimeout(() => {
      setSession(pendingNext);
      setPendingNext(null);
      setAnswers({});
      setCurrentIndex(0);
      endTimeRef.current = Date.now() + (pendingNext.timerSeconds ?? 60) * 1000;
      setTimeLeft(pendingNext.timerSeconds ?? 60);
      setIsBreaking(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [breakLeft, pendingNext, isBreaking]);

  const handleForceStop = useCallback(
    (reason?: string) => {
      if (reason) {
        toast.error(`Tes dihentikan: ${reason}`);
      }
      setSession(null);
      setCurrentIndex(0);
      setTimeLeft(60);
      setBreakLeft(0);
      setAnswers({});
      setResult(null);
      setIsBreaking(false);
      setPendingNext(null);
      setPendingSession(null);
      setResultCountdown(0);
      setPendingResultAttemptId(null);
      endTimeRef.current = null;
      exitFullscreen();
      if (cermatBlockEnabled && reason) {
        violationMutation.mutate(reason);
      }
    },
    [cermatBlockEnabled, exitFullscreen, violationMutation],
  );

  useEffect(() => {
    if (!cermatBlockEnabled) {
      setViolationHandler(null);
      return undefined;
    }
    setViolationHandler((reason) => handleForceStop(reason));
    return () => setViolationHandler(null);
  }, [cermatBlockEnabled, handleForceStop, setViolationHandler]);

  useEffect(() => {
    if (!forcedMode || !autoStartRequested) return;
    if (autoStartOnceRef.current) return;
    if (!membership.data?.isActive || membership.data?.allowCermat === false) return;
    if (cermatBlock) return;
    if (session || pendingSession || countdownOpen || startMutation.isPending) return;
    autoStartOnceRef.current = true;

    const startForcedMode = async () => {
      if (fullscreenSupported) {
        try {
          await requestFullscreen();
        } catch {
          toast.error('Izinkan mode layar penuh untuk mulai tes.');
          return;
        }
      }
      startMutation.mutate(forcedMode);
    };

    void startForcedMode();
  }, [
    autoStartRequested,
    cermatBlock,
    countdownOpen,
    forcedMode,
    fullscreenSupported,
    membership.data?.allowCermat,
    membership.data?.isActive,
    pendingSession,
    requestFullscreen,
    session,
    startMutation,
  ]);

  if (membership.isLoading) {
    return <Skeleton className="h-72" />;
  }

  if (!membership.data?.isActive) {
    return <MembershipRequired status={membership.data} />;
  }

  if (membership.data?.allowCermat === false) {
    return (
      <section className="rounded-3xl border border-brand-200 bg-brand-50 p-6 text-sm text-brand-800">
        Paket membership kamu tidak mencakup akses tes kecermatan. Hubungi admin untuk upgrade paket.
      </section>
    );
  }

  if (cermatBlock) {
    return (
      <section className="space-y-4">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-semibold text-red-800">Akses tes kecermatan kamu sedang diblokir.</p>
          <p className="mt-2 text-xs text-red-600">
            Sistem mendeteksi kamu meninggalkan halaman pengerjaan. Hubungi admin melalui WhatsApp untuk mendapatkan kode
            buka blokir, lalu masukkan di bawah ini.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Input
              placeholder="Kode 6 digit"
              value={unlockCode}
              onChange={(event) => setUnlockCode(event.target.value)}
              className="max-w-xs"
            />
            <Button
              onClick={() => unlockMutation.mutate(unlockCode)}
              disabled={unlockMutation.isPending || unlockCode.length < 6}
            >
              {unlockMutation.isPending ? 'Membuka...' : 'Buka Blokir'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Terakhir pelanggaran: {new Date(cermatBlock.blockedAt).toLocaleString('id-ID')}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="page-shell">
      <PageHeader
        eyebrow="Tes Kecermatan"
        title="Latihan Fokus dan Ketelitian"
        description="Pilih varian tes dan lihat riwayat per sesi setelah selesai."
        action={
          <Button variant="outline" onClick={() => navigate('/app/tes-kecermatan/riwayat')}>
            Lihat Riwayat
          </Button>
        }
      />
      {(forcedMode ? testVariants.filter((item) => item.mode === forcedMode) : testVariants).map((variant) => {
        const isLoading = startMutation.isPending && pendingMode === variant.mode;
        const accent = CERMAT_MODE_ACCENT[variant.mode];
        return (
          <div
            key={variant.mode}
            className="surface-card overflow-hidden transition hover:shadow-md"
          >
            <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:gap-8 lg:p-8">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-white ${accent.badge}`}
                  >
                    {CERMAT_MODE_LABELS[variant.mode]}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{configSummary}</span>
                </div>
                <h2 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">{variant.title}</h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">{variant.description}</p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button
                    onClick={() => {
                      if (fullscreenSupported) {
                        requestFullscreen()
                          .then(() => {
                            startMutation.mutate(variant.mode);
                          })
                          .catch(() => {
                            toast.error('Izinkan mode layar penuh untuk mulai tes.');
                          });
                        return;
                      }
                      startMutation.mutate(variant.mode);
                    }}
                    disabled={startMutation.isPending}
                    isLoading={isLoading}
                  >
                    {MODE_LABELS[variant.mode].button}
                  </Button>
                </div>
              </div>

              <CermatModePreview mode={variant.mode} className="w-full shrink-0 lg:w-[280px] xl:w-[300px]" />
            </div>
          </div>
        );
      })}

      {session && currentQuestion && !isBreaking && (
        <CermatExamOverlay
          mode={session.mode}
          sessionIndex={session.sessionIndex}
          totalSessions={session.totalSessions}
          currentIndex={currentIndex}
          totalQuestions={session.questions.length}
          timeLeft={timeLeft}
          baseSet={session.baseSet}
          sequence={currentQuestion.sequence}
          questionOrder={currentQuestion.order}
          answers={answers}
          submitPending={submitMutation.isPending}
          modeLabels={MODE_LABELS}
          onAnswer={handleAdvance}
        />
      )}

      {resultCountdown > 0 && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen items-center justify-center bg-slate-950 px-4">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(37,99,235,0.22),_transparent_55%)]"
            />
            <div className="relative w-full max-w-lg rounded-[2rem] border border-white/10 bg-white px-8 py-10 text-center shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-brand-500">Tes Selesai</p>
              <h2 className="mt-3 text-3xl font-bold text-slate-900">Melihat hasil</h2>
              <p className="mt-2 text-base text-slate-600">
                Rata-rata {result?.averageScore ?? 0}% — {result?.totalCorrect ?? 0}/{result?.totalQuestions ?? 0} benar
              </p>
              <div className="mx-auto mt-8 flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br from-brand-50 to-brand-100 text-7xl font-bold text-brand-700 ring-8 ring-brand-100/80">
                {resultCountdown}
              </div>
              <p className="mt-4 text-sm font-medium text-slate-500">
                Mengalihkan ke halaman rincian hasil dalam {resultCountdown} detik
              </p>
              <div className="mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    const attemptId = pendingResultAttemptId;
                    setResultCountdown(0);
                    setPendingResultAttemptId(null);
                    setResult(null);
                    navigate(attemptId ? `/app/tes-kecermatan/riwayat/${attemptId}` : '/app/tes-kecermatan/riwayat');
                  }}
                >
                  Lihat Hasil Sekarang
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {pendingNext && breakLeft > 0 && isBreaking && typeof document !== 'undefined' &&
        createPortal(
        <div className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen items-center justify-center bg-slate-950 px-4">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(37,99,235,0.18),_transparent_55%)]"
          />
          <div className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-white px-8 py-10 text-center shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-brand-500">Jeda Antar Sesi</p>
            <div className="mx-auto mt-6 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-brand-50 to-brand-100 text-5xl font-bold text-brand-700 ring-8 ring-brand-100/80">
              {breakLeft}
            </div>
            <p className="mt-4 text-base text-slate-600">Bersiap untuk sesi berikutnya.</p>
          </div>
        </div>,
        document.body,
      )}
      <ExamCountdownModal
        open={countdownOpen}
        resetKey={countdownToken}
        variant="focus"
        title="Mulai Tes Kecermatan"
        subtitle="Fokus dan pastikan koneksi stabil."
        warning="Tes akan dihentikan jika Anda berpindah tab atau meninggalkan halaman."
        onComplete={() => {
          if (!pendingSession) {
            setCountdownOpen(false);
            return;
          }
          setSession(pendingSession);
          setAnswers({});
          setResult(null);
          setResultCountdown(0);
          setPendingResultAttemptId(null);
          setCurrentIndex(0);
          endTimeRef.current = Date.now() + (pendingSession.timerSeconds ?? 60) * 1000;
          setTimeLeft(pendingSession.timerSeconds ?? 60);
          setBreakLeft(0);
          setIsBreaking(false);
          setCountdownOpen(false);
          setPendingSession(null);
          toast.success('Tes kecermatan dimulai. Fokus pada setiap soal!');
        }}
        onCancel={() => {
          setCountdownOpen(false);
          setPendingSession(null);
          exitFullscreen();
        }}
      />

    </section>
  );
}
