import { Fragment, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Check, Download, X } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiErrorMessage } from '@/lib/api';
import { cn } from '@/utils/cn';
import { liveQuizApi } from '../api';
import { formatDateTime, formatPoints, formatSeconds, phaseLabel } from '../format';
import { RichText } from '../ui/shared';
import { PlayerAvatar } from '../avatars';

function PlayerDetailRow({ sessionId, playerId }: { sessionId: string; playerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['live-quiz', 'player-detail', sessionId, playerId],
    queryFn: () => liveQuizApi.playerDetail(sessionId, playerId),
  });
  if (isLoading) return <Skeleton className="h-24" />;
  if (!data) return <p className="text-sm text-red-600">Gagal memuat detail.</p>;
  return (
    <div className="admin-table-wrap bg-white">
      <table className="admin-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Soal</th>
            <th>Jawaban peserta</th>
            <th>Jawaban benar</th>
            <th>Waktu</th>
            <th className="text-right">Poin</th>
          </tr>
        </thead>
        <tbody>
          {data.answers.map((answer) => (
            <tr key={answer.number}>
              <td>{answer.number}</td>
              <td className="max-w-xs truncate">{answer.prompt}</td>
              <td>
                {answer.answered ? (
                  <span className={cn('inline-flex items-center gap-1', answer.isCorrect ? 'text-emerald-600' : 'text-red-600')}>
                    {answer.isCorrect ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    {answer.selected.join(', ') || '-'}
                  </span>
                ) : (
                  <span className="text-slate-400">Tidak menjawab</span>
                )}
              </td>
              <td>{answer.correctAnswers.join(', ')}</td>
              <td>{formatSeconds(answer.responseMs)}</td>
              <td className="text-right font-semibold">{formatPoints(answer.scoreEarned)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminLiveQuizReportPage() {
  const { id = '' } = useParams();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['live-quiz', 'report', id],
    queryFn: () => liveQuizApi.report(id),
    enabled: Boolean(id),
  });

  const download = async () => {
    setDownloading(true);
    try {
      await liveQuizApi.downloadCsv(id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Gagal mengunduh CSV.'));
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) return <Skeleton className="h-96" />;
  if (isError || !data) return <p className="text-sm text-red-600">Laporan tidak ditemukan.</p>;

  const { session, summary, ranking, questions } = data;
  const cards = [
    { label: 'Peserta', value: summary.players },
    { label: 'Rata-rata skor', value: formatPoints(summary.averageScore) },
    { label: 'Skor tertinggi', value: formatPoints(summary.highestScore) },
    { label: 'Rata-rata akurasi', value: `${summary.averageAccuracy}%` },
  ];

  return (
    <div className="page-shell">
      <PageHeader
        variant="panel"
        eyebrow="Laporan Live Quiz"
        title={session.title}
        description={`${phaseLabel(session.status)} · ${formatDateTime(session.createdAt)} · tutor ${session.hostName} · ${session.totalQuestions} soal dihitung${
          session.totalQuestions < session.plannedQuestions ? ` dari ${session.plannedQuestions} (sesi dihentikan lebih awal)` : ''
        }`}
        action={
          <>
            <Button asChild variant="outline">
              <Link to="/admin/live-quiz/riwayat">
                <ArrowLeft className="h-4 w-4" />
                Riwayat
              </Link>
            </Button>
            <Button onClick={download} isLoading={downloading}>
              <Download className="h-4 w-4" />
              Ekspor CSV
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="admin-metric-card">
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader title="Peringkat peserta" subtitle="Klik baris untuk melihat jawaban per soal." />
        <CardContent className="p-0">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nama</th>
                  <th className="text-right">Skor</th>
                  <th className="text-right">Benar</th>
                  <th className="text-right">Salah</th>
                  <th className="text-right">Kosong</th>
                  <th className="text-right">Akurasi</th>
                  <th className="text-right">Rata-rata waktu</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row) => (
                  <Fragment key={row.playerId}>
                    <tr
                      className="cursor-pointer"
                      onClick={() => setExpanded(expanded === row.playerId ? null : row.playerId)}
                    >
                      <td className="font-bold">{row.rank}</td>
                      <td className="font-semibold text-slate-900">
                        <span className="inline-flex items-center gap-2 align-middle">
                          <PlayerAvatar avatarId={row.avatarId} seed={row.playerId} size={28} />
                          {row.name}
                        </span>
                        {row.userId && (
                          <Badge variant="outline" className="ml-2">
                            Akun
                          </Badge>
                        )}
                      </td>
                      <td className="text-right font-semibold">{formatPoints(row.totalPoints)}</td>
                      <td className="text-right text-emerald-600">{row.correctCount}</td>
                      <td className="text-right text-red-600">{row.incorrectCount}</td>
                      <td className="text-right text-slate-500">{row.unansweredCount}</td>
                      <td className="text-right">{row.accuracy}%</td>
                      <td className="text-right">{formatSeconds(row.avgResponseMs)}</td>
                    </tr>
                    {expanded === row.playerId && (
                      <tr>
                        <td colSpan={8} className="bg-slate-50 p-3">
                          <PlayerDetailRow sessionId={id} playerId={row.playerId} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {!ranking.length && <p className="py-10 text-center text-sm text-slate-500">Tidak ada peserta.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Statistik per soal" subtitle="Soal dengan persentase benar rendah menandakan materi yang perlu diulang." />
        <CardContent className="space-y-6">
          {questions.map((question) => (
            <div key={question.index} className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 text-sm font-semibold text-slate-900">
                  {question.number}. {question.prompt ? <RichText text={question.prompt} /> : '(soal bergambar)'}
                </p>
                <div className="flex shrink-0 gap-2 text-xs">
                  <Badge variant={question.correctRate >= 60 ? 'success' : 'outline'}>{question.correctRate}% benar</Badge>
                  <Badge variant="outline">{formatSeconds(question.avgResponseMs)}</Badge>
                </div>
              </div>
              <div className="space-y-1.5">
                {question.distribution.map((option) => {
                  const max = Math.max(1, ...question.distribution.map((d) => d.count));
                  return (
                    <div key={option.optionId} className="flex items-center gap-3 text-xs">
                      <span className="w-40 shrink-0 truncate text-slate-600 sm:w-64">{option.label ? <RichText text={option.label} /> : '(gambar)'}</span>
                      <div className="h-5 min-w-0 flex-1 overflow-hidden rounded-md bg-slate-100">
                        <div
                          className={cn('h-full rounded-md', option.isCorrect ? 'bg-emerald-500' : 'bg-slate-400')}
                          style={{ width: `${(option.count / max) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right font-semibold text-slate-700">{option.count}</span>
                    </div>
                  );
                })}
                <p className="text-xs text-slate-400">
                  Tidak menjawab: {question.unanswered} · Hijau = jawaban benar
                </p>
              </div>
            </div>
          ))}
          {!questions.length && <p className="py-6 text-center text-sm text-slate-500">Belum ada soal yang selesai.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
