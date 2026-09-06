import type { ReactNode } from 'react';

type SvgProps = { className?: string };

const S = { stroke: 'currentColor', strokeWidth: 2, fill: 'none' as const };

function Frame({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

/** Rambu larangan: lingkaran + garis diagonal */
function NoSign({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <Frame className={className}>
      <circle cx="32" cy="32" r="23" {...S} strokeWidth={2.5} />
      <line x1="14" y1="50" x2="50" y2="14" stroke="currentColor" strokeWidth={2.5} />
      {children}
    </Frame>
  );
}

export const CERMAT_IMAGE_SVGS: Record<string, (props: SvgProps) => React.ReactElement> = {
  /* ── KOLOM 1: Olahraga ── */
  'bulu-tangkis': (p) => (
    <Frame className={p.className}>
      {/* Raket */}
      <ellipse cx="24" cy="28" rx="11" ry="14" {...S} />
      <line x1="24" y1="42" x2="24" y2="54" {...S} strokeLinecap="round" />
      <line x1="18" y1="22" x2="30" y2="34" {...S} />
      <line x1="30" y1="22" x2="18" y2="34" {...S} />
      <line x1="24" y1="18" x2="24" y2="38" {...S} />
      {/* Shuttlecock */}
      <circle cx="44" cy="46" r="4" {...S} />
      <path d="M44 42 L40 30 M44 42 L44 28 M44 42 L48 30" {...S} strokeLinecap="round" />
    </Frame>
  ),

  'bola-voly': (p) => (
    <Frame className={p.className}>
      <circle cx="32" cy="32" r="20" {...S} />
      <path d="M32 12 C22 20 22 44 32 52" {...S} />
      <path d="M32 12 C42 20 42 44 32 52" {...S} />
      <path d="M14 26 C22 32 22 38 14 44" {...S} />
      <path d="M50 26 C42 32 42 38 50 44" {...S} />
    </Frame>
  ),

  'sarung-tinju': (p) => (
    <Frame className={p.className}>
      <path
        d="M22 52 C18 52 16 46 18 38 C20 28 28 20 36 20 C42 20 46 26 46 34 C46 42 42 48 36 50 L34 52 Z"
        {...S}
      />
      <path d="M36 50 L38 56 H30 L32 50" {...S} />
      <path d="M28 28 C26 32 26 38 28 42" {...S} strokeLinecap="round" />
    </Frame>
  ),

  bowling: (p) => (
    <Frame className={p.className}>
      <circle cx="32" cy="34" r="18" {...S} />
      <circle cx="26" cy="28" r="2.5" fill="currentColor" />
      <circle cx="34" cy="26" r="2.5" fill="currentColor" />
      <circle cx="38" cy="32" r="2.5" fill="currentColor" />
    </Frame>
  ),

  sepatu: (p) => (
    <Frame className={p.className}>
      <path d="M12 42 H48 C52 42 54 44 54 48 H12 V42 Z" {...S} />
      <path d="M16 42 L22 26 H36 L42 42" {...S} />
      <path d="M24 30 L26 34 M30 28 L32 34 M36 30 L38 34" {...S} strokeLinecap="round" />
      <path d="M12 48 H54" {...S} strokeWidth={3} />
    </Frame>
  ),

  /* ── KOLOM 2: Larangan ── */
  'larangan-jalan': (p) => (
    <NoSign className={p.className}>
      <circle cx="32" cy="22" r="4" fill="currentColor" />
      <line x1="32" y1="26" x2="32" y2="38" stroke="currentColor" strokeWidth={2.5} />
      <line x1="32" y1="32" x2="26" y2="38" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
      <line x1="32" y1="32" x2="38" y2="38" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
    </NoSign>
  ),

  'larangan-merokok': (p) => (
    <NoSign className={p.className}>
      <rect x="20" y="32" width="18" height="5" rx="1" fill="currentColor" />
      <path d="M38 34 H44" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M44 30 Q48 28 46 34 Q48 40 44 38" {...S} strokeWidth={1.5} />
    </NoSign>
  ),

  'larangan-mobil': (p) => (
    <NoSign className={p.className}>
      <path d="M18 36 H46 L42 28 H22 Z" fill="currentColor" />
      <rect x="18" y="36" width="28" height="8" rx="1" fill="currentColor" />
      <circle cx="24" cy="44" r="3" fill="white" stroke="currentColor" strokeWidth={1.5} />
      <circle cx="40" cy="44" r="3" fill="white" stroke="currentColor" strokeWidth={1.5} />
    </NoSign>
  ),

  'larangan-sampah': (p) => (
    <NoSign className={p.className}>
      <path d="M28 24 H36 L34 40 H30 Z" fill="currentColor" />
      <line x1="26" y1="24" x2="38" y2="24" stroke="currentColor" strokeWidth={2} />
      <line x1="30" y1="20" x2="34" y2="20" stroke="currentColor" strokeWidth={2} />
      <circle cx="40" cy="18" r="3" fill="currentColor" />
      <path d="M42 16 L46 12" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </NoSign>
  ),

  'larangan-kosong': (p) => (
    <NoSign className={p.className}>
      <rect x="24" y="26" width="16" height="16" rx="2" {...S} strokeWidth={2.5} strokeDasharray="4 3" />
    </NoSign>
  ),

  /* ── KOLOM 3: Emoji ── */
  'emoji-lidah': (p) => (
    <Frame className={p.className}>
      <circle cx="32" cy="32" r="22" {...S} />
      <circle cx="24" cy="28" r="2.5" fill="currentColor" />
      <path d="M38 28 L42 26" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M22 36 Q32 42 40 36" {...S} />
      <path d="M36 38 Q40 44 38 50 Q34 48 36 38" fill="currentColor" />
    </Frame>
  ),

  'emoji-kacamata': (p) => (
    <Frame className={p.className}>
      <circle cx="32" cy="32" r="22" {...S} />
      <rect x="16" y="26" width="14" height="10" rx="2" fill="currentColor" />
      <rect x="34" y="26" width="14" height="10" rx="2" fill="currentColor" />
      <line x1="30" y1="31" x2="34" y2="31" stroke="currentColor" strokeWidth={2} />
      <path d="M22 40 Q32 46 42 40" {...S} />
    </Frame>
  ),

  'emoji-baik': (p) => (
    <Frame className={p.className}>
      <ellipse cx="32" cy="14" rx="12" ry="4" {...S} />
      <circle cx="32" cy="34" r="20" {...S} />
      <circle cx="24" cy="30" r="2.5" fill="currentColor" />
      <circle cx="40" cy="30" r="2.5" fill="currentColor" />
      <path d="M24 40 Q32 46 40 40" {...S} />
    </Frame>
  ),

  'emoji-datar': (p) => (
    <Frame className={p.className}>
      <circle cx="32" cy="32" r="22" {...S} />
      <circle cx="24" cy="28" r="2.5" fill="currentColor" />
      <circle cx="40" cy="28" r="2.5" fill="currentColor" />
      <line x1="24" y1="40" x2="40" y2="40" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
    </Frame>
  ),

  'emoji-senang': (p) => (
    <Frame className={p.className}>
      <circle cx="32" cy="32" r="22" {...S} />
      <path d="M20 26 Q24 30 28 26" {...S} strokeLinecap="round" />
      <path d="M36 26 Q40 30 44 26" {...S} strokeLinecap="round" />
      <path d="M20 38 Q32 52 44 38" {...S} strokeLinecap="round" />
    </Frame>
  ),

  /* ── KOLOM 4: Buah ── */
  apel: (p) => (
    <Frame className={p.className}>
      <path
        d="M32 14 C22 14 16 24 16 34 C16 46 22 52 32 52 C42 52 48 46 48 34 C48 24 42 14 32 14 Z"
        {...S}
      />
      <path d="M32 14 V8" {...S} strokeLinecap="round" />
      <path d="M32 8 Q38 6 40 10" {...S} strokeLinecap="round" />
      <path d="M38 8 Q42 10 40 14" fill="currentColor" opacity={0.8} />
    </Frame>
  ),

  semangka: (p) => (
    <Frame className={p.className}>
      <path d="M10 42 C18 22 46 22 54 42 Z" {...S} />
      <path d="M10 42 H54" {...S} strokeWidth={3} />
      <circle cx="26" cy="36" r="1.5" fill="currentColor" />
      <circle cx="32" cy="32" r="1.5" fill="currentColor" />
      <circle cx="38" cy="36" r="1.5" fill="currentColor" />
      <circle cx="30" cy="38" r="1.5" fill="currentColor" />
      <circle cx="36" cy="34" r="1.5" fill="currentColor" />
    </Frame>
  ),

  anggur: (p) => (
    <Frame className={p.className}>
      <line x1="32" y1="12" x2="32" y2="22" {...S} strokeLinecap="round" />
      <circle cx="24" cy="28" r="5" {...S} />
      <circle cx="32" cy="24" r="5" {...S} />
      <circle cx="40" cy="28" r="5" {...S} />
      <circle cx="28" cy="36" r="5" {...S} />
      <circle cx="36" cy="36" r="5" {...S} />
      <circle cx="32" cy="44" r="5" {...S} />
    </Frame>
  ),

  alpukat: (p) => (
    <Frame className={p.className}>
      <path
        d="M32 12 C20 12 14 26 14 36 C14 48 20 54 32 54 C44 54 50 48 50 36 C50 26 44 12 32 12 Z"
        {...S}
      />
      <circle cx="32" cy="38" r="10" {...S} />
      <circle cx="32" cy="38" r="5" fill="currentColor" />
    </Frame>
  ),

  pisang: (p) => (
    <Frame className={p.className}>
      <path
        d="M36 14 C28 16 20 28 18 40 C16 48 20 54 28 52 C34 50 38 42 40 32 C42 22 40 14 36 14 Z"
        {...S}
      />
      <path
        d="M40 16 C34 18 28 28 26 38 C24 46 28 52 34 50 C38 48 42 40 44 30 C45 22 44 16 40 16 Z"
        {...S}
      />
    </Frame>
  ),

  /* ── KOLOM 5: Transportasi ── */
  pesawat: (p) => (
    <Frame className={p.className}>
      <path d="M8 32 H56 L44 26 V16 L32 20 L20 16 V26 Z" {...S} />
      <line x1="32" y1="20" x2="32" y2="48" {...S} />
      <path d="M32 48 L24 54 M32 48 L40 54" {...S} strokeLinecap="round" />
    </Frame>
  ),

  mobil: (p) => (
    <Frame className={p.className}>
      <path d="M14 36 H50 L46 26 H18 Z" {...S} />
      <rect x="14" y="36" width="36" height="10" rx="2" {...S} />
      <line x1="22" y1="36" x2="22" y2="26" {...S} />
      <line x1="42" y1="36" x2="42" y2="26" {...S} />
      <circle cx="22" cy="46" r="4" {...S} />
      <circle cx="42" cy="46" r="4" {...S} />
    </Frame>
  ),

  kapal: (p) => (
    <Frame className={p.className}>
      <path d="M8 40 H56 L48 28 H16 Z" {...S} />
      <rect x="20" y="20" width="8" height="8" {...S} />
      <rect x="30" y="18" width="8" height="10" {...S} />
      <rect x="40" y="20" width="8" height="8" {...S} />
      <line x1="36" y1="18" x2="36" y2="10" {...S} />
      <path d="M34 10 H38 V14 H34 Z" fill="currentColor" />
      <path d="M8 40 Q32 48 56 40" {...S} />
    </Frame>
  ),

  bus: (p) => (
    <Frame className={p.className}>
      <rect x="14" y="16" width="36" height="28" rx="3" {...S} />
      <line x1="14" y1="28" x2="50" y2="28" {...S} />
      <rect x="18" y="18" width="8" height="8" {...S} />
      <rect x="28" y="18" width="8" height="8" {...S} />
      <rect x="38" y="18" width="8" height="8" {...S} />
      <rect x="18" y="30" width="8" height="8" {...S} />
      <rect x="28" y="30" width="8" height="8" {...S} />
      <rect x="38" y="30" width="8" height="8" {...S} />
      <circle cx="22" cy="48" r="4" {...S} />
      <circle cx="42" cy="48" r="4" {...S} />
    </Frame>
  ),

  'kereta-api': (p) => (
    <Frame className={p.className}>
      <path d="M8 36 H56 L52 28 H12 Z" {...S} />
      <path d="M12 28 H52 V24 C52 20 48 18 44 18 H20 C16 18 12 20 12 24 Z" {...S} />
      <rect x="18" y="30" width="10" height="6" {...S} />
      <rect x="36" y="30" width="10" height="6" {...S} />
      <circle cx="18" cy="46" r="4" {...S} />
      <circle cx="46" cy="46" r="4" {...S} />
    </Frame>
  ),

  /* ── KOLOM 6: Diagram ── */
  'diagram-batang': (p) => (
    <Frame className={p.className}>
      <line x1="10" y1="52" x2="54" y2="52" {...S} />
      <line x1="10" y1="52" x2="10" y2="14" {...S} />
      <rect x="16" y="38" width="10" height="14" fill="currentColor" />
      <rect x="30" y="28" width="10" height="24" fill="currentColor" />
      <rect x="44" y="18" width="10" height="34" fill="currentColor" />
    </Frame>
  ),

  'panah-naik': (p) => (
    <Frame className={p.className}>
      <polyline points="12,44 28,36 40,38 52,20" {...S} strokeWidth={2.5} />
      <polyline points="44,20 52,20 52,28" {...S} strokeWidth={2.5} strokeLinecap="round" />
    </Frame>
  ),

  'donut-chart': (p) => (
    <Frame className={p.className}>
      <circle cx="32" cy="32" r="18" {...S} strokeWidth={2.5} />
      <circle cx="32" cy="32" r="8" {...S} strokeWidth={2.5} />
      <line x1="32" y1="14" x2="32" y2="24" {...S} />
      <line x1="32" y1="40" x2="32" y2="50" {...S} />
      <line x1="14" y1="32" x2="24" y2="32" {...S} />
      <line x1="40" y1="32" x2="50" y2="32" {...S} />
    </Frame>
  ),

  'diagram-turun': (p) => (
    <Frame className={p.className}>
      <polyline points="12,22 28,28 42,24 52,38" {...S} strokeWidth={2.5} />
      <polyline points="44,38 52,38 52,30" {...S} strokeWidth={2.5} strokeLinecap="round" />
    </Frame>
  ),

  'garis-naik': (p) => (
    <Frame className={p.className}>
      <polyline points="10,48 22,38 34,42 46,28 54,18" {...S} strokeWidth={2.5} strokeLinejoin="round" />
    </Frame>
  ),

  /* ── KOLOM 7: Pakaian ── */
  topi: (p) => (
    <Frame className={p.className}>
      <path d="M18 36 C18 22 46 22 46 36" {...S} />
      <ellipse cx="32" cy="36" rx="22" ry="6" {...S} />
      <path d="M28 22 L32 14 L36 22" {...S} strokeLinecap="round" />
    </Frame>
  ),

  'sepatu-olahraga': (p) => (
    <Frame className={p.className}>
      <path d="M10 40 H50 C54 40 56 42 56 46 H10 V40 Z" {...S} />
      <path d="M14 40 L20 24 H34 L40 40" {...S} />
      <line x1="22" y1="28" x2="24" y2="32" {...S} strokeLinecap="round" />
      <line x1="28" y1="26" x2="30" y2="32" {...S} strokeLinecap="round" />
      <line x1="34" y1="28" x2="36" y2="32" {...S} strokeLinecap="round" />
    </Frame>
  ),

  baju: (p) => (
    <Frame className={p.className}>
      <path d="M24 16 L20 26 H14 L16 50 H48 L50 26 H44 L40 16 L32 22 Z" {...S} />
      <line x1="32" y1="22" x2="32" y2="50" {...S} />
    </Frame>
  ),

  tas: (p) => (
    <Frame className={p.className}>
      <rect x="18" y="22" width="28" height="32" rx="4" {...S} />
      <path d="M26 22 V16 C26 12 38 12 38 16 V22" {...S} />
      <rect x="24" y="30" width="16" height="12" rx="2" {...S} />
      <line x1="32" y1="34" x2="32" y2="38" {...S} />
    </Frame>
  ),

  celana: (p) => (
    <Frame className={p.className}>
      <path d="M20 14 H44 V22 L40 52 H34 L32 34 L30 52 H24 L20 22 Z" {...S} />
      <line x1="20" y1="18" x2="44" y2="18" {...S} />
      <circle cx="28" cy="18" r="2" fill="currentColor" />
      <circle cx="36" cy="18" r="2" fill="currentColor" />
    </Frame>
  ),

  /* ── KOLOM 8: Musik ── */
  gitar: (p) => (
    <Frame className={p.className}>
      <path
        d="M26 50 C20 50 16 44 16 36 C16 26 22 18 30 18 C34 18 38 22 38 28 C38 34 34 40 30 44"
        {...S}
      />
      <rect x="30" y="10" width="4" height="14" fill="currentColor" />
      <circle cx="28" cy="38" r="8" {...S} />
      <circle cx="28" cy="38" r="3" fill="currentColor" />
    </Frame>
  ),

  harpa: (p) => (
    <Frame className={p.className}>
      <path d="M22 50 V18 Q32 10 42 18 V50" {...S} strokeWidth={2.5} />
      <line x1="26" y1="22" x2="26" y2="46" {...S} strokeWidth={1.5} />
      <line x1="30" y1="20" x2="30" y2="48" {...S} strokeWidth={1.5} />
      <line x1="34" y1="20" x2="34" y2="48" {...S} strokeWidth={1.5} />
      <line x1="38" y1="22" x2="38" y2="46" {...S} strokeWidth={1.5} />
      <line x1="22" y1="50" x2="42" y2="50" {...S} />
    </Frame>
  ),

  suling: (p) => (
    <Frame className={p.className}>
      <rect x="14" y="28" width="36" height="8" rx="4" {...S} />
      <circle cx="22" cy="32" r="1.5" fill="currentColor" />
      <circle cx="28" cy="32" r="1.5" fill="currentColor" />
      <circle cx="34" cy="32" r="1.5" fill="currentColor" />
      <circle cx="40" cy="32" r="1.5" fill="currentColor" />
      <path d="M48 30 L54 28" {...S} strokeLinecap="round" />
    </Frame>
  ),

  drum: (p) => (
    <Frame className={p.className}>
      <ellipse cx="28" cy="38" rx="12" ry="5" {...S} />
      <path d="M16 38 V48 C16 52 22 54 28 54 C34 54 40 52 40 48 V38" {...S} />
      <ellipse cx="44" cy="24" rx="8" ry="3" {...S} />
      <line x1="44" y1="24" x2="44" y2="36" {...S} />
      <line x1="36" y1="36" x2="52" y2="36" {...S} strokeLinecap="round" />
    </Frame>
  ),

  piano: (p) => (
    <Frame className={p.className}>
      <path d="M10 36 H54 V48 H10 Z" {...S} />
      <path d="M10 36 L20 24 H44 L54 36" {...S} />
      <rect x="14" y="36" width="5" height="12" fill="currentColor" />
      <rect x="21" y="36" width="5" height="12" fill="currentColor" />
      <rect x="28" y="36" width="5" height="12" fill="currentColor" />
      <rect x="35" y="36" width="5" height="12" fill="currentColor" />
      <rect x="42" y="36" width="5" height="12" fill="currentColor" />
      <line x1="17" y1="24" x2="17" y2="18" {...S} strokeLinecap="round" />
      <line x1="47" y1="24" x2="47" y2="18" {...S} strokeLinecap="round" />
    </Frame>
  ),

  /* ── KOLOM 9: Hewan ── */
  kucing: (p) => (
    <Frame className={p.className}>
      <circle cx="32" cy="36" r="16" {...S} />
      <path d="M20 24 L24 34 L18 32 Z" fill="currentColor" />
      <path d="M44 24 L40 34 L46 32 Z" fill="currentColor" />
      <circle cx="26" cy="34" r="2.5" fill="currentColor" />
      <circle cx="38" cy="34" r="2.5" fill="currentColor" />
      <path d="M32 38 L32 42" {...S} strokeLinecap="round" />
      <line x1="22" y1="40" x2="16" y2="42" {...S} strokeLinecap="round" />
      <line x1="42" y1="40" x2="48" y2="42" {...S} strokeLinecap="round" />
    </Frame>
  ),

  ikan: (p) => (
    <Frame className={p.className}>
      <ellipse cx="28" cy="32" rx="16" ry="10" {...S} />
      <path d="M44 32 L56 22 V42 Z" fill="currentColor" />
      <circle cx="20" cy="30" r="2.5" fill="currentColor" />
      <path d="M24 26 Q28 32 24 38" {...S} strokeWidth={1.5} />
    </Frame>
  ),

  jerapah: (p) => (
    <Frame className={p.className}>
      <path d="M28 54 V32 C28 26 30 22 34 20 C38 18 42 20 42 26 V54" {...S} />
      <circle cx="36" cy="16" r="8" {...S} />
      <circle cx="34" cy="14" r="1.5" fill="currentColor" />
      <circle cx="40" cy="14" r="1.5" fill="currentColor" />
      <circle cx="32" cy="36" r="2" fill="currentColor" opacity={0.5} />
      <circle cx="36" cy="44" r="2" fill="currentColor" opacity={0.5} />
      <path d="M34 20 L32 14 M38 20 L40 14" {...S} strokeLinecap="round" />
    </Frame>
  ),

  ayam: (p) => (
    <Frame className={p.className}>
      <circle cx="32" cy="36" r="14" {...S} />
      <path d="M28 22 L32 14 L38 18 L36 24 Z" fill="currentColor" />
      <circle cx="28" cy="34" r="2" fill="currentColor" />
      <path d="M38 38 L48 40 L38 42 Z" fill="currentColor" />
      <path d="M26 48 L28 54 M38 48 L36 54" {...S} strokeLinecap="round" />
    </Frame>
  ),

  burung: (p) => (
    <Frame className={p.className}>
      <path d="M14 36 Q32 18 50 30 L44 38 Q32 32 22 38 Z" {...S} />
      <circle cx="42" cy="26" r="2" fill="currentColor" />
      <path d="M48 28 L54 24" {...S} strokeLinecap="round" />
      <path d="M22 38 Q16 42 14 48" {...S} strokeLinecap="round" />
    </Frame>
  ),

  /* ── KOLOM 10: Antariksa ── */
  saturnus: (p) => (
    <Frame className={p.className}>
      <circle cx="32" cy="34" r="12" {...S} />
      <ellipse cx="32" cy="34" rx="24" ry="7" {...S} strokeWidth={2.5} />
    </Frame>
  ),

  'bulan-sabit': (p) => (
    <Frame className={p.className}>
      <path
        d="M42 14 C28 14 18 26 18 38 C18 50 28 58 42 58 C30 50 26 40 26 32 C26 24 32 16 42 14 Z"
        fill="currentColor"
      />
    </Frame>
  ),

  'bulan-purnama': (p) => (
    <Frame className={p.className}>
      <circle cx="32" cy="32" r="20" {...S} strokeWidth={2.5} />
    </Frame>
  ),

  bintang: (p) => (
    <Frame className={p.className}>
      <path
        d="M32 10 L36 24 H52 L40 34 L44 50 L32 40 L20 50 L24 34 L12 24 H28 Z"
        fill="currentColor"
      />
    </Frame>
  ),

  matahari: (p) => (
    <Frame className={p.className}>
      <circle cx="32" cy="32" r="11" fill="currentColor" />
      <g stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
        <line x1="32" y1="6" x2="32" y2="14" />
        <line x1="32" y1="50" x2="32" y2="58" />
        <line x1="6" y1="32" x2="14" y2="32" />
        <line x1="50" y1="32" x2="58" y2="32" />
        <line x1="13" y1="13" x2="19" y2="19" />
        <line x1="45" y1="45" x2="51" y2="51" />
        <line x1="51" y1="13" x2="45" y2="19" />
        <line x1="19" y1="45" x2="13" y2="51" />
      </g>
    </Frame>
  ),
};

export function renderCermatImageSvg(name: string, className?: string) {
  const render = CERMAT_IMAGE_SVGS[name];
  if (!render) return null;
  return render({ className: className ? `${className} text-slate-900` : 'text-slate-900' });
}
