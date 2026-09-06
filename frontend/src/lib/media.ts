import { API_BASE_ORIGIN } from './api';

const ABSOLUTE_PATTERN = /^(?:https?:)?\/\//i;

function isAbsolutePath(value: string) {
  return value.startsWith('blob:') || value.startsWith('data:') || ABSOLUTE_PATTERN.test(value);
}

export function getAssetUrl(path?: string | null) {
  if (!path) {
    return '';
  }
  if (isAbsolutePath(path)) {
    return path;
  }
  return `${API_BASE_ORIGIN ?? ''}${path}`;
}
