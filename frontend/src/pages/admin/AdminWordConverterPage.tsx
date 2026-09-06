import { useCallback, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import {
  FileText,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Search,
  Eye,
  ChevronDown,
  ChevronUp,
  ImageIcon,
} from 'lucide-react';
import { apiPostForm, getApiErrorMessage, apiPost } from '@/lib/api';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getAssetUrl } from '@/lib/media';

type ParsedOption = {
  label: string;
  imageUrl?: string | null;
  isCorrect?: boolean;
};

type ParsedQuestion = {
  prompt: string;
  imageUrl?: string | null;
  explanation?: string | null;
  explanationImageUrl?: string | null;
  order?: number;
  options: ParsedOption[];
  requiresPromptImage?: boolean;
  requiresExplanationImage?: boolean;
};

type ConversionWarning = {
  row: number;
  field: string;
  message: string;
};

type ConvertResponse = {
  questions: ParsedQuestion[];
  warnings: ConversionWarning[];
  extractedImages: string[];
  embeddedImageCount?: number;
  csvContent: string;
  questionCount: number;
};

/** Hanya info deteksi otomatis yang tidak memblokir unduh. Error gambar (URL wajib) bersifat blocking. */
const NON_BLOCKING_WARNING_FIELDS = new Set(['auto']);

const IMAGE_OPTION_LABEL = /^gambar\s*[a-e]$/i;

type RowFilter = 'all' | 'error' | 'ok';

const FIELD_LABELS: Record<string, string> = {
  prompt: 'Pertanyaan',
  explanation: 'Pembahasan',
  options: 'Pilihan jawaban',
  correct: 'Kunci jawaban',
  images: 'Gambar',
  format: 'Format dokumen',
  document: 'Dokumen',
  auto: 'Deteksi otomatis',
};

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;

function validateQuestionsLocal(questions: ParsedQuestion[]): ConversionWarning[] {
  const warnings: ConversionWarning[] = [];

  if (!questions.length) {
    warnings.push({ row: 0, field: 'document', message: 'Tidak ada soal terdeteksi dalam dokumen.' });
    return warnings;
  }

  questions.forEach((question, index) => {
    const row = index + 1;

    if (!question.prompt?.trim() && !question.imageUrl?.trim()) {
      warnings.push({ row, field: 'prompt', message: 'Pertanyaan kosong — isi teks atau URL gambar soal.' });
    }

    if (!question.explanation?.trim() && !question.explanationImageUrl?.trim()) {
      warnings.push({
        row,
        field: 'explanation',
        message: 'Pembahasan wajib — isi teks atau URL gambar pembahasan.',
      });
    }

    const filledOptions = question.options.filter((option) => option.label?.trim() || option.imageUrl?.trim());
    if (filledOptions.length < 2) {
      warnings.push({
        row,
        field: 'options',
        message: 'Minimal 2 pilihan jawaban (teks atau gambar) diperlukan.',
      });
    }

    const correctCount = question.options.filter((option) => option.isCorrect).length;
    if (correctCount === 0) {
      warnings.push({ row, field: 'correct', message: 'Kunci jawaban belum ditentukan.' });
    }

    if (question.requiresPromptImage && !question.imageUrl?.trim()) {
      warnings.push({
        row,
        field: 'images',
        message: 'Soal membutuhkan gambar — isi URL gambar soal (file dari Word tidak disimpan otomatis).',
      });
    }

    if (question.requiresExplanationImage && !question.explanationImageUrl?.trim()) {
      warnings.push({
        row,
        field: 'images',
        message: 'Pembahasan membutuhkan gambar — isi URL gambar pembahasan.',
      });
    }

    const missingImageOptions = question.options
      .map((option, optionIndex) => ({ option, letter: OPTION_LABELS[optionIndex] }))
      .filter(({ option }) => IMAGE_OPTION_LABEL.test((option.label ?? '').trim()) && !option.imageUrl?.trim());

    if (missingImageOptions.length) {
      warnings.push({
        row,
        field: 'images',
        message: `Opsi ${missingImageOptions.map((item) => item.letter).join(', ')} berbasis gambar — isi URL gambar opsi.`,
      });
    }
  });

  return warnings;
}

function csvRowNumber(questionIndex: number) {
  return questionIndex + 2;
}

