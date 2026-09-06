/** 10 kolom × 5 ikon — sesuai lembar referensi KOLOM 1–10 */
export const CERMAT_IMAGE_COLUMNS = [
  ['bulu-tangkis', 'bola-voly', 'sarung-tinju', 'bowling', 'sepatu'],
  ['larangan-jalan', 'larangan-merokok', 'larangan-mobil', 'larangan-sampah', 'larangan-kosong'],
  ['emoji-lidah', 'emoji-kacamata', 'emoji-baik', 'emoji-datar', 'emoji-senang'],
  ['apel', 'semangka', 'anggur', 'alpukat', 'pisang'],
  ['pesawat', 'mobil', 'kapal', 'bus', 'kereta-api'],
  ['diagram-batang', 'panah-naik', 'donut-chart', 'diagram-turun', 'garis-naik'],
  ['topi', 'sepatu-olahraga', 'baju', 'tas', 'celana'],
  ['gitar', 'harpa', 'suling', 'drum', 'piano'],
  ['kucing', 'ikan', 'jerapah', 'ayam', 'burung'],
  ['saturnus', 'bulan-sabit', 'bulan-purnama', 'bintang', 'matahari'],
] as const;

export const CERMAT_IMAGE_ICON_KEYS = new Set(CERMAT_IMAGE_COLUMNS.flat());

export function isCermatImageIcon(name: string) {
  return (CERMAT_IMAGE_ICON_KEYS as Set<string>).has(name);
}
