import { memo } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * Katalog 16 karakter Live Quiz 2.0. Semua ilustrasi digambar sendiri sebagai SVG berlapis
 * (latar -> badan -> kepala -> wajah -> aksesori), bukan gambar/aset pihak ketiga.
 * ID di sini HARUS sama dengan backend/src/modules/live-quiz/liveAvatars.ts (dijaga oleh tes).
 */

export type AvatarMeta = {
  id: string;
  name: string;
  /** Warna latar lingkaran avatar. */
  bg: string;
  /** Warna aksen (bingkai/glow) saat avatar ditonjolkan. */
  accent: string;
  art: () => ReactNode;
};

const INK = '#1B2A41';

function Eyes({ y = 50, gap = 11, r = 3.4, color = INK }: { y?: number; gap?: number; r?: number; color?: string }) {
  return (
    <g>
      <circle cx={50 - gap} cy={y} r={r} fill={color} />
      <circle cx={50 + gap} cy={y} r={r} fill={color} />
      <circle cx={50 - gap + 1.1} cy={y - 1.2} r={r * 0.36} fill="#fff" />
      <circle cx={50 + gap + 1.1} cy={y - 1.2} r={r * 0.36} fill="#fff" />
    </g>
  );
}

function Smile({ y = 60, w = 7, color = INK }: { y?: number; w?: number; color?: string }) {
  return <path d={`M${50 - w} ${y} Q50 ${y + 7} ${50 + w} ${y}`} stroke={color} strokeWidth={2.4} strokeLinecap="round" fill="none" />;
}

function Cheeks({ y = 57, gap = 16, color = '#F36FB6' }: { y?: number; gap?: number; color?: string }) {
  return (
    <g opacity={0.5}>
      <ellipse cx={50 - gap} cy={y} rx={4.2} ry={2.8} fill={color} />
      <ellipse cx={50 + gap} cy={y} rx={4.2} ry={2.8} fill={color} />
    </g>
  );
}

function Shoulders({ color, stroke }: { color: string; stroke?: string }) {
  return <path d="M14 104 C14 82 32 74 50 74 C68 74 86 82 86 104Z" fill={color} {...(stroke ? { stroke, strokeWidth: 1.5 } : {})} />;
}

function Star({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? r : r * 0.45;
    return `${(cx + Math.cos(angle) * radius).toFixed(1)},${(cy + Math.sin(angle) * radius).toFixed(1)}`;
  }).join(' ');
  return <polygon points={points} fill={fill} />;
}

const MANE_ANGLES = Array.from({ length: 12 }, (_, i) => (i * Math.PI * 2) / 12);

