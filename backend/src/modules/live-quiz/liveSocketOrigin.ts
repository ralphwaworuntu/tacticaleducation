/** Origin aplikasi produksi. Tetap diizinkan walau FRONTEND_URL di server belum memuatnya. */
const PRODUCTION_APP_ORIGINS = ['https://app.tacticaleducation.id'];

export function normalizeOrigin(value: string) {
  return value.trim().replace(/\/+$/, '');
}

export function isLiveSocketOriginAllowed(
  origin: string | undefined,
  config: { nodeEnv: string; frontendUrl: string; appUrl: string },
) {
  if (!origin || config.nodeEnv !== 'production') return true;
  const allowed = new Set<string>();
  for (const value of [...config.frontendUrl.split(','), config.appUrl, ...PRODUCTION_APP_ORIGINS]) {
    const normalized = normalizeOrigin(value);
    if (normalized) allowed.add(normalized);
  }
  return allowed.has(normalizeOrigin(origin));
}
