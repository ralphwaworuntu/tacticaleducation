/** Bank kolom gambar. Satu pengerjaan hanya memakai totalSessions kolom acak. */
export const CERMAT_IMAGE_COLUMNS = [
  ['bulu-tangkis', 'bola-voly', 'sarung-tinju', 'pin-bowling', 'bowling', 'sepatu'],
  ['larangan-jalan', 'larangan-merokok', 'larangan-mobil', 'larangan-mobil-2', 'larangan-sampah', 'larangan-kosong'],
  ['emoji-lidah', 'emoji-kacamata', 'emoji-baik', 'emoji-senyum', 'emoji-datar', 'emoji-senang'],
  ['apel', 'semangka', 'anggur', 'keranjang-buah', 'alpukat', 'pisang'],
  ['pesawat', 'mobil', 'kapal', 'bus', 'kereta-api', 'taksi'],
  ['diagram-batang', 'panah-naik', 'donut-chart', 'diagram-turun', 'diagram-lingkaran', 'garis-naik'],
  ['topi', 'sepatu-olahraga', 'baju', 'tas', 'baju-polos', 'celana'],
  ['gitar', 'harpa', 'suling', 'drum', 'piano'],
  ['kucing', 'ikan', 'jerapah', 'ayam', 'burung', 'anjing'],
  ['saturnus', 'bulan-sabit', 'bulan-purnama', 'bintang', 'matahari'],
  ['burung-terbang', 'ayam-jago', 'jerapah-totol', 'kucing-duduk', 'ikan-badut'],
  ['apel-daun', 'pisang-ganda', 'jeruk', 'nanas', 'semangka-biji'],
  ['buku', 'pensil', 'penggaris', 'gunting', 'tas-sekolah'],
  ['kulkas', 'televisi', 'lampu', 'kipas', 'kursi'],
  ['piano-tegak', 'gitar-akustik', 'biola', 'terompet', 'drum-snare'],
  ['kapal-feri', 'kereta-uap', 'pesawat-penumpang', 'mobil-sedan', 'sepeda'],
  ['bola-basket', 'raket-bulu-tangkis', 'dumbbell', 'sarung-tinju-samping', 'sepatu-lari'],
  ['panci', 'wajan', 'teko', 'blender', 'spatula'],
  ['mawar', 'bunga-matahari', 'tulip', 'anggrek', 'kembang-sepatu'],
  ['palu', 'gergaji', 'obeng', 'tang', 'kunci-inggris'],
] as const;

export const CERMAT_IMAGE_ICON_KEYS = new Set(CERMAT_IMAGE_COLUMNS.flat());

export function isCermatImageIcon(name: string) {
  return (CERMAT_IMAGE_ICON_KEYS as Set<string>).has(name);
}
