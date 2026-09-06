import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { ContactConfig } from '@/types/content';

export function useContactConfig() {
  return useQuery({
    queryKey: ['contact-config'],
    queryFn: () => apiGet<ContactConfig>('/landing/contact-info'),
    staleTime: 1000 * 60 * 30,
  });
}