export const AVATARS: AvatarMeta[] = [
  {
    id: 'explorer',
    name: 'Explorer',
    bg: '#FF9F43',
    accent: '#7A4B26',
    art: () => (
      <>
        <Shoulders color="#B98A45" />
        <path d="M40 76 L50 88 L60 76Z" fill="#F4E6C8" />
        <circle cx={50} cy={53} r={22} fill="#F2B98C" />
        <Eyes y={54} />
        <Smile y={62} />
        <Cheeks y={59} />
        <ellipse cx={50} cy={40} rx={33} ry={8} fill="#C9A15B" />
        <path d="M28 40 Q28 13 50 13 Q72 13 72 40Z" fill="#DDB871" />
        <rect x={28} y={31} width={44} height={7} fill="#7A4B26" />
        <circle cx={62} cy={34.5} r={2.6} fill="#FFD166" />
      </>
    ),
  },
  {
    id: 'astronaut',
    name: 'Astronaut',
    bg: '#2575FC',
    accent: '#FFD166',
    art: () => (
      <>
        <Shoulders color="#EEF3FA" stroke="#C9D6E8" />
        <circle cx={31} cy={92} r={4.5} fill="#FF9F43" />
        <rect x={56} y={86} width={14} height={4} rx={2} fill="#19C6E6" />
        <line x1={50} y1={18} x2={50} y2={9} stroke="#C9D6E8" strokeWidth={2.4} />
        <circle cx={50} cy={8} r={3.4} fill="#FF9F43" />
        <circle cx={19} cy={52} r={6} fill="#FF9F43" />
        <circle cx={81} cy={52} r={6} fill="#FF9F43" />
        <circle cx={50} cy={50} r={31} fill="#F4F7FC" stroke="#C9D6E8" strokeWidth={2} />
        <ellipse cx={50} cy={52} rx={23} ry={19} fill="#16264A" />
        <path d="M33 46 Q40 38 50 38" stroke="#fff" strokeOpacity={0.6} strokeWidth={3} strokeLinecap="round" fill="none" />
        <circle cx={42} cy={54} r={3.2} fill="#fff" />
        <circle cx={58} cy={54} r={3.2} fill="#fff" />
        <circle cx={42} cy={54} r={1.5} fill="#19C6E6" />
        <circle cx={58} cy={54} r={1.5} fill="#19C6E6" />
        <path d="M44 61 Q50 66 56 61" stroke="#fff" strokeWidth={2} strokeLinecap="round" fill="none" />
      </>
    ),
  },
  {
    id: 'robot',
    name: 'Robot',
    bg: '#8056ED',
    accent: '#19C6E6',
    art: () => (
      <>
        <rect x={28} y={76} width={44} height={30} rx={7} fill="#8FA3BF" />
        <rect x={44} y={80} width={12} height={6} rx={3} fill="#19C6E6" />
        <rect x={18} y={44} width={7} height={16} rx={3.5} fill="#8FA3BF" />
        <rect x={75} y={44} width={7} height={16} rx={3.5} fill="#8FA3BF" />
        <line x1={50} y1={27} x2={50} y2={15} stroke="#7F93AE" strokeWidth={3} />
        <circle cx={50} cy={13} r={4.5} fill="#FF5D8F" />
        <rect x={24} y={26} width={52} height={48} rx={13} fill="#C9D6EA" stroke="#7F93AE" strokeWidth={2} />
        <rect x={31} y={38} width={38} height={19} rx={9.5} fill="#0E2A47" />
        <circle cx={42} cy={47.5} r={7} fill="#19C6E6" opacity={0.28} />
        <circle cx={58} cy={47.5} r={7} fill="#19C6E6" opacity={0.28} />
        <circle cx={42} cy={47.5} r={4.2} fill="#19C6E6" />
        <circle cx={58} cy={47.5} r={4.2} fill="#19C6E6" />
        <circle cx={43} cy={46} r={1.3} fill="#fff" />
        <circle cx={59} cy={46} r={1.3} fill="#fff" />
        <rect x={39} y={62} width={22} height={6} rx={3} fill="#7F93AE" />
        <path d="M45 62 V68 M50 62 V68 M55 62 V68" stroke="#C9D6EA" strokeWidth={1.4} />
        <circle cx={30} cy={32} r={2} fill="#7F93AE" />
        <circle cx={70} cy={32} r={2} fill="#7F93AE" />
      </>
    ),
  },
  {
    id: 'ninja',
    name: 'Ninja',
    bg: '#F36FB6',
    accent: '#E5484D',
    art: () => (
      <>
        <Shoulders color="#222B45" />
        <path d="M30 76 Q50 90 70 76 L66 70 Q50 80 34 70Z" fill="#E5484D" />
        <circle cx={50} cy={50} r={25} fill="#2A3455" />
        <rect x={29} y={41} width={42} height={16} rx={8} fill="#F2C9A0" />
        <ellipse cx={41} cy={49} rx={3.4} ry={3.8} fill={INK} />
        <ellipse cx={59} cy={49} rx={3.4} ry={3.8} fill={INK} />
        <circle cx={42} cy={47.8} r={1.1} fill="#fff" />
        <circle cx={60} cy={47.8} r={1.1} fill="#fff" />
        <path d="M35 43 L46 45.5 M65 43 L54 45.5" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        <rect x={25} y={29} width={50} height={8} rx={3} fill="#E5484D" />
        <rect x={42} y={30} width={16} height={6} rx={1.5} fill="#C9D2E3" />
        <path d="M74 33 L90 28 L86 38Z" fill="#E5484D" />
      </>
    ),
  },
  {
    id: 'pilot',
    name: 'Pilot',
    bg: '#19C6E6',
    accent: '#FFD166',
    art: () => (
      <>
        <Shoulders color="#8A5A3A" />
        <ellipse cx={50} cy={78} rx={19} ry={6} fill="#F6F1E7" />
        <circle cx={50} cy={53} r={22} fill="#E8B48B" />
        <ellipse cx={27} cy={57} rx={5.5} ry={9} fill="#7A4A2B" />
        <ellipse cx={73} cy={57} rx={5.5} ry={9} fill="#7A4A2B" />
        <path d="M27 51 Q26 22 50 22 Q74 22 73 51 Q62 41 50 41 Q38 41 27 51Z" fill="#7A4A2B" />
        <path d="M30 40 Q50 30 70 40" stroke="#5B3820" strokeWidth={2} fill="none" />
        <circle cx={40} cy={38} r={7.5} fill="#FFD166" stroke="#4A3020" strokeWidth={2.6} />
        <circle cx={60} cy={38} r={7.5} fill="#FFD166" stroke="#4A3020" strokeWidth={2.6} />
        <circle cx={38} cy={36} r={2.2} fill="#fff" opacity={0.7} />
        <circle cx={58} cy={36} r={2.2} fill="#fff" opacity={0.7} />
        <Eyes y={55} />
        <Smile y={63} />
        <Cheeks y={60} />
      </>
    ),
  },
  {
    id: 'scientist',
    name: 'Scientist',
    bg: '#F36FB6',
    accent: '#2575FC',
    art: () => (
      <>
        <Shoulders color="#F2F6FB" stroke="#C9D6E8" />
        <path d="M42 76 L50 90 L58 76Z" fill="#2DD4A7" />
        <g fill="#EAEFF6" stroke="#C9D6E8" strokeWidth={1.5}>
          <circle cx={30} cy={40} r={10} />
          <circle cx={42} cy={29} r={11} />
          <circle cx={58} cy={29} r={11} />
          <circle cx={70} cy={40} r={10} />
          <circle cx={26} cy={53} r={7} />
          <circle cx={74} cy={53} r={7} />
        </g>
        <circle cx={50} cy={53} r={21} fill="#F0BE97" />
        <circle cx={41} cy={52} r={8.5} fill="#19C6E6" fillOpacity={0.22} stroke={INK} strokeWidth={2.4} />
        <circle cx={59} cy={52} r={8.5} fill="#19C6E6" fillOpacity={0.22} stroke={INK} strokeWidth={2.4} />
        <path d="M49.5 52 H50.5" stroke={INK} strokeWidth={2.4} />
        <circle cx={41} cy={52} r={2.6} fill={INK} />
        <circle cx={59} cy={52} r={2.6} fill={INK} />
        <Smile y={63} w={6} />
      </>
    ),
  },
  {
    id: 'fox',
    name: 'Fox',
    bg: '#FFD166',
    accent: '#F7943F',
    art: () => (
      <>
        <path d="M23 46 L25 15 L45 33Z" fill="#F7943F" />
        <path d="M77 46 L75 15 L55 33Z" fill="#F7943F" />
        <path d="M28 40 L28 24 L39 33Z" fill="#3B2314" />
        <path d="M72 40 L72 24 L61 33Z" fill="#3B2314" />
        <path d="M21 52 Q50 18 79 52 Q77 80 50 84 Q23 80 21 52Z" fill="#F7943F" />
        <path d="M21 56 Q37 56 50 72 Q63 56 79 56 Q76 80 50 84 Q24 80 21 56Z" fill="#FFF4E6" />
        <Eyes y={52} gap={13} />
        <ellipse cx={50} cy={68} rx={4.6} ry={3.4} fill={INK} />
        <path d="M50 71 V74 M45 75 Q50 79 55 75" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
      </>
    ),
  },
  {
    id: 'panda',
    name: 'Panda',
    bg: '#2DD4A7',
    accent: '#102A43',
    art: () => (
      <>
        <circle cx={27} cy={29} r={10.5} fill="#1F2937" />
        <circle cx={73} cy={29} r={10.5} fill="#1F2937" />
        <circle cx={50} cy={54} r={27} fill="#FFFFFF" stroke="#E5E7EB" strokeWidth={1.5} />
        <ellipse cx={37} cy={51} rx={7} ry={9.5} fill="#1F2937" transform="rotate(-22 37 51)" />
        <ellipse cx={63} cy={51} rx={7} ry={9.5} fill="#1F2937" transform="rotate(22 63 51)" />
        <circle cx={38} cy={51} r={3.2} fill="#fff" />
        <circle cx={62} cy={51} r={3.2} fill="#fff" />
        <circle cx={38.4} cy={51.4} r={1.7} fill={INK} />
        <circle cx={61.6} cy={51.4} r={1.7} fill={INK} />
        <ellipse cx={50} cy={62} rx={5} ry={3.6} fill="#1F2937" />
        <path d="M50 65.5 V69 M44 69.5 Q50 74 56 69.5" stroke="#1F2937" strokeWidth={2} strokeLinecap="round" fill="none" />
      </>
    ),
  },
  {
    id: 'owl',
    name: 'Owl',
    bg: '#8056ED',
    accent: '#FFD166',
    art: () => (
      <>
        <path d="M24 38 L22 14 L42 28Z" fill="#8E6641" />
        <path d="M76 38 L78 14 L58 28Z" fill="#8E6641" />
        <ellipse cx={50} cy={58} rx={30} ry={32} fill="#A87B51" />
        <ellipse cx={50} cy={74} rx={17} ry={15} fill="#EBD3AB" />
        <path d="M42 70 Q45 73 48 70 M52 70 Q55 73 58 70 M46 78 Q50 81 54 78" stroke="#C9A878" strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <circle cx={37} cy={50} r={11.5} fill="#FFF6DC" stroke="#6B4A2B" strokeWidth={2} />
        <circle cx={63} cy={50} r={11.5} fill="#FFF6DC" stroke="#6B4A2B" strokeWidth={2} />
        <circle cx={38} cy={51} r={5.2} fill={INK} />
        <circle cx={62} cy={51} r={5.2} fill={INK} />
        <circle cx={39.6} cy={49} r={1.8} fill="#fff" />
        <circle cx={63.6} cy={49} r={1.8} fill="#fff" />
        <path d="M44 60 L56 60 L50 70Z" fill="#FF9F43" />
      </>
    ),
  },
  {
    id: 'tiger',
    name: 'Tiger',
    bg: '#2575FC',
    accent: '#FF9F43',
    art: () => (
      <>
        <circle cx={28} cy={30} r={9} fill="#F59E0B" />
        <circle cx={72} cy={30} r={9} fill="#F59E0B" />
        <circle cx={28} cy={31} r={4.5} fill="#FDE68A" />
        <circle cx={72} cy={31} r={4.5} fill="#FDE68A" />
        <circle cx={50} cy={54} r={27} fill="#F59E0B" />
        <path d="M44 30 L46 38 M50 29 V38 M56 30 L54 38" stroke="#3B2314" strokeWidth={3} strokeLinecap="round" />
        <path d="M24 48 L33 50 M23 56 L32 57 M76 48 L67 50 M77 56 L68 57" stroke="#3B2314" strokeWidth={3} strokeLinecap="round" />
        <ellipse cx={50} cy={66} rx={14} ry={10} fill="#FFF7E0" />
        <Eyes y={52} gap={12} />
        <path d="M46 62 L54 62 L50 67Z" fill="#3B2314" />
        <path d="M50 67 V70 M44 71 Q50 75 56 71" stroke="#3B2314" strokeWidth={2} strokeLinecap="round" fill="none" />
      </>
    ),
  },
  {
    id: 'lion',
    name: 'Lion',
    bg: '#19C6E6',
    accent: '#FFD166',
    art: () => (
      <>
        {MANE_ANGLES.map((angle, index) => (
          <circle key={index} cx={50 + Math.cos(angle) * 28} cy={52 + Math.sin(angle) * 28} r={11} fill={index % 2 ? '#B45309' : '#C2570C'} />
        ))}
        <circle cx={50} cy={52} r={30} fill="#C2570C" />
        <circle cx={34} cy={30} r={7} fill="#F2B24E" />
        <circle cx={66} cy={30} r={7} fill="#F2B24E" />
        <circle cx={50} cy={53} r={23} fill="#F6C65B" />
        <ellipse cx={50} cy={63} rx={12} ry={8.5} fill="#FFF1C9" />
        <Eyes y={50} gap={11} />
        <path d="M46 58 L54 58 L50 63Z" fill="#7C2D12" />
        <path d="M50 63 V66 M45 67 Q50 71 55 67" stroke="#7C2D12" strokeWidth={2} strokeLinecap="round" fill="none" />
      </>
    ),
  },
  {
    id: 'cat',
    name: 'Cat',
    bg: '#FFD166',
    accent: '#8056ED',
    art: () => (
      <>
        <path d="M24 48 L25 17 L46 33Z" fill="#8E7CC3" />
        <path d="M76 48 L75 17 L54 33Z" fill="#8E7CC3" />
        <path d="M29 40 L29 26 L39 33Z" fill="#F7A8CE" />
        <path d="M71 40 L71 26 L61 33Z" fill="#F7A8CE" />
        <ellipse cx={50} cy={56} rx={28} ry={25} fill="#9D8CD6" />
        <path d="M43 34 L44 41 M50 33 V41 M57 34 L56 41" stroke="#7C6BB8" strokeWidth={2.6} strokeLinecap="round" />
        <ellipse cx={38} cy={52} rx={5.2} ry={6} fill="#2DD4A7" />
        <ellipse cx={62} cy={52} rx={5.2} ry={6} fill="#2DD4A7" />
        <ellipse cx={38} cy={52} rx={1.6} ry={5} fill={INK} />
        <ellipse cx={62} cy={52} rx={1.6} ry={5} fill={INK} />
        <circle cx={39.4} cy={50} r={1.2} fill="#fff" />
        <circle cx={63.4} cy={50} r={1.2} fill="#fff" />
        <path d="M46.5 61 L53.5 61 L50 65Z" fill="#F36FB6" />
        <path d="M50 65 Q46 70 42 66 M50 65 Q54 70 58 66" stroke={INK} strokeWidth={1.8} strokeLinecap="round" fill="none" />
        <path d="M18 58 L32 60 M18 65 L32 64 M82 58 L68 60 M82 65 L68 64" stroke="#fff" strokeOpacity={0.85} strokeWidth={1.3} strokeLinecap="round" />
      </>
    ),
  },
  {
    id: 'dragon',
    name: 'Dragon',
    bg: '#FF9F43',
    accent: '#2DD4A7',
    art: () => (
      <>
        <path d="M31 36 L24 12 L42 28Z" fill="#FFD166" />
        <path d="M69 36 L76 12 L58 28Z" fill="#FFD166" />
        <path d="M42 28 L46 18 L50 27 L54 18 L58 28Z" fill="#1FA37F" />
        <path d="M22 52 L10 46 L22 62Z" fill="#1FA37F" />
        <path d="M78 52 L90 46 L78 62Z" fill="#1FA37F" />
        <ellipse cx={50} cy={54} rx={28} ry={25} fill="#2DD4A7" />
        <ellipse cx={50} cy={66} rx={17} ry={12} fill="#86EDCB" />
        <circle cx={44} cy={65} r={1.8} fill={INK} />
        <circle cx={56} cy={65} r={1.8} fill={INK} />
        <circle cx={38} cy={49} r={6} fill="#FFD166" />
        <circle cx={62} cy={49} r={6} fill="#FFD166" />
        <ellipse cx={38} cy={49} rx={1.8} ry={4.8} fill={INK} />
        <ellipse cx={62} cy={49} rx={1.8} ry={4.8} fill={INK} />
        <path d="M31 41 L43 44 M69 41 L57 44" stroke="#1FA37F" strokeWidth={2.6} strokeLinecap="round" />
        <path d="M43 72 Q50 77 57 72" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
      </>
    ),
  },
  {
    id: 'gamer',
    name: 'Gamer',
    bg: '#2DD4A7',
    accent: '#8056ED',
    art: () => (
      <>
        <Shoulders color="#8056ED" />
        <path d="M43 76 V92 M57 76 V92" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
        <path d="M32 78 Q50 90 68 78" stroke="#6B44D6" strokeWidth={3} fill="none" />
        <circle cx={50} cy={53} r={22} fill="#F0BE97" />
        <path d="M27 50 Q26 22 50 22 Q74 22 73 50 Q66 36 50 38 Q34 36 27 50Z" fill="#1F1B3A" />
        <Eyes y={54} />
        <path d="M43 62 Q51 68 58 61" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" />
        <path d="M25 52 Q24 25 50 25 Q76 25 75 52" stroke="#2B2F4A" strokeWidth={5} strokeLinecap="round" fill="none" />
        <rect x={19} y={46} width={9} height={16} rx={4.5} fill="#19C6E6" />
        <rect x={72} y={46} width={9} height={16} rx={4.5} fill="#19C6E6" />
        <path d="M76 60 Q76 70 60 69" stroke="#2B2F4A" strokeWidth={3} strokeLinecap="round" fill="none" />
        <circle cx={58.5} cy={69} r={3.2} fill="#FF9F43" />
      </>
    ),
  },
  {
    id: 'warrior',
    name: 'Warrior',
    bg: '#8056ED',
    accent: '#FFD166',
    art: () => (
      <>
        <Shoulders color="#9AA7BD" />
        <path d="M24 90 Q50 80 76 90" stroke="#FFD166" strokeWidth={3} fill="none" />
        <circle cx={50} cy={56} r={19} fill="#E8B48B" />
        <path d="M40 24 Q48 0 66 12 Q54 14 56 26Z" fill="#E5484D" />
        <path d="M25 56 Q22 22 50 22 Q78 22 75 56 L67 56 L67 45 L33 45 L33 56Z" fill="#B6C2D6" stroke="#7E8CA6" strokeWidth={1.8} />
        <rect x={25} y={50} width={9} height={18} rx={4} fill="#9AA7BD" />
        <rect x={66} y={50} width={9} height={18} rx={4} fill="#9AA7BD" />
        <rect x={47.5} y={42} width={5} height={20} rx={2} fill="#9AA7BD" />
        <rect x={25} y={34} width={50} height={4} fill="#FFD166" />
        <Eyes y={56} gap={9.5} r={3} />
        <Smile y={66} w={6} />
      </>
    ),
  },
  {
    id: 'hero',
    name: 'Student Hero',
    bg: '#FFD166',
    accent: '#E5484D',
    art: () => (
      <>
        <path d="M14 104 L22 64 Q50 84 78 64 L86 104Z" fill="#E5484D" />
        <Shoulders color="#2575FC" />
        <circle cx={50} cy={90} r={8} fill="#FFFFFF" fillOpacity={0.22} />
        <Star cx={50} cy={90} r={7} fill="#FFD166" />
        <circle cx={50} cy={50} r={22} fill="#E8B48B" />
        <path d="M27 48 Q25 22 50 22 Q75 22 73 48 Q66 34 54 35 Q60 28 44 34 Q34 36 27 48Z" fill="#2A1E14" />
        <path d="M27 46 Q50 38 73 46 L73 56 Q50 61 27 56Z" fill="#2575FC" />
        <ellipse cx={40.5} cy={51} rx={6.2} ry={4.8} fill="#fff" />
        <ellipse cx={59.5} cy={51} rx={6.2} ry={4.8} fill="#fff" />
        <circle cx={41.5} cy={51.4} r={2.6} fill={INK} />
        <circle cx={60.5} cy={51.4} r={2.6} fill={INK} />
        <Smile y={64} w={6} />
      </>
    ),
  },
];

