import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { ExamSectionStatus } from '@/types/exam';

export function useExamControlStatus() {
  return useQuery<ExamSectionStatus>({
    queryKey: ['exam-control-status'],
    queryFn: () => apiGet<ExamSectionStatus>('/dashboard/exam-control'),
    retry: 1,
  });
}
