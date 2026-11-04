import { API_BASE_URL } from '@/lib/api';

export async function uploadLivePlayerAvatar(sessionId: string, playerToken: string, blob: Blob) {
  const form = new FormData();
  form.append('avatar', blob, 'avatar.jpg');
  const response = await fetch(`${API_BASE_URL}/live/sessions/${sessionId}/avatar`, {
    method: 'POST',
    headers: { 'x-player-token': playerToken },
    body: form,
  });
  const json = (await response.json().catch(() => null)) as
    | { status?: string; data?: { avatarUrl?: string; avatarId?: string }; message?: string }
    | null;
  if (!response.ok || !json?.data?.avatarUrl) {
    throw new Error(json?.message || 'Gagal menyimpan avatar.');
  }
  return json.data as { avatarUrl: string; avatarId?: string };
}
