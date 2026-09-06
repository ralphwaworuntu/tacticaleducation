import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { ExamBlock } from '@/types/exam';

export function useExamBlocks(enabled = true, basePath = '/exams') {
  return useQuery({
    queryKey: ['exam-blocks', basePath],
    queryFn: () => apiGet<ExamBlock[]>(`${basePath}/blocks`),
    enabled,
    refetchInterval: 30000,
  });
}
