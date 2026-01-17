import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useMembershipStatus } from '@/hooks/useMembershipStatus';
import { MembershipRequired } from '@/components/dashboard/MembershipRequired';
import { Skeleton } from '@/components/ui/skeleton';
import { useFullscreenExam } from '@/hooks/useFullscreenExam';
import { ExamCountdownModal } from '@/components/dashboard/ExamCountdownModal';

type CermatMode = 'NUMBER' | 'LETTER';

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
};

const TEST_VARIANTS: Array<{ mode: CermatMode; title: string; description: string }> = [
  {
    mode: 'NUMBER',
    title: 'Tes Kecermatan Angka Hilang',
    description:
      'Sistem membangkitkan 5 angka acak sebagai referensi. Kerjakan 10 sesi, masing-masing 60 soal selama 60 detik.',
  },
  {
    mode: 'LETTER',
    title: 'Tes Kecermatan Huruf Hilang',
    description:
      'Dengan 5 huruf referensi yang diacak dari A-Z, kamu harus menentukan huruf mana yang tidak tampil. Total 10 sesi dengan jeda singkat.',
  },
];

export function CermatPage() {
  const navigate = useNavigate();
  const membership = useMembershipStatus();
  const [session, setSession] = useState<CermatSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [breakLeft, setBreakLeft] = useState(0);
  const [isBreaking, setIsBreaking] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string | null>>({});
  const [result, setResult] = useState<
    { averageScore: number; totalCorrect: number; totalQuestions: number; sessions: Array<{ sessionIndex: number; score: number; correct: number; total: number }> } | null
  >(null);
  const [pendingMode, setPendingMode] = useState<CermatMode | null>(null);
  const [pendingNext, setPendingNext] = useState<CermatSession | null>(null);
  const [pendingSession, setPendingSession] = useState<CermatSession | null>(null);
  const [countdownOpen, setCountdownOpen] = useState(false);
  const [countdownToken, setCountdownToken] = useState(0);
  const autoSubmitRef = useRef<string>('');
  const answersRef = useRef<Record<number, string | null>>({});
  const timerRef = useRef<number | null>(null);

  const { request: requestFullscreen, exit: exitFullscreen, setViolationHandler, isSupported: fullscreenSupported } = useFullscreenExam({
    active: Boolean(session),
  });

  const currentQuestion = useMemo(() => session?.questions[currentIndex], [session, currentIndex]);

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
        toast.success(`Tes selesai. Rata-rata ${payload.summary.averageScore}%`);
        setSession(null);
        setCurrentIndex(0);
        setTimeLeft(60);
        setBreakLeft(0);
        setIsBreaking(false);
        setPendingNext(null);
        exitFullscreen();
        return;
      }
      if (payload.nextSession) {
        setCurrentIndex(0);
        setTimeLeft(0);
        setAnswers({});
        setPendingNext(payload.nextSession);
        setBreakLeft(payload.nextSession.breakSeconds ?? 5);
        setIsBreaking(true);
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
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
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
      exitFullscreen();
    },
    [exitFullscreen],
  );

  useEffect(() => {
    setViolationHandler((reason) => handleForceStop(reason));
    return () => setViolationHandler(null);
  }, [handleForceStop, setViolationHandler]);

  if (membership.isLoading) {
    return <Skeleton className="h-72" />;
  }

  if (!membership.data?.isActive) {
    return <MembershipRequired status={membership.data} />;
  }

  if (membership.data?.allowCermat === false) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Paket membership kamu tidak mencakup akses tes kecermatan. Hubungi admin untuk upgrade paket.
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Tes Kecermatan</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Latihan Fokus dan Ketelitian</h1>
          <p className="mt-2 text-sm text-slate-600">Pilih varian tes dan lihat riwayat per sesi setelah selesai.</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/app/tes-kecermatan/riwayat')}>
          Lihat Riwayat
        </Button>
      </div>
      {TEST_VARIANTS.map((variant) => {
        const isLoading = startMutation.isPending && pendingMode === variant.mode;
        return (
          <div
            key={variant.mode}
            className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
          >
            <h2 className="text-3xl font-bold text-slate-900">{variant.title}</h2>
            <p className="mt-2 text-slate-600">{variant.description}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
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
              >
                {isLoading ? 'Menyiapkan...' : MODE_LABELS[variant.mode].button}
              </Button>
            </div>
          </div>
        );
      })}

      {session && currentQuestion && !isBreaking && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/95">
          <div className="grid grid-cols-[1fr_auto] items-start gap-3 px-4 py-4 text-white sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.5em] text-white/60">Tes Kecermatan</p>
              <h2 className="mt-1 text-lg font-semibold leading-snug sm:text-2xl">
                Sesi {session.sessionIndex}/{session.totalSessions} • Soal {currentIndex + 1} dari {session.questions.length}
              </h2>
              <p className="mt-1 text-xs text-white/70 sm:text-sm">Jawab sebelum hitungan mundur habis.</p>
            </div>
            <div className="shrink-0 rounded-3xl bg-white/10 px-4 py-2 text-center sm:px-6 sm:py-3">
              <p className="text-xs uppercase text-white/70">Sisa Waktu</p>
              <p className="text-2xl font-bold text-white sm:text-3xl">{timeLeft}s</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-10">
            <div className="mx-auto mt-3 flex max-w-3xl flex-col items-center gap-6 pt-2 sm:gap-8">
              <div className="mt-1 flex flex-col items-center gap-2 text-white sm:flex-row sm:gap-3">
                <img
                  src="/Logo_tactical.png"
                  alt="Tactical Education"
                  className="h-10 w-10 rounded-2xl object-cover sm:h-12 sm:w-12"
                />
                <p className="text-center text-xl font-semibold uppercase tracking-[0.22em] text-white/85 sm:text-2xl sm:tracking-[0.3em]">
                  TACTICAL EDUCATION
                </p>
              </div>
              <div className="w-full rounded-[32px] bg-white/95 p-6 text-slate-900 shadow-[0_30px_80px_rgba(15,23,42,0.55)]">
                <div className="space-y-4">
                  <div className="rounded-[32px] border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                      {MODE_LABELS[session.mode].reference}
                    </p>
                    <div className="mt-4 grid grid-cols-5 gap-3">
                      {session.baseSet.map((token, index) => {
                        const label = String.fromCharCode(65 + index);
                        return (
                          <div key={token} className="flex flex-col items-center gap-2">
                            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-4xl font-semibold text-slate-900 shadow-inner">
                              {token}
                            </span>
                            <span className="text-sm font-semibold text-slate-500">{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Deret Soal Aktif</p>
                    <p className="mt-4 flex items-center justify-between gap-3 font-mono text-3xl font-bold text-slate-900">
                      {currentQuestion.sequence.map((token, idx) => (
                        <span
                          key={`${token}-${idx}`}
                          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900/5"
                        >
                          {token}
                        </span>
                      ))}
                    </p>
                    <p className="mt-3 text-xs text-slate-500">{MODE_LABELS[session.mode].prompt}</p>
                  </div>
                </div>
                <div className="mt-8 grid grid-cols-5 gap-3">
                  {session.baseSet.map((option, index) => {
                    const label = String.fromCharCode(65 + index);
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleAdvance(option)}
                        className={`rounded-2xl border px-4 py-4 text-lg font-semibold transition ${
                          answers[currentQuestion.order] === option
                            ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-inner'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-6 flex justify-end">
                  <Button variant="ghost" onClick={() => handleAdvance(null)} disabled={submitMutation.isPending}>
                    Lewati Soal
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-800">
          <p className="text-sm font-semibold uppercase tracking-[0.3em]">Hasil Rata-rata Tes</p>
          <p className="mt-2 text-3xl font-bold">{result.averageScore}%</p>
          <p className="text-sm">{result.totalCorrect}/{result.totalQuestions} benar dari total sesi.</p>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {result.sessions.map((item) => (
              <div key={item.sessionIndex} className="rounded-2xl bg-white/70 p-3 text-sm text-emerald-800">
                <p className="font-semibold">Sesi {item.sessionIndex}</p>
                <p>Skor {item.score}% - {item.correct}/{item.total} benar</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {pendingNext && breakLeft > 0 && isBreaking && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/80 px-4">
          <div className="rounded-3xl bg-white p-6 text-center shadow-xl">
            <p className="text-sm font-semibold uppercase text-slate-500">Jeda Antar Sesi</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{breakLeft}s</p>
            <p className="mt-2 text-sm text-slate-500">Bersiap untuk sesi berikutnya.</p>
          </div>
        </div>
      )}
      <ExamCountdownModal
        open={countdownOpen}
        resetKey={countdownToken}
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
          setCurrentIndex(0);
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
