import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { MembershipStatus } from '@/types/exam';

export function useMembershipStatus(enabled = true) {
  return useQuery({
    queryKey: ['membership-status'],
    queryFn: () => apiGet<MembershipStatus>('/commerce/membership/status'),
    staleTime: 1000 * 60 * 5,
    enabled,
  });
}
