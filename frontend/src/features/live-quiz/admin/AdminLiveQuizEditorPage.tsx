import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  ImagePlus,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage } from '@/lib/api';
import { getAssetUrl } from '@/lib/media';
import { cn } from '@/utils/cn';
import { liveQuizApi, type QuizPayload } from '../api';
import {
  TIME_LIMIT_OPTIONS,
  type BankSource,
  type EditorOption,
  type EditorQuestion,
  type QuestionType,
  type QuizSettings,
} from '../types';
import { SettingsForm } from './SettingsForm';

const MAX_OPTIONS = 6;
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const selectClass =
  'h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';

let keyCounter = 0;
const newKey = () => `q-${Date.now()}-${keyCounter++}`;

const blankOptions = (count = 4): EditorOption[] =>
  Array.from({ length: count }, () => ({ label: '', imageUrl: null, isCorrect: false }));

function blankQuestion(): EditorQuestion {
  return {
    key: newKey(),
    type: 'SINGLE',
    prompt: '',
    imageUrl: null,
    timeLimitSec: null,
    weight: 'NORMAL',
    options: blankOptions(),
  };
}

function validate(questions: EditorQuestion[]): string[] {
  const problems: string[] = [];
  questions.forEach((q, index) => {
    const label = `Soal ${index + 1}`;
    const correct = q.options.filter((o) => o.isCorrect).length;
    if (!q.prompt.trim() && !q.imageUrl) problems.push(`${label}: isi teks atau gambar soal.`);
    if (q.options.some((o) => !o.label.trim() && !o.imageUrl)) problems.push(`${label}: ada pilihan yang kosong.`);
    if (q.type !== 'MULTIPLE' && correct !== 1) problems.push(`${label}: pilih tepat satu jawaban benar.`);
    if (q.type === 'MULTIPLE' && correct < 1) problems.push(`${label}: pilih minimal satu jawaban benar.`);
  });
  return problems;
}

function changeType(question: EditorQuestion, type: QuestionType): EditorQuestion {
  if (type === question.type) return question;
  if (type === 'TRUE_FALSE') {
    const correctIndex = question.options.findIndex((o) => o.isCorrect);
    return {
      ...question,
      type,
      options: [
        { label: 'Benar', imageUrl: null, isCorrect: correctIndex === 0 },
        { label: 'Salah', imageUrl: null, isCorrect: correctIndex === 1 },
      ],
    };
  }
  let options = question.options;
  if (question.type === 'TRUE_FALSE') options = [...options, ...blankOptions(2)];
  if (type === 'SINGLE') {
    const firstCorrect = options.findIndex((o) => o.isCorrect);
    options = options.map((o, i) => ({ ...o, isCorrect: i === firstCorrect }));
  }
  return { ...question, type, options };
}

function ImageField({
  url,
  onChange,
  label,
}: {
  url: string | null;
  onChange: (url: string | null) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const result = await liveQuizApi.uploadImage(file);
      onChange(result.url);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Gagal mengunggah gambar.'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = '';
        }}
      />
      {url ? (
        <div className="relative">
          <img src={getAssetUrl(url)} alt="" className="h-14 w-14 rounded-xl border border-slate-200 object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1 text-white shadow"
            aria-label="Hapus gambar"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}
      <Button type="button" size="sm" variant="outline" isLoading={uploading} onClick={() => inputRef.current?.click()}>
        <ImagePlus className="h-4 w-4" />
        {url ? 'Ganti' : label}
      </Button>
    </div>
  );
}

