import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { ExamBlockConfig } from '@/types/exam';

export function useExamBlockConfig(enabled = true, basePath = '/exams') {
  return useQuery({
    queryKey: ['exam-block-config', basePath],
    queryFn: () => apiGet<ExamBlockConfig>(`${basePath}/block-config`),
    enabled,
    staleTime: 30000,
  });
}