export const AVATAR_IDS = AVATARS.map((a) => a.id);
const BY_ID = new Map(AVATARS.map((a) => [a.id, a]));

/** FNV-1a: SAMA dengan backend (liveAvatars.ts) agar avatar default konsisten di semua layar. */
function stableHash(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function defaultAvatarFor(seed: string): AvatarMeta {
  return AVATARS[stableHash(seed) % AVATARS.length]!;
}

/** ID valid -> avatar tsb; kosong/tidak dikenal -> avatar default deterministik (UI tidak pernah error). */
export function resolveAvatar(avatarId: string | null | undefined, seed = ''): AvatarMeta {
  return (avatarId ? BY_ID.get(avatarId) : undefined) ?? defaultAvatarFor(seed || avatarId || 'tactical');
}

type PlayerAvatarProps = {
  avatarId?: string | null | undefined;
  /** Seed untuk avatar default (mis. playerId). */
  seed?: string;
  /** Ukuran piksel (lebar = tinggi). */
  size?: number;
  /** Bingkai bercahaya warna aksen karakter. */
  ring?: boolean;
  /** Animasi idle halus (bob). Dimatikan otomatis pada mode lite/reduced. */
  idle?: boolean;
  label?: string;
  className?: string;
};

function PlayerAvatarImpl({ avatarId, seed = '', size = 48, ring = false, idle = false, label, className }: PlayerAvatarProps) {
  const avatar = resolveAvatar(avatarId, seed);
  return (
    <span
      role="img"
      aria-label={label ?? `Karakter ${avatar.name}`}
      className={cn('lq-avatar relative inline-block shrink-0 overflow-hidden rounded-full', idle && 'lq-avatar-idle', className)}
      style={{
        width: size,
        height: size,
        backgroundColor: avatar.bg,
        boxShadow: ring ? `0 0 0 ${Math.max(2, size / 22)}px #fff, 0 0 ${size / 3}px ${avatar.accent}` : '0 6px 14px -8px rgba(2, 10, 30, 0.55)',
      }}
    >
      <svg viewBox="0 0 100 100" aria-hidden focusable="false" className="block h-full w-full">
        <circle cx={34} cy={16} r={46} fill="#fff" opacity={0.2} />
        {avatar.art()}
      </svg>
      <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-black/20" aria-hidden />
    </span>
  );
}

export const PlayerAvatar = memo(PlayerAvatarImpl);