function ImportDialog({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (questions: EditorQuestion[]) => void;
}) {
  const [type, setType] = useState<'TRYOUT' | 'PRACTICE'>('TRYOUT');
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['live-quiz', 'bank', type, search],
    queryFn: () => liveQuizApi.bankSources(type, search.trim() || undefined),
    enabled: open,
  });

  if (!open) return null;

  const importSource = async (source: BankSource) => {
    setLoadingId(source.id);
    try {
      const result = await liveQuizApi.bankQuestions(type, source.id);
      onImport(result.questions.map((q) => ({ ...q, key: newKey() })));
      if (result.skipped.length) {
        toast.warning(`${result.skipped.length} soal dilewati (mis. kunci jawaban kosong atau pilihan lebih dari ${MAX_OPTIONS}).`);
      } else {
        toast.success(`${result.questions.length} soal diimpor. Pembahasan tidak ikut diimpor.`);
      }
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Gagal mengimpor soal.'));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 px-4 py-8">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Impor dari bank soal</h2>
            <p className="mt-1 text-sm text-slate-500">
              Soal disalin ke kuis ini. Pembahasan tidak diimpor karena Live Quiz tidak memiliki tahap pembahasan.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" variant={type === 'TRYOUT' ? 'primary' : 'outline'} onClick={() => setType('TRYOUT')}>
            Tryout
          </Button>
          <Button size="sm" variant={type === 'PRACTICE' ? 'primary' : 'outline'} onClick={() => setType('PRACTICE')}>
            Latihan soal
          </Button>
        </div>
        <Input className="mt-3" placeholder="Cari judul…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
          {isLoading ? (
            <Skeleton className="h-16" />
          ) : data?.length ? (
            data.map((source) => (
              <div key={source.id} className="admin-list-item flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{source.title}</p>
                  <p className="text-xs text-slate-500">{source.questionCount} soal</p>
                </div>
                <Button
                  size="sm"
                  isLoading={loadingId === source.id}
                  disabled={source.questionCount === 0}
                  onClick={() => void importSource(source)}
                >
                  Impor semua
                </Button>
              </div>
            ))
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">Tidak ada data.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionEditor({
  question,
  index,
  total,
  open,
  onToggle,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  question: EditorQuestion;
  index: number;
  total: number;
  open: boolean;
  onToggle: () => void;
  onChange: (next: EditorQuestion) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const problems = validate([question]);
  const setOption = (i: number, patch: Partial<EditorOption>) =>
    onChange({ ...question, options: question.options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) });

  const toggleCorrect = (i: number) => {
    if (question.type === 'MULTIPLE') {
      setOption(i, { isCorrect: !question.options[i]!.isCorrect });
    } else {
      onChange({ ...question, options: question.options.map((o, idx) => ({ ...o, isCorrect: idx === i })) });
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
            {index + 1}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-900">
              {question.prompt.trim() || (question.imageUrl ? '(soal bergambar)' : 'Soal belum diisi')}
            </span>
            <span className="block text-xs text-slate-500">
              {question.type === 'SINGLE' ? 'Pilihan ganda' : question.type === 'TRUE_FALSE' ? 'Benar / Salah' : 'Jawaban ganda'} ·{' '}
              {question.timeLimitSec ? `${question.timeLimitSec} dtk` : 'durasi default'}
              {question.weight === 'DOUBLE' ? ' · poin 2x' : question.weight === 'NONE' ? ' · tanpa poin' : ''}
            </span>
          </span>
          {problems.length === 0 ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-label="Valid" />
          ) : (
            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              Belum lengkap
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
        </button>
        <div className="flex shrink-0 items-center">
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={index === 0} onClick={() => onMove(-1)} title="Naik">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={index === total - 1} onClick={() => onMove(1)} title="Turun">
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onDuplicate} title="Duplikat">
            <Copy className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={onRemove} title="Hapus">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="space-y-5 border-t border-slate-100 px-4 py-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <span className="admin-field-label">Tipe soal</span>
              <select
                className={selectClass}
                value={question.type}
                onChange={(e) => onChange(changeType(question, e.target.value as QuestionType))}
              >
                <option value="SINGLE">Pilihan ganda (1 benar)</option>
                <option value="TRUE_FALSE">Benar / Salah</option>
                <option value="MULTIPLE">Jawaban ganda (pilih semua yang benar)</option>
              </select>
            </div>
            <div>
              <span className="admin-field-label">Durasi soal</span>
              <select
                className={selectClass}
                value={question.timeLimitSec ?? ''}
                onChange={(e) => onChange({ ...question, timeLimitSec: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Ikuti default kuis</option>
                {TIME_LIMIT_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s} detik
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="admin-field-label">Bobot poin</span>
              <select
                className={selectClass}
                value={question.weight}
                onChange={(e) => onChange({ ...question, weight: e.target.value as EditorQuestion['weight'] })}
              >
                <option value="NORMAL">Normal (1x)</option>
                <option value="DOUBLE">Ganda (2x)</option>
                <option value="NONE">Tanpa poin</option>
              </select>
            </div>
          </div>

          <div>
            <span className="admin-field-label">Teks soal</span>
            <Textarea
              rows={3}
              value={question.prompt}
              placeholder="Tulis pertanyaan. Rumus matematika: gunakan $...$ untuk inline atau $$...$$ untuk blok."
              onChange={(e) => onChange({ ...question, prompt: e.target.value })}
            />
            <div className="mt-2">
              <ImageField url={question.imageUrl} onChange={(url) => onChange({ ...question, imageUrl: url })} label="Gambar soal" />
            </div>
          </div>

          <div>
            <span className="admin-field-label">
              Pilihan jawaban {question.type === 'MULTIPLE' ? '(centang semua yang benar)' : '(pilih satu yang benar)'}
            </span>
            <div className="space-y-2">
              {question.options.map((option, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-xl border p-3',
                    option.isCorrect ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200 bg-white',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCorrect(i)}
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition',
                        option.isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                      )}
                      title={option.isCorrect ? 'Jawaban benar' : 'Tandai sebagai benar'}
                      aria-pressed={option.isCorrect}
                    >
                      {option.isCorrect ? <CheckCircle2 className="h-5 w-5" /> : OPTION_LETTERS[i]}
                    </button>
                    <Input
                      value={option.label}
                      readOnly={question.type === 'TRUE_FALSE'}
                      placeholder={`Pilihan ${OPTION_LETTERS[i]}`}
                      onChange={(e) => setOption(i, { label: e.target.value })}
                    />
                    {question.type !== 'TRUE_FALSE' && question.options.length > 2 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 shrink-0 text-red-600"
                        onClick={() => onChange({ ...question, options: question.options.filter((_, idx) => idx !== i) })}
                        title="Hapus pilihan"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {question.type !== 'TRUE_FALSE' && (
                    <div className="mt-2 pl-11">
                      <ImageField url={option.imageUrl} onChange={(url) => setOption(i, { imageUrl: url })} label="Gambar pilihan" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {question.type !== 'TRUE_FALSE' && question.options.length < MAX_OPTIONS && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => onChange({ ...question, options: [...question.options, ...blankOptions(1)] })}
              >
                <Plus className="h-4 w-4" />
                Tambah pilihan
              </Button>
            )}
          </div>

          {problems.length > 0 && (
            <ul className="list-disc space-y-1 rounded-xl bg-amber-50 px-6 py-3 text-xs text-amber-800">
              {problems.map((p) => (
                <li key={p}>{p.replace(/^Soal \d+: /, '')}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

export function AdminLiveQuizEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [questions, setQuestions] = useState<EditorQuestion[]>(() => (isNew ? [blankQuestion()] : []));
  const [openKey, setOpenKey] = useState<string | null>(() => null);
  const [customSettings, setCustomSettings] = useState(false);
  const [settings, setSettings] = useState<QuizSettings | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const loaded = useRef(false);

  const defaults = useQuery({ queryKey: ['live-quiz', 'settings'], queryFn: liveQuizApi.getSettings });
  const existing = useQuery({
    queryKey: ['live-quiz', 'quiz', id],
    queryFn: () => liveQuizApi.getQuiz(id!),
    enabled: !isNew,
  });

  useEffect(() => {
    if (isNew && questions[0] && openKey === null) setOpenKey(questions[0].key);
  }, [isNew, questions, openKey]);

  useEffect(() => {
    const quiz = existing.data;
    if (!quiz || loaded.current || !defaults.data) return;
    loaded.current = true;
    setTitle(quiz.title);
    setDescription(quiz.description ?? '');
    setSubject(quiz.subject ?? '');
    setCategory(quiz.category ?? '');
    setQuestions(
      quiz.questions.map((q) => ({
        key: newKey(),
        type: q.type,
        prompt: q.prompt,
        imageUrl: q.imageUrl,
        timeLimitSec: q.timeLimitSec,
        weight: q.weight,
        sourceType: q.sourceType,
        sourceId: q.sourceId,
        options: q.options.map((o) => ({ label: o.label, imageUrl: o.imageUrl, isCorrect: o.isCorrect })),
      })),
    );
    const own = quiz.settings && Object.keys(quiz.settings).length > 0;
    setCustomSettings(Boolean(own));
    setSettings({ ...defaults.data.settings, ...(quiz.settings ?? {}) });
  }, [existing.data, defaults.data]);

  useEffect(() => {
    if (!settings && defaults.data && isNew) setSettings(defaults.data.settings);
  }, [defaults.data, isNew, settings]);

  const problems = useMemo(() => validate(questions), [questions]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: QuizPayload = {
        title: title.trim(),
        description: description.trim() || null,
        subject: subject.trim() || null,
        category: category.trim() || null,
        settings: customSettings && settings ? settings : {},
        questions: questions.map((question) => {
          const payload: Partial<EditorQuestion> = { ...question };
          delete payload.key;
          return payload as Omit<EditorQuestion, 'key'>;
        }),
      };
      return isNew ? liveQuizApi.createQuiz(payload) : liveQuizApi.updateQuiz(id!, payload);
    },
    onSuccess: (quiz) => {
      toast.success('Kuis disimpan.');
      void queryClient.invalidateQueries({ queryKey: ['live-quiz'] });
      if (isNew) navigate(`/admin/live-quiz/kuis/${quiz.id}`, { replace: true });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Gagal menyimpan kuis.')),
  });

  const handleSave = () => {
    if (title.trim().length < 3) return toast.error('Judul kuis minimal 3 karakter.');
    if (!questions.length) return toast.error('Tambahkan minimal satu soal.');
    if (problems.length) return toast.error(problems[0]!);
    save.mutate();
  };

  const updateQuestion = (key: string, next: EditorQuestion) => setQuestions((list) => list.map((q) => (q.key === key ? next : q)));
  const move = (index: number, direction: -1 | 1) =>
    setQuestions((list) => {
      const copy = [...list];
      const target = index + direction;
      if (target < 0 || target >= copy.length) return list;
      [copy[index], copy[target]] = [copy[target]!, copy[index]!];
      return copy;
    });

  if (!isNew && (existing.isLoading || !defaults.data)) {
    return <Skeleton className="h-96" />;
  }
  if (!isNew && existing.isError) {
    return <p className="text-sm text-red-600">Kuis tidak ditemukan.</p>;
  }

  return (
    <div className="page-shell">
      <PageHeader
        variant="panel"
        eyebrow="Live Quiz"
        title={isNew ? 'Buat kuis baru' : 'Edit kuis'}
        description="Setiap soal punya durasi, bobot poin, dan jenis jawaban sendiri. Tidak ada tahap pembahasan di Live Quiz."
        action={
          <>
            <Button asChild variant="outline">
              <Link to="/admin/live-quiz/kuis">
                <ArrowLeft className="h-4 w-4" />
                Kembali
              </Link>
            </Button>
            <Button onClick={handleSave} isLoading={save.isPending}>
              <Save className="h-4 w-4" />
              Simpan kuis
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader title="Informasi kuis" />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <span className="admin-field-label">Judul kuis</span>
            <Input value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Kuis Microsoft Word Dasar" />
          </div>
          <div>
            <span className="admin-field-label">Mata pelajaran / topik</span>
            <Input value={subject} maxLength={100} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <span className="admin-field-label">Kategori</span>
            <Input value={category} maxLength={100} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <span className="admin-field-label">Deskripsi (opsional)</span>
            <Textarea rows={2} value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">Soal ({questions.length})</h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
            <Database className="h-4 w-4" />
            Impor dari bank soal
          </Button>
          <Button
            type="button"
            onClick={() => {
              const q = blankQuestion();
              setQuestions((list) => [...list, q]);
              setOpenKey(q.key);
            }}
          >
            <Plus className="h-4 w-4" />
            Tambah soal
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {questions.map((question, index) => (
          <QuestionEditor
            key={question.key}
            question={question}
            index={index}
            total={questions.length}
            open={openKey === question.key}
            onToggle={() => setOpenKey(openKey === question.key ? null : question.key)}
            onChange={(next) => updateQuestion(question.key, next)}
            onMove={(direction) => move(index, direction)}
            onDuplicate={() => {
              const copy: EditorQuestion = { ...question, key: newKey(), options: question.options.map((o) => ({ ...o })) };
              setQuestions((list) => [...list.slice(0, index + 1), copy, ...list.slice(index + 1)]);
              setOpenKey(copy.key);
            }}
            onRemove={() => setQuestions((list) => list.filter((q) => q.key !== question.key))}
          />
        ))}
        {!questions.length && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-slate-500">
              Belum ada soal. Tambahkan soal atau impor dari bank soal.
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader title="Pengaturan kuis" subtitle="Bisa diubah lagi sebelum sesi dimulai." />
        <CardContent className="space-y-5">
          <label className="admin-check-row cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={!customSettings}
              onChange={(e) => setCustomSettings(!e.target.checked)}
            />
            Gunakan pengaturan default global
          </label>
          {customSettings && settings && <SettingsForm value={settings} onChange={setSettings} />}
        </CardContent>
      </Card>

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(imported) => {
          setQuestions((list) => [...list, ...imported]);
        }}
      />
    </div>
  );
}
