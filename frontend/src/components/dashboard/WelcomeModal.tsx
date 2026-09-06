import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { getAssetUrl } from '@/lib/media';

type WelcomeModalConfig = {
  id?: string;
  enabled: boolean;
  imageUrl?: string | null;
  linkUrl?: string | null;
};

export function WelcomeModal() {
  const [blockedKey, setBlockedKey] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ['welcome-modal'],
    queryFn: () => apiGet<WelcomeModalConfig>('/dashboard/welcome-modal'),
  });
  const modalKey = data?.enabled && data.imageUrl ? `welcome-modal-${data.id ?? data.imageUrl}` : null;
  const open = Boolean(modalKey && modalKey !== blockedKey);

  if (!open || !data?.imageUrl) return null;

  const content = (
    <img src={getAssetUrl(data.imageUrl)} alt="Welcome" className="max-h-[80vh] w-full rounded-3xl object-cover" />
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 px-4">
      <div className="relative w-full max-w-3xl">
        <button
          type="button"
          className="absolute -right-3 -top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-lg font-bold text-slate-700 shadow"
          onClick={() => {
            if (modalKey) {
              setBlockedKey(modalKey);
            }
          }}
        >
          X
        </button>
        {data.linkUrl ? (
          <a href={data.linkUrl} target="_blank" rel="noreferrer">
            {content}
          </a>
        ) : (
          content
        )}
      </div>
    </div>
  );
}
