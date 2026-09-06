export function buildExamSubmitPayload(answers: Record<string, string[]>) {
  return Object.entries(answers)
    .filter(([, ids]) => ids.length > 0)
    .map(([questionId, optionIds]) => ({
      questionId,
      optionIds,
      optionId: optionIds.length === 1 ? optionIds[0] : undefined,
    }));
}

export function toggleMultiAnswer(prev: Record<string, string[]>, questionId: string, optionId: string): Record<string, string[]> {
  const current = prev[questionId] ?? [];
  const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
  return { ...prev, [questionId]: next };
}

export function setSingleAnswer(prev: Record<string, string[]>, questionId: string, optionId: string): Record<string, string[]> {
  return { ...prev, [questionId]: [optionId] };
}

export function isQuestionAnswered(answers: Record<string, string[]>, questionId: string): boolean {
  return (answers[questionId]?.length ?? 0) > 0;
}

export function getUserSelectedIds(question: { userOptionIds?: string[]; userOptionId?: string | null }): string[] {
  if (question.userOptionIds?.length) return question.userOptionIds;
  return question.userOptionId ? [question.userOptionId] : [];
}

export function getGradeBadge(question: {
  isCorrect: boolean;
  gradeStatus?: 'correct' | 'incorrect';
}) {
  if (question.gradeStatus === 'correct' || question.isCorrect) {
    return {
      label: 'Benar',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }
  return {
    label: 'Salah',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
  };
}