function buildCsvDownloadName(wordFile: File | null): string {
  if (!wordFile?.name) return 'soal-konversi.csv';

  const baseName = wordFile.name.replace(/\.[^.]+$/i, '').trim() || 'soal-konversi';
  const safeName = baseName.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim();

  return `${safeName || 'soal-konversi'}.csv`;
}

function downloadTextFile(content: string, filename: string) {
  const blob = new Blob(['\ufeff', content], { type: 'text/csv;charset=utf-8;' });
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

function ensureFiveOptions(options: ParsedOption[]): ParsedOption[] {
  const next = [...options];
  while (next.length < 5) {
    next.push({ label: '', imageUrl: null, isCorrect: false });
  }
  return next.slice(0, 5);
}

function QuestionStatusBadge({ isOk, errorCount }: { isOk: boolean; errorCount: number }) {
  if (isOk) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        OK
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
      <AlertTriangle className="h-3 w-3" />
      {errorCount} error
    </span>
  );
}

/** Field URL foto tersembunyi; klik baris untuk membuka. */
function CollapsibleUrlPhotoField({
  label,
  value,
  onChange,
  placeholder,
  previewAlt,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  previewAlt?: string;
}) {
  const hasUrl = Boolean(value.trim());

  return (
    <div className="mt-2 space-y-2">
      {hasUrl && (
        <img
          src={getAssetUrl(value)}
          alt={previewAlt ?? 'Preview foto'}
          className="max-h-40 w-full rounded-xl border border-slate-200 bg-white object-contain"
          loading="lazy"
          onError={(event) => {
            (event.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
      <details className="group rounded-lg border border-dashed border-slate-200 bg-slate-50/60 open:border-solid open:border-slate-200 open:bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[11px] font-semibold text-slate-500 marker:content-none hover:text-slate-700">
          <ImageIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1 truncate">{hasUrl ? label : `+ ${label}`}</span>
          {hasUrl ? (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              Terisi
            </span>
          ) : null}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-slate-100 px-3 pb-3 pt-2">
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="h-8 border-slate-200 bg-white text-xs"
          />
          <p className="mt-1 text-[10px] text-slate-400">Tempel link URL foto (https://...)</p>
        </div>
      </details>
    </div>
  );
}

export function AdminWordConverterPage() {
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [warnings, setWarnings] = useState<ConversionWarning[]>([]);
  const [embeddedImageCount, setEmbeddedImageCount] = useState(0);
  const [isConverting, setIsConverting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [rowFilter, setRowFilter] = useState<RowFilter>('all');
  const [showErrorPanel, setShowErrorPanel] = useState(false);
  const [errorPanelOpen, setErrorPanelOpen] = useState(true);
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);
  const questionRefs = useRef<Record<number, HTMLElement | null>>({});

  const hasQuestions = questions.length > 0;
  const csvDownloadName = buildCsvDownloadName(wordFile);
  // Validasi live agar tombol unduh aktif lagi setelah URL gambar diisi (tanpa wajib klik Cek Error dulu).
  const hasBlockingWarnings = useMemo(
    () => validateQuestionsLocal(questions).some((warning) => !NON_BLOCKING_WARNING_FIELDS.has(warning.field)),
    [questions],
  );

  const errorRows = useMemo(() => {
    const rows = new Set<number>();
    validateQuestionsLocal(questions).forEach((warning) => {
      if (warning.row > 0 && !NON_BLOCKING_WARNING_FIELDS.has(warning.field)) {
        rows.add(warning.row);
      }
    });
    return rows;
  }, [questions]);

  const errorRowList = useMemo(() => [...errorRows].sort((a, b) => a - b), [errorRows]);

  const okCount = questions.length - errorRows.size;
  const errorCount = errorRowList.length;

  const warningsByRow = useMemo(() => {
    const map = new Map<number, ConversionWarning[]>();
    // Pakai validasi live agar badge/error per soal ikut berubah saat URL diisi.
    validateQuestionsLocal(questions).forEach((warning) => {
      if (warning.row <= 0) return;
      const list = map.get(warning.row) ?? [];
      list.push(warning);
      map.set(warning.row, list);
    });
    return map;
  }, [questions]);

  const globalWarnings = useMemo(() => {
    const fromServer = warnings.filter((warning) => warning.row === 0);
    if (embeddedImageCount > 0 && !fromServer.some((warning) => warning.field === 'images')) {
      return [
        ...fromServer,
        {
          row: 0,
          field: 'images',
          message: `Dokumen berisi ${embeddedImageCount} gambar. File dari Word tidak disimpan otomatis — isi URL gambar di kolom yang diminta.`,
        },
      ];
    }
    return fromServer;
  }, [warnings, embeddedImageCount]);

  /** Info dokumen (mis. deteksi otomatis) — bukan error soal. */
  const infoWarnings = useMemo(
    () => globalWarnings.filter((warning) => NON_BLOCKING_WARNING_FIELDS.has(warning.field)),
    [globalWarnings],
  );
  const documentIssueWarnings = useMemo(
    () => globalWarnings.filter((warning) => !NON_BLOCKING_WARNING_FIELDS.has(warning.field)),
    [globalWarnings],
  );
  const validationPanelTone = errorCount > 0 || documentIssueWarnings.length > 0 ? 'warning' : 'info';
  const liveRowWarnings = useMemo(
    () => validateQuestionsLocal(questions).filter((warning) => warning.row > 0),
    [questions],
  );

  const scrollToQuestion = useCallback((rowNumber: number) => {
    const element = questionRefs.current[rowNumber - 1];
    if (!element) {
      toast.error(`Soal ${rowNumber} tidak ditemukan`);
      return;
    }
    setRowFilter('all');
    setHighlightedRow(rowNumber);
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => setHighlightedRow(null), 2500);
  }, []);

  const handlePreviewErrors = async () => {
    if (!hasQuestions) {
      toast.error('Belum ada soal untuk dicek');
      return;
    }

    try {
      const result = await apiPost<Pick<ConvertResponse, 'warnings'>>('/admin/tools/questions-to-csv', { questions });
      setWarnings(result.warnings);
      setShowErrorPanel(true);
      setErrorPanelOpen(true);

      const blocking = result.warnings.filter((warning) => warning.row > 0 && !NON_BLOCKING_WARNING_FIELDS.has(warning.field));
      if (!blocking.length) {
        toast.success('Semua soal valid — tidak ada error.');
      } else {
        const rows = [...new Set(blocking.map((warning) => warning.row))].sort((a, b) => a - b);
        toast.warning(`Ditemukan error di ${rows.length} soal: baris ${rows.join(', ')}`);
        scrollToQuestion(rows[0]);
      }
    } catch {
      const localWarnings = validateQuestionsLocal(questions);
      setWarnings(localWarnings);
      setShowErrorPanel(true);
      toast.error('Gagal cek error via server, menggunakan validasi lokal.');
    }
  };

  const filteredQuestions = useMemo(() => {
    return questions
      .map((question, questionIndex) => ({ question, questionIndex }))
      .filter(({ questionIndex }) => {
        const rowNumber = questionIndex + 1;
        const hasError = errorRows.has(rowNumber);
        if (rowFilter === 'error') return hasError;
        if (rowFilter === 'ok') return !hasError;
        return true;
      });
  }, [questions, rowFilter, errorRows]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setWordFile(file);
  };

  const handleConvert = async () => {
    if (!wordFile) {
      toast.error('Pilih file Word (.docx atau .doc) terlebih dahulu');
      return;
    }

    setIsConverting(true);
    try {
      const formData = new FormData();
      formData.append('wordFile', wordFile);

      const result = await apiPostForm<ConvertResponse>('/admin/tools/convert-word-to-csv', formData);
      setQuestions(result.questions.map((question) => ({ ...question, options: ensureFiveOptions(question.options) })));
      setWarnings(result.warnings);
      setEmbeddedImageCount(result.embeddedImageCount ?? result.extractedImages?.length ?? 0);
      const hasBlocking = result.warnings.some((warning) => !NON_BLOCKING_WARNING_FIELDS.has(warning.field));
      setShowErrorPanel(hasBlocking);
      setErrorPanelOpen(hasBlocking);
      setRowFilter('all');

      const questionErrors = result.warnings.filter(
        (warning) => warning.row > 0 && !NON_BLOCKING_WARNING_FIELDS.has(warning.field),
      );
      const infoOnly =
        result.warnings.length > 0 &&
        result.warnings.every((warning) => NON_BLOCKING_WARNING_FIELDS.has(warning.field));

      if (!result.questions.length) {
        toast.error('Tidak ada soal terdeteksi. Periksa format template Word.');
      } else if (questionErrors.length) {
        const rows = [...new Set(questionErrors.map((warning) => warning.row))].sort((a, b) => a - b);
        toast.warning(
          `${result.questionCount} soal terdeteksi. ${rows.length} soal perlu diperbaiki — periksa preview.`,
        );
      } else if (hasBlocking) {
        // Error dokumen (mis. gambar tertanam) tanpa error baris soal spesifik.
        toast.warning(
          `${result.questionCount} soal terdeteksi. Ada catatan penting — isi URL gambar jika diminta, lalu periksa preview.`,
        );
      } else if (infoOnly) {
        // field "auto" = info deteksi format, bukan kesalahan soal.
        toast.success(
          `${result.questionCount} soal berhasil dikonversi (format terdeteksi otomatis). Semua soal valid — silakan unduh CSV.`,
        );
      } else {
        toast.success(`${result.questionCount} soal berhasil dikonversi.`);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Gagal mengonversi file Word. Pastikan format .docx/.doc dapat dibaca.'));
    } finally {
      setIsConverting(false);
    }
  };

  const updateQuestion = useCallback((index: number, patch: Partial<ParsedQuestion>) => {
    setQuestions((prev) => prev.map((question, rowIndex) => (rowIndex === index ? { ...question, ...patch } : question)));
  }, []);

  const hasFieldError = useCallback(
    (rowNumber: number, field: string) => {
      const rowWarnings = warningsByRow.get(rowNumber) ?? [];
      return rowWarnings.some((warning) => warning.field === field);
    },
    [warningsByRow],
  );

  const updateOption = useCallback((questionIndex: number, optionIndex: number, label: string) => {
    setQuestions((prev) =>
      prev.map((question, rowIndex) => {
        if (rowIndex !== questionIndex) return question;
        const options = ensureFiveOptions(question.options);
        options[optionIndex] = { ...options[optionIndex], label };
        return { ...question, options };
      }),
    );
  }, []);

  const updateOptionImage = useCallback((questionIndex: number, optionIndex: number, imageUrl: string) => {
    setQuestions((prev) =>
      prev.map((question, rowIndex) => {
        if (rowIndex !== questionIndex) return question;
        const options = ensureFiveOptions(question.options);
        options[optionIndex] = { ...options[optionIndex], imageUrl: imageUrl || null };
        return { ...question, options };
      }),
    );
  }, []);

  const toggleCorrectOption = useCallback((questionIndex: number, optionIndex: number) => {
    setQuestions((prev) =>
      prev.map((question, rowIndex) => {
        if (rowIndex !== questionIndex) return question;
        const options = ensureFiveOptions(question.options).map((option, idx) =>
          idx === optionIndex ? { ...option, isCorrect: !option.isCorrect } : option,
        );
        return { ...question, options };
      }),
    );
  }, []);

  const handleDownloadCsv = async () => {
    if (!hasQuestions) {
      toast.error('Belum ada soal untuk diunduh');
      return;
    }

    setIsDownloading(true);
    try {
      const result = await apiPost<ConvertResponse>('/admin/tools/questions-to-csv', { questions });
      setWarnings(result.warnings);

      const blocking = result.warnings.filter((warning) => !NON_BLOCKING_WARNING_FIELDS.has(warning.field));
      if (blocking.length) {
        setShowErrorPanel(true);
        setErrorPanelOpen(true);
        toast.error('Masih ada error. Isi URL gambar / perbaiki soal sebelum unduh CSV.');
        const firstRow = blocking.find((warning) => warning.row > 0)?.row;
        if (firstRow) scrollToQuestion(firstRow);
        return;
      }

      toast.success('CSV siap diunduh');
      downloadTextFile(result.csvContent, csvDownloadName);
    } catch {
      toast.error('Gagal membuat file CSV');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <section className="page-shell">
      <PageHeader variant="panel"
        eyebrow="Admin"
        title="Konversi Word → CSV"
        description="Unggah bank soal Word (.docx atau .doc), preview hasil konversi, lalu unduh CSV siap upload ke Tryout atau Latihan."
        action={
          <>
            <Button asChild variant="outline" size="sm">
              <a href="/templates/Template_Soal_Word.txt" download>
                <FileText className="mr-2 h-4 w-4" />
                Template Word
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/templates/Template_Tryout.csv" download>
                <Download className="mr-2 h-4 w-4" />
                Template CSV Tryout
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/templates/Template_Latihan_Soal.csv" download>
                <Download className="mr-2 h-4 w-4" />
                Template CSV Latihan
              </a>
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-lg font-semibold text-slate-900">1. Unggah Dokumen Word</h3>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="mt-2 text-xs text-slate-500">
              Sistem menganalisis dokumen secara otomatis — urutan pertanyaan, opsi, kunci, dan pembahasan boleh acak.
              Minimal wajib ada opsi A–E dan kunci jawaban (mis. <strong>Kunci: B</strong> atau <strong>Jawab: C</strong>).
              Foto memakai <strong>link URL</strong> (https://...), bukan upload file — tempel di preview per soal/opsi/pembahasan.
            </p>
            <p className="font-semibold text-slate-800">Contoh format (bebas urutan):</p>
            <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-700">{`1. Pertanyaan bernomor...
A. Opsi A
B. Opsi B
...
Jawab: C

Pembahasan (opsional, tanpa label pun boleh)

— atau format fleksibel —
A. Opsi A   B. Opsi B ...
Kunci Jawaban: B`}</pre>
            <p className="mt-2 text-xs font-semibold text-brand-700">Format template (opsional)</p>
          </div>
          <Input
            type="file"
            accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
            onChange={handleFileChange}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleConvert} disabled={!wordFile || isConverting}>
              <Upload className="mr-2 h-4 w-4" />
              {isConverting ? 'Mengonversi...' : 'Konversi ke CSV'}
            </Button>
            {wordFile && <span className="self-center text-xs text-slate-500">{wordFile.name}</span>}
          </div>
        </CardContent>
      </Card>

      {hasQuestions && (
        <Card className="overflow-hidden">
          {/* Sticky toolbar */}
          <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur-sm sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Langkah 2</p>
                <h3 className="text-lg font-semibold text-slate-900">Preview & Koreksi</h3>
                <p className="text-sm text-slate-500">
                  {questions.length} soal · {okCount} OK · {errorCount} perlu diperbaiki
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handlePreviewErrors}>
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  Cek Error
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleDownloadCsv}
                  disabled={isDownloading || hasBlockingWarnings}
                  title={hasBlockingWarnings ? 'Perbaiki error (termasuk URL gambar) sebelum unduh' : undefined}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {isDownloading ? 'Menyiapkan...' : 'Download CSV'}
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { key: 'all' as RowFilter, label: `Semua (${questions.length})`, activeClass: 'bg-brand-600 text-white' },
                    { key: 'error' as RowFilter, label: `Error (${errorCount})`, activeClass: 'bg-amber-600 text-white' },
                    { key: 'ok' as RowFilter, label: `OK (${okCount})`, activeClass: 'bg-emerald-600 text-white' },
                  ] as const
                ).map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setRowFilter(filter.key)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      rowFilter === filter.key
                        ? filter.activeClass
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                Unduhan: <span className="font-semibold text-slate-700">{csvDownloadName}</span>
              </p>
            </div>
          </div>

          <CardContent className="p-0">
            {/* Error / info panel — collapsible */}
            {(showErrorPanel || warnings.length > 0 || errorCount > 0) && (
              <div
                className={
                  validationPanelTone === 'warning'
                    ? 'border-b border-amber-200 bg-amber-50/80'
                    : 'border-b border-slate-200 bg-slate-50/90'
                }
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left sm:px-6"
                  onClick={() => setErrorPanelOpen((open) => !open)}
                >
                  <div
                    className={
                      validationPanelTone === 'warning'
                        ? 'flex flex-wrap items-center gap-2 text-sm font-semibold text-amber-900'
                        : 'flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800'
                    }
                  >
                    <Search className="h-4 w-4 shrink-0" />
                    {errorCount > 0
                      ? `Ringkasan validasi — ${errorCount} soal perlu diperbaiki`
                      : documentIssueWarnings.length > 0
                        ? `Ringkasan validasi — ${documentIssueWarnings.length} catatan dokumen`
                        : 'Ringkasan validasi — tidak ada error soal'}
                    {errorCount === 0 && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        Semua OK
                      </span>
                    )}
                    {infoWarnings.length > 0 && errorCount === 0 && (
                      <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        Info format
                      </span>
                    )}
                  </div>
                  {errorPanelOpen ? (
                    <ChevronUp className={`h-4 w-4 ${validationPanelTone === 'warning' ? 'text-amber-700' : 'text-slate-500'}`} />
                  ) : (
                    <ChevronDown className={`h-4 w-4 ${validationPanelTone === 'warning' ? 'text-amber-700' : 'text-slate-500'}`} />
                  )}
                </button>

                {errorPanelOpen && (
                  <div className="space-y-3 px-4 pb-4 sm:px-6">
                    {infoWarnings.length > 0 && (
                      <ul className="list-disc space-y-1 rounded-xl bg-white px-4 py-3 pl-8 text-sm text-slate-700">
                        {infoWarnings.map((warning, index) => (
                          <li key={`info-${index}`}>{warning.message}</li>
                        ))}
                      </ul>
                    )}
                    {documentIssueWarnings.length > 0 && (
                      <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
                        {documentIssueWarnings.map((warning, index) => (
                          <li key={`doc-${index}`}>{warning.message}</li>
                        ))}
                      </ul>
                    )}

                    {errorRowList.length > 0 ? (
                      <>
                        <div className="overflow-x-auto rounded-xl border border-amber-200 bg-white shadow-sm">
                          <table className="min-w-full text-left text-xs">
                            <thead className="bg-amber-100/60 text-amber-900">
                              <tr>
                                <th className="px-3 py-2 font-semibold">Baris CSV</th>
                                <th className="px-3 py-2 font-semibold">Soal</th>
                                <th className="px-3 py-2 font-semibold">Kolom</th>
                                <th className="px-3 py-2 font-semibold">Masalah</th>
                                <th className="px-3 py-2 font-semibold">Aksi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {liveRowWarnings.map((warning, index) => (
                                  <tr key={`${warning.row}-${warning.field}-${index}`} className="border-t border-amber-50">
                                    <td className="px-3 py-2 font-mono font-semibold text-red-700">{csvRowNumber(warning.row - 1)}</td>
                                    <td className="px-3 py-2 font-semibold">Soal {warning.row}</td>
                                    <td className="px-3 py-2">{FIELD_LABELS[warning.field] ?? warning.field}</td>
                                    <td className="px-3 py-2 text-slate-700">{warning.message}</td>
                                    <td className="px-3 py-2">
                                      <Button type="button" size="sm" variant="outline" onClick={() => scrollToQuestion(warning.row)}>
                                        Lihat
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {errorRowList.map((row) => (
                            <button
                              key={row}
                              type="button"
                              onClick={() => scrollToQuestion(row)}
                              className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                            >
                              Soal {row}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="rounded-xl bg-white px-3 py-2 text-sm text-emerald-700">
                        Tidak ada error pada level soal. Semua baris siap diunduh.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {warnings.length > 0 && !showErrorPanel && errorCount > 0 && (
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 sm:px-6">
                <AlertTriangle className="mr-2 inline h-4 w-4" />
                Ada {errorCount} soal bermasalah. Klik <strong>Cek Error</strong> untuk detail.
              </div>
            )}

            {embeddedImageCount > 0 && (
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:px-6">
                <p className="font-semibold">
                  <AlertTriangle className="mr-1.5 inline h-4 w-4" />
                  {embeddedImageCount} gambar terdeteksi di Word — URL wajib diisi
                </p>
                <p className="mt-1 text-xs text-amber-900/90">
                  File gambar tidak disimpan otomatis agar storage server tidak penuh. Unggah gambar ke hosting
                  (Drive/Imgur/CDN), lalu tempel URL di kolom gambar soal, opsi, atau pembahasan yang diminta.
                </p>
              </div>
            )}

            {/* Split: navigator + questions */}
            <div className="grid lg:grid-cols-[240px_minmax(0,1fr)]">
              {/* Sidebar navigator — desktop */}
              <aside className="hidden border-r border-slate-200 bg-slate-50/60 lg:block">
                <div className="sticky top-[9.5rem] max-h-[calc(100vh-10rem)] overflow-y-auto p-3">
                  <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Navigasi soal</p>
                  <div className="space-y-1">
                    {questions.map((_, questionIndex) => {
                      const rowNumber = questionIndex + 1;
                      const hasError = errorRows.has(rowNumber);
                      const visible =
                        rowFilter === 'all' ||
                        (rowFilter === 'error' && hasError) ||
                        (rowFilter === 'ok' && !hasError);
                      if (!visible) return null;

                      return (
                        <button
                          key={questionIndex}
                          type="button"
                          onClick={() => scrollToQuestion(rowNumber)}
                          className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition hover:bg-white hover:shadow-sm ${
                            highlightedRow === rowNumber ? 'bg-brand-100 ring-1 ring-brand-300' : 'bg-transparent'
                          }`}
                        >
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                              hasError ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {rowNumber}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-slate-800">Soal {rowNumber}</span>
                            <span className="text-[10px] text-slate-500">CSV baris {csvRowNumber(questionIndex)}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </aside>

              {/* Mobile jump bar */}
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 lg:hidden">
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {questions.map((_, questionIndex) => {
                    const rowNumber = questionIndex + 1;
                    const hasError = errorRows.has(rowNumber);
                    const visible =
                      rowFilter === 'all' ||
                      (rowFilter === 'error' && hasError) ||
                      (rowFilter === 'ok' && !hasError);
                    if (!visible) return null;

                    return (
                      <button
                        key={questionIndex}
                        type="button"
                        onClick={() => scrollToQuestion(rowNumber)}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold ${
                          hasError ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {rowNumber}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Question list */}
              <div className="space-y-5 p-4 sm:p-6">
                {filteredQuestions.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
                    Tidak ada soal pada filter ini.
                  </div>
                )}

                {filteredQuestions.map(({ question, questionIndex }) => {
                  const rowNumber = questionIndex + 1;
                  const rowWarnings = warningsByRow.get(rowNumber) ?? [];
                  const blockingWarnings = rowWarnings.filter((warning) => !NON_BLOCKING_WARNING_FIELDS.has(warning.field));
                  const isOk = blockingWarnings.length === 0;
                  const isHighlighted = highlightedRow === rowNumber;
                  const options = ensureFiveOptions(question.options);
                  const correctIndex = options.findIndex((option) => option.isCorrect);
                  const correctLabel = correctIndex >= 0 ? OPTION_LABELS[correctIndex] : null;

                  return (
                    <article
                      key={questionIndex}
                      ref={(element) => {
                        questionRefs.current[questionIndex] = element;
                      }}
                      className={`scroll-mt-36 overflow-hidden rounded-2xl border bg-white shadow-sm transition-all ${
                        isHighlighted
                          ? 'border-red-400 ring-2 ring-red-200'
                          : isOk
                            ? 'border-slate-200'
                            : 'border-amber-300'
                      }`}
                    >
                      {/* Card header */}
                      <div
                        className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5 ${
                          isOk ? 'bg-slate-50/80' : 'bg-amber-50/80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${
                              isOk ? 'bg-brand-600 text-white' : 'bg-amber-500 text-white'
                            }`}
                          >
                            {question.order ?? rowNumber}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-900">Soal {question.order ?? rowNumber}</p>
                            <p className="text-[11px] text-slate-500">
                              Baris CSV <span className="font-mono font-semibold">{csvRowNumber(questionIndex)}</span>
                              {correctLabel && (
                                <span className="ml-2 text-emerald-700">· Kunci: {correctLabel}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <QuestionStatusBadge isOk={isOk} errorCount={blockingWarnings.length} />
                      </div>

                      <div className="space-y-5 p-4 sm:p-5">
                        {!isOk && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-xs text-amber-900">
                            {blockingWarnings.map((warning, index) => (
                              <p key={`${warning.field}-${index}`}>
                                <span className="font-semibold">{FIELD_LABELS[warning.field] ?? warning.field}:</span>{' '}
                                {warning.message}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Pertanyaan + URL foto soal di bawah preview */}
                        <div>
                          <label
                            className={`mb-1.5 block text-xs font-semibold uppercase tracking-wide ${
                              hasFieldError(rowNumber, 'prompt') ? 'text-red-600' : 'text-slate-500'
                            }`}
                          >
                            Pertanyaan (teks opsional jika ada gambar)
                          </label>
                          <Textarea
                            value={question.prompt}
                            onChange={(event) => updateQuestion(questionIndex, { prompt: event.target.value })}
                            rows={4}
                            placeholder="Kosongkan jika soal hanya berupa gambar"
                            className={`min-h-[6rem] resize-y text-sm leading-relaxed ${
                              hasFieldError(rowNumber, 'prompt') ? 'border-red-400 bg-red-50/30' : ''
                            }`}
                          />
                          <CollapsibleUrlPhotoField
                            label="URL foto soal"
                            value={question.imageUrl ?? ''}
                            onChange={(value) => updateQuestion(questionIndex, { imageUrl: value || null })}
                            placeholder="https://contoh.com/soal.jpg"
                            previewAlt={`Foto soal ${rowNumber}`}
                          />
                        </div>

                        {/* Opsi jawaban — URL foto tersembunyi per opsi */}
                        <div>
                          <p
                            className={`mb-2 text-xs font-semibold uppercase tracking-wide ${
                              hasFieldError(rowNumber, 'options') || hasFieldError(rowNumber, 'correct')
                                ? 'text-red-600'
                                : 'text-slate-500'
                            }`}
                          >
                            Pilihan jawaban — centang kunci (bisa lebih dari satu)
                          </p>
                          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-2 sm:p-3">
                            {options.map((option, optionIndex) => {
                              const isCorrect = Boolean(option.isCorrect);
                              const letter = OPTION_LABELS[optionIndex];
                              return (
                                <div
                                  key={optionIndex}
                                  className={`rounded-xl border bg-white p-2.5 transition ${
                                    isCorrect
                                      ? 'border-brand-400 bg-brand-50/40 ring-1 ring-brand-200'
                                      : 'border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <label className="flex cursor-pointer items-start gap-3 sm:items-center">
                                    <span
                                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                                        isCorrect ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
                                      }`}
                                    >
                                      {letter}
                                    </span>
                                    <Input
                                      value={option.label}
                                      onChange={(event) => updateOption(questionIndex, optionIndex, event.target.value)}
                                      className={`min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 ${
                                        hasFieldError(rowNumber, 'options') || hasFieldError(rowNumber, 'correct')
                                          ? 'text-red-900'
                                          : ''
                                      }`}
                                      placeholder={`Teks opsi ${letter}`}
                                    />
                                    <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-600">
                                      <input
                                        type="checkbox"
                                        checked={isCorrect}
                                        onChange={() => toggleCorrectOption(questionIndex, optionIndex)}
                                        className="h-4 w-4 accent-brand-600"
                                      />
                                      <span className={isCorrect ? 'font-semibold text-brand-700' : ''}>Kunci</span>
                                    </span>
                                  </label>
                                  <CollapsibleUrlPhotoField
                                    label={`URL foto opsi ${letter}`}
                                    value={option.imageUrl ?? ''}
                                    onChange={(value) => updateOptionImage(questionIndex, optionIndex, value)}
                                    placeholder={`https://contoh.com/opsi-${letter?.toLowerCase()}.jpg`}
                                    previewAlt={`Foto opsi ${letter}`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Pembahasan + URL foto pembahasan di bawah preview */}
                        <div>
                          <label
                            className={`mb-1.5 block text-xs font-semibold uppercase tracking-wide ${
                              hasFieldError(rowNumber, 'explanation') ? 'text-red-600' : 'text-slate-500'
                            }`}
                          >
                            Pembahasan (teks opsional jika ada gambar)
                          </label>
                          <Textarea
                            value={question.explanation ?? ''}
                            onChange={(event) => updateQuestion(questionIndex, { explanation: event.target.value })}
                            rows={3}
                            placeholder="Kosongkan jika pembahasan hanya berupa gambar"
                            className={`min-h-[5rem] resize-y text-sm leading-relaxed ${
                              hasFieldError(rowNumber, 'explanation') ? 'border-red-400 bg-red-50/30' : ''
                            }`}
                          />
                          <CollapsibleUrlPhotoField
                            label="URL foto pembahasan"
                            value={question.explanationImageUrl ?? ''}
                            onChange={(value) =>
                              updateQuestion(questionIndex, { explanationImageUrl: value || null })
                            }
                            placeholder="https://contoh.com/pembahasan.jpg"
                            previewAlt={`Foto pembahasan ${rowNumber}`}
                          />
                        </div>
                      </div>
                    </article>
                  );
                })}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-800">Langkah berikutnya</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5">
                    <li>Perbaiki soal yang bertanda error (gunakan navigasi kiri untuk loncat cepat).</li>
                    <li>Klik <strong>Download CSV</strong>.</li>
                    <li>Upload CSV ke menu <strong>Tryouts & Tes</strong> atau <strong>Latihan & Tugas</strong>.</li>
                  </ol>
                  {hasBlockingWarnings && (
                    <p className="mt-2 text-xs text-amber-700">
                      Masih ada peringatan penting. Perbaiki dulu sebelum publish.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
