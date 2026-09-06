type GradableOption = { id?: string; isCorrect?: boolean };

export type GradeStatus = 'correct' | 'incorrect';

export type GradeResult = {
  /** 0 atau 1 — multi-jawaban hanya benar jika himpunan pilihan = kunci. */
  credit: number;
  isCorrect: boolean;
  status: GradeStatus;
};

export function countCorrectOptions(options: GradableOption[]): number {
  return options.filter((option) => option.isCorrect).length;
}

export function questionHasMultipleCorrect(options: GradableOption[]): boolean {
  return countCorrectOptions(options) > 1;
}

export function getCorrectOptionIds(options: Array<{ id: string; isCorrect: boolean }>): string[] {
  return options.filter((option) => option.isCorrect).map((option) => option.id);
}

export function normalizeSelectedOptionIds(input: { optionId?: string | null; optionIds?: string[] | null }): string[] {
  if (Array.isArray(input.optionIds) && input.optionIds.length) {
    return [...new Set(input.optionIds.filter(Boolean))];
  }
  if (input.optionId) {
    return [input.optionId];
  }
  return [];
}

export function parseStoredAnswerIds(answer: { optionId?: string | null; selectedOptionIds?: unknown }): string[] {
  const stored = Array.isArray(answer.selectedOptionIds) ? (answer.selectedOptionIds as string[]) : [];
  if (stored.length) return stored;
  return answer.optionId ? [answer.optionId] : [];
}

/**
 * Aturan skor (semua-atau-tidak):
 * - Benar hanya jika pilihan tepat sama dengan kunci (mis. 2 kunci → harus pilih keduanya, tanpa opsi salah).
 * - 1 benar + 1 salah, kurang lengkap, atau kelebihan pilihan → salah (credit 0).
 */
export function gradeAnswerDetailed(selectedIds: string[], correctIds: string[]): GradeResult {
  if (!correctIds.length) {
    return { credit: 0, isCorrect: false, status: 'incorrect' };
  }

  if (selectedIds.length !== correctIds.length) {
    return { credit: 0, isCorrect: false, status: 'incorrect' };
  }

  const selected = new Set(selectedIds);
  const isCorrect = correctIds.every((id) => selected.has(id));

  return isCorrect
    ? { credit: 1, isCorrect: true, status: 'correct' }
    : { credit: 0, isCorrect: false, status: 'incorrect' };
}

/** Kompatibilitas: true hanya jika skor penuh. */
export function gradeAnswer(selectedIds: string[], correctIds: string[]): boolean {
  return gradeAnswerDetailed(selectedIds, correctIds).isCorrect;
}
