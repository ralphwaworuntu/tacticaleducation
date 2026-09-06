export type ParsedOption = {
  label: string;
  imageUrl?: string | null;
  isCorrect?: boolean;
};

export type ParsedQuestion = {
  prompt: string;
  imageUrl?: string | null;
  explanation?: string | null;
  explanationImageUrl?: string | null;
  order?: number;
  options: ParsedOption[];
  /** Marker [GAMBAR] di soal — wajib isi URL (gambar Word tidak disimpan otomatis). */
  requiresPromptImage?: boolean;
  /** Marker [GAMBAR] di pembahasan — wajib isi URL. */
  requiresExplanationImage?: boolean;
};

export type ConversionWarning = {
  row: number;
  field: string;
  message: string;
};

/** Teks atau gambar saja sudah cukup (soal / opsi / pembahasan berbasis foto). */
export function hasPromptContent(question: Pick<ParsedQuestion, 'prompt' | 'imageUrl'>) {
  return Boolean(question.prompt?.trim() || question.imageUrl?.trim());
}

export function hasExplanationContent(question: Pick<ParsedQuestion, 'explanation' | 'explanationImageUrl'>) {
  return Boolean(question.explanation?.trim() || question.explanationImageUrl?.trim());
}

export function hasOptionContent(option: Pick<ParsedOption, 'label' | 'imageUrl'>) {
  return Boolean(option.label?.trim() || option.imageUrl?.trim());
}

export function countFilledOptions(options: ParsedOption[]) {
  return options.filter(hasOptionContent).length;
}

export const OPTION_KEY_ORDER = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e'] as const;

export const CSV_HEADERS = [
  'prompt',
  'prompt_image',
  'explanation',
  'explanationImageUrl',
  'order',
  'option_a',
  'option_a_image',
  'option_a_correct',
  'option_b',
  'option_b_image',
  'option_b_correct',
  'option_c',
  'option_c_image',
  'option_c_correct',
  'option_d',
  'option_d_image',
  'option_d_correct',
  'option_e',
  'option_e_image',
  'option_e_correct',
] as const;

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (!text) return '';
  // Selalu quote teks non-kosong agar @!$%^&*()_+,"=\n dll aman di Excel/CSV.
  return `"${text.replace(/"/g, '""')}"`;
}

function formatCorrect(value: boolean | undefined): string {
  return value ? 'TRUE' : 'FALSE';
}

export function serializeExamCsv(questions: ParsedQuestion[]): string {
  const lines = [CSV_HEADERS.join(',')];

  questions.forEach((question, index) => {
    const order = question.order ?? index + 1;
    const row: Record<string, string> = {
      prompt: question.prompt ?? '',
      prompt_image: question.imageUrl ?? '',
      explanation: question.explanation ?? '',
      explanationImageUrl: question.explanationImageUrl ?? '',
      order: String(order),
    };

    OPTION_KEY_ORDER.forEach((key, optionIndex) => {
      const option = question.options[optionIndex];
      row[key] = option?.label ?? '';
      row[`${key}_image`] = option?.imageUrl ?? '';
      row[`${key}_correct`] = option ? formatCorrect(option.isCorrect) : 'FALSE';
    });

    lines.push(CSV_HEADERS.map((header) => escapeCsvCell(row[header])).join(','));
  });

  return `\ufeff${lines.join('\n')}`;
}

const IMAGE_OPTION_LABEL = /^gambar\s*[a-e]$/i;
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

export function isImageOptionLabel(label: string | null | undefined) {
  return IMAGE_OPTION_LABEL.test((label ?? '').trim());
}

export function validateQuestions(questions: ParsedQuestion[]): ConversionWarning[] {
  const warnings: ConversionWarning[] = [];

  if (!questions.length) {
    warnings.push({ row: 0, field: 'document', message: 'Tidak ada soal terdeteksi dalam dokumen.' });
    return warnings;
  }

  questions.forEach((question, index) => {
    const row = index + 1;

    if (!hasPromptContent(question)) {
      warnings.push({ row, field: 'prompt', message: 'Pertanyaan kosong — isi teks atau URL gambar soal.' });
    }

    if (!hasExplanationContent(question)) {
      warnings.push({
        row,
        field: 'explanation',
        message: 'Pembahasan wajib — isi teks atau URL gambar pembahasan.',
      });
    }

    if (countFilledOptions(question.options) < 2) {
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
      .map((option, optionIndex) => ({ option, letter: OPTION_LETTERS[optionIndex] }))
      .filter(({ option }) => isImageOptionLabel(option.label) && !option.imageUrl?.trim());

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
