import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import WordExtractor from 'word-extractor';
import type { ConversionWarning, ParsedQuestion } from './examImport';
import { isImageOptionLabel, validateQuestions } from './examImport';

const OPTION_LINE = /^(?:\(([A-Ea-e])\)|([A-Ea-e])[.)]|([A-Ea-e])[:：=\-])\s*(.+)$/i;
const SOAL_SPLIT = /(?:^|\n)\s*(?:\[)?SOAL\s*(\d+)(?:\])?\s*(?:\n|$)/gi;
const KUNCI_LINE = /^(?:KUNCI(?:\s*JAWABAN)?|Kunci\s*Jawaban|JAWABAN|Jawaban(?:\s*Benar)?|Jawab)\s*[:：=\-]?\s*([A-Ea-e])\s*$/i;
const PEMBAHASAN_LINE = /^(?:PEMBAHASAN|Pembahasan|Penjelasan|PENJELASAN|Alasan)\s*[:：=\-]?\s*(.*)$/i;
/** Deteksi kunci jawaban — variasi label & tanda baca. */
const FLEXIBLE_KUNCI = /(?:Kunci(?:\s*Jawaban)?|KUNCI(?:\s*JAWABAN)?|Jawaban(?:\s*Benar)?|Jawab|Answer|Key)\s*[:：=\-]?\s*([A-Ea-e])\b/gi;
const PEMBAHASAN_HEADER = /(?:Pembahasan|PEMBAHASAN|Penjelasan|PENJELASAN|Alasan|Discuss)\s*[:：=\-]?\s*/i;
const GAMBAR_MARKER = /\[GAMBAR\]/gi;
const NUMBERED_QUESTION_START = /(?:^|\n)\s*(\d+)\.\s+/g;
const JAWAB_IN_BLOCK = /(?:^|\n)\s*Jawab\s*[:：=\-]?\s*([A-Ea-e])\b/i;
const NEXT_NUMBERED_QUESTION = /\n\s*(\d+)\.\s+\S/;
const NEXT_QUESTION_HINT = /\n\n([^\n]{20,}(?:\?|…|\.{3}))\s*\n+\s*(?:\(?[A-Ea-e][)\].]|A[.)]\s)/;
/** Format bank soal: No. 1 / No. 1 – Kategori / Soal: ... A. ... Kunci Jawaban: X / Pembahasan */
const NO_SOAL_BLOCK_SPLIT = /(?=(?:^|\n)\s*No\.\s*\d+\b)/;
const NO_SOAL_HEADER = /No\.\s*(\d+)\b/;
const SOAL_LABEL_PREFIX = /^\s*(?:Soal|Pertanyaan)\s*[:：]?\s*/i;
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

type ParseDocxResult = {
  questions: ParsedQuestion[];
  warnings: ConversionWarning[];
  /** Selalu kosong — gambar Word tidak disimpan ke server. */
  extractedImages: string[];
  embeddedImageCount: number;
};

function normalizeText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function findNextQuestionStart(text: string): number {
  const numbered = text.match(NEXT_NUMBERED_QUESTION);
  if (numbered?.index !== undefined && numbered.index > 0) {
    return numbered.index;
  }

  const hint = text.match(NEXT_QUESTION_HINT);
  if (hint?.index !== undefined && hint.index > 0) {
    return hint.index;
  }

  return -1;
}

function blockHasMcqOptions(body: string): boolean {
  const letters = new Set(
    [...body.matchAll(/(?:^|\n)\s*([A-E])\.\s+\S/g)].map((match) => match[1] ?? ''),
  );
  return letters.has('A') && letters.has('B') && letters.size >= 2;
}

function detectNumberedJawabFormat(text: string): boolean {
  const numberedCount = [...text.matchAll(NUMBERED_QUESTION_START)].length;
  const jawabCount = [...text.matchAll(/(?:^|\n)\s*Jawab\s*[:：=\-]?\s*[A-Ea-e]\b/gi)].length;
  // Cukup banyak nomor + opsi A–E, meski sebagian soal belum punya "Jawab: X".
  const mcqLike = [...text.matchAll(/(?:^|\n)\s*\d+\.\s+[\s\S]{0,400}?(?:^|\n)\s*A\.\s+\S/gm)].length;
  return (numberedCount >= 1 && jawabCount >= 1) || (numberedCount >= 5 && mcqLike >= 5);
}

/** Format: 1. soal? A. …B. … Pembahasan: … (kunci tersirat di pembahasan) */
function detectNumberedPembahasanFormat(text: string): boolean {
  const numberedCount = [...text.matchAll(NUMBERED_QUESTION_START)].length;
  // Izinkan "TIDAKPembahasan:" (tanpa baris baru) — umum di bank YA/TIDAK menempel.
  const pembahasanCount = [...text.matchAll(/Pembahasan\s*[:：]/gi)].length;
  const explicitJawab = [...text.matchAll(/(?:^|\n)\s*Jawab\s*[:：=\-]?\s*[A-Ea-e]\b/gi)].length;
  const explicitKunci = [...text.matchAll(/(?:^|\n)\s*Kunci(?:\s*Jawaban)?\s*[:：=\-]?\s*[A-Ea-e]\b/gi)].length;
  const yaTidakHints = [...text.matchAll(/\bA\.\s*YA\b[\s\S]{0,40}?\bB\.\s*TIDAK\b/gi)].length;
  return (
    numberedCount >= 3 &&
    (pembahasanCount >= 3 || yaTidakHints >= 3) &&
    (pembahasanCount >= Math.floor(numberedCount * 0.5) || yaTidakHints >= Math.floor(numberedCount * 0.5)) &&
    explicitJawab + explicitKunci < Math.max(2, Math.floor(numberedCount * 0.3))
  );
}

/** Petakan jawaban YA/TIDAK (tes kepribadian) ke opsi A/B. */
function mapYaTidakToLetter(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'YA' || normalized === 'YES') return 'A';
  if (normalized === 'TIDAK' || normalized === 'TIDAK.' || normalized === 'NO') return 'B';
  return null;
}

function extractAnswerKeyFromPembahasan(explanation: string): string | null {
  const text = explanation
    .replace(/[\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
    .replace(/\uFE0F/g, '')
    .trim();

  // Format PASS HAND Polri: "➡️ YA (positif)..." / "➡️ TIDAK (positif)..."
  const arrowPositif = text.match(/(?:➡️|👉|✅|→)?\s*(YA|TIDAK|YES|NO)\s*\(\s*positif\s*\)/i);
  if (arrowPositif?.[1]) {
    return mapYaTidakToLetter(arrowPositif[1]);
  }

  // Format PASS HAND naratif: "Jawaban YA mencerminkan..." / "Jawaban TIDAK lebih ideal..."
  const jawabanYaTidak = text.match(/\bJawaban\s+(YA|TIDAK|YES|NO)\b/i);
  if (jawabanYaTidak?.[1]) {
    return mapYaTidakToLetter(jawabanYaTidak[1]);
  }

  // Format PASS HAND / kepribadian: "Jawaban yang disarankan: YA" / "TIDAKMenunjukkan..."
  const yaTidak = text.match(
    /Jawaban\s*yang\s*disarankan\s*[:：]?\s*(YA|TIDAK|YES|NO)(?=[A-ZÀ-ú\s.,;:]|$)/i,
  );
  if (yaTidak?.[1]) {
    return mapYaTidakToLetter(yaTidak[1]);
  }

  // Huruf kunci boleh menempel teks berikutnya (mis. "ideal: CPilihan..." / "C.utara").
  const patterns = [
    /(?:➡️|→)\s*([A-Ea-e])(?:\s*[\.:)（]|\s+\d|\s*$)/i,
    /(?:✅|👉)\s*Jawaban\s*(?:benar\s*)?[:：]?\s*([A-Ea-e])(?:\s*dan\s*([A-Ea-e]))?/i,
    /Jawaban\s*benar\s*[:：]?\s*([A-Ea-e])(?:\s*dan\s*([A-Ea-e]))?/i,
    /Jawaban\s*yang\s*(?:benar|tepat)\s*(?:adalah\s*)?[:：]?\s*([A-Ea-e])/i,
    /maka\s+jawaban\s+yang\s+benar\s+adalah\s*([A-Ea-e])/i,
    /jawabannya?\s*[:：]?\s*([A-Ea-e])(?![A-Ea-e])/i,
    /Jawaban\s*[:：]\s*([A-Ea-e])(?![A-Ea-e])/i,
    /Jawaban\s*paling\s*ideal\s*[:：]?\s*([A-Ea-e])(?![A-Ea-e])/i,
    /Pilihan\s*([A-Ea-e])\s*paling\s*ideal\b/i,
    /Jawaban\s*([A-Ea-e])\s*(?:dinilai|paling\s*sesuai|paling\s*tepat|paling\s*ideal|paling\s*baik)\b/i,
    /(?:dari\s+opsi[^.]*adalah\s*|gambar\s+\w+\s+adalah\s*)([A-Ea-e])\b/i,
    /\b\d+\s+bangunan\s*\(\s*([A-Ea-e])\s*\)/i,
    /\(\s*([A-Ea-e])\s*\)\s*[:：]/i,
    /Jawaban\s*([A-Ea-e])(?![A-Ea-e])/i,
    /Pilihan\s*([A-Ea-e])(?![A-Ea-e])/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const letters = [match[1], match[2]].filter(Boolean).join('').toUpperCase();
    if (letters) return letters;
  }
  return null;
}

/** Ambil kunci dari teks "Jawaban: B" / "Jawaban: D (...)" yang sering menempel opsi. */
function extractInlineJawabanKey(text: string): { clean: string; answerKey: string | null } {
  const match = text.match(/Jawaban\s*[:：]\s*([A-Ea-e])(?:\s*\([^)]*\))?/i);
  if (!match?.[1]) {
    return { clean: text, answerKey: null };
  }
  return {
    answerKey: match[1].toUpperCase(),
    clean: text.replace(/Jawaban\s*[:：]\s*[A-Ea-e](?:\s*\([^)]*\))?/gi, '').trim(),
  };
}

function scrubJawabanFromOptions(options: ParsedQuestion['options']): ParsedQuestion['options'] {
  return options.map((option) => ({
    ...option,
    label: (option.label ?? '').replace(/\s*Jawaban\s*[:：].*$/i, '').trim(),
  }));
}

function splitNumberedPembahasanBlocks(text: string): Array<{ order: number; body: string }> {
  const normalized = normalizeText(text);
  const matches = [...normalized.matchAll(NUMBERED_QUESTION_START)];
  if (!matches.length) return [];

  const blocks: Array<{ order: number; body: string }> = [];
  matches.forEach((match, index) => {
    const order = Number(match[1]) || index + 1;
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? normalized.length;
    const body = normalized.slice(start, end).trim();
    if (body && /Pembahasan\s*[:：]/i.test(body)) {
      blocks.push({ order, body });
    }
  });
  return blocks;
}

function parseYaTidakInlineOptions(text: string): ParsedQuestion['options'] | null {
  const match = text.match(/\bA\.\s*(YA|YES)\s+B\.\s*(TIDAK|NO)\b/i);
  if (!match) return null;
  return OPTION_LETTERS.map((letter, index) => {
    if (index === 0) return { label: 'YA', imageUrl: null, isCorrect: false };
    if (index === 1) return { label: 'TIDAK', imageUrl: null, isCorrect: false };
    return { label: '', imageUrl: null, isCorrect: false };
  });
}

function parseNumberedPembahasanBlock(order: number, body: string, imageQueue: string[]): ParsedQuestion | null {
  // Izinkan menempel: "TIDAKPembahasan:" (tanpa newline).
  const pembahasanMatch = body.match(/Pembahasan\s*[:：]?\s*/i);
  if (!pembahasanMatch || pembahasanMatch.index === undefined) return null;

  const rawBefore = body.slice(0, pembahasanMatch.index).trim();
  const inlineJawaban = extractInlineJawabanKey(rawBefore);
  const before = inlineJawaban.clean;
  let explanation = body.slice(pembahasanMatch.index + pembahasanMatch[0].length).trim();
  // Hindari menyeret nomor soal berikutnya ke pembahasan.
  const nextNumbered = explanation.search(/\n\s*\d+\.\s+/);
  if (nextNumbered >= 0) {
    explanation = explanation.slice(0, nextNumbered).trim();
  }
  // Rapikan teks Word yang menempel: "ideal: CPilihan" / "YAMenunjukkan"
  explanation = explanation
    .replace(/(Jawaban\s*paling\s*ideal\s*[:：]?\s*[A-Ea-e])(?=[A-ZÀ-ú])/gi, '$1. ')
    .replace(/(Pilihan\s*[A-Ea-e])(?=[A-ZÀ-ú])/gi, '$1. ')
    .replace(/(Jawaban\s*yang\s*disarankan\s*[:：]?\s*(?:YA|TIDAK|YES|NO))(?=[A-ZÀ-ú])/gi, '$1. ');

  // Utamakan YA/TIDAK (2 opsi), lalu sequential A–E menempel.
  let options = parseYaTidakInlineOptions(before) ?? parseSequentialInlineOptions(before);
  if (countFilledOptions(options) < 2) {
    options = extractBestOptions(before);
  }

  const yaTidakStart = before.search(/\bA\.\s*(?:YA|YES)\b/i);
  const optionStart = yaTidakStart >= 0 ? yaTidakStart : findOptionSectionStart(before);
  let prompt = optionStart >= 0 ? before.slice(0, optionStart).trim() : before;
  if (countFilledOptions(options) < 2) {
    const unlabeled = parseUnlabeledStemAndOptions(before);
    if (unlabeled) {
      prompt = unlabeled.prompt;
      options = unlabeled.options;
    }
  }

  options = scrubJawabanFromOptions(options);
  prompt = stripKnownSections(prompt, []);

  // Ambil kunci dulu dari label opsi (sering ikut "✅ Jawaban benar: A dan B"), baru bersihkan.
  const keyFromOptions = options.map((option) => option.label ?? '').join('\n');

  // Bersihkan sisa "Pembahasan" / kunci yang ikut ke label opsi.
  options = options.map((option) => ({
    ...option,
    label: (option.label ?? '')
      .replace(/\s*Pembahasan\s*[:：]?.*$/i, '')
      .replace(/\s*(?:✅|👉|➡️|→)?\s*Jawaban\s*(?:benar\s*)?[:：]?.*/i, '')
      .replace(/\s*(?:➡️|→)\s*[A-Ea-e](?:\s*[\.:).].*)?$/i, '')
      .trim(),
  }));

  const answerKey =
    inlineJawaban.answerKey ??
    extractAnswerKeyFromPembahasan(explanation) ??
    extractAnswerKeyFromRegion(explanation) ??
    extractAnswerKeyFromPembahasan(keyFromOptions) ??
    extractAnswerKeyFromRegion(keyFromOptions) ??
    extractAnswerKeyFromRegion(body) ??
    inferCountAnswerFromExplanation(explanation, options);
  if (answerKey) {
    markCorrectAnswer(options, answerKey);
  }

  const images = applyImageMarkers(prompt, explanation, imageQueue);
  return {
    prompt: images.prompt || `Soal ${order}`,
    imageUrl: images.imageUrl,
    explanation: images.explanation,
    explanationImageUrl: images.explanationImageUrl,
    requiresPromptImage: images.requiresPromptImage,
    requiresExplanationImage: images.requiresExplanationImage,
    order,
    options,
  };
}

function parseNumberedPembahasanFormat(text: string, imageQueue: string[]): ParsedQuestion[] {
  const blocks = splitNumberedPembahasanBlocks(text);
  const questions: ParsedQuestion[] = [];
  for (const block of blocks) {
    const parsed = parseNumberedPembahasanBlock(block.order, block.body, imageQueue);
    if (parsed) questions.push(parsed);
  }
  return questions;
}

function detectNoSoalKunciFormat(text: string): boolean {
  const noHeaders = [...text.matchAll(/(?:^|\n)\s*No\.\s*\d+\b/g)].length;
  const kunciLabels = [...text.matchAll(/Kunci\s*Jawaban\s*[:：]/gi)].length;
  // Cukup No. N + Kunci Jawaban (label "Soal:" opsional; ada format tanpa strip "–").
  return noHeaders >= 2 && kunciLabels >= 2 && kunciLabels >= Math.floor(noHeaders * 0.5);
}

function splitNoSoalBlocks(text: string): Array<{ order: number; body: string }> {
  const normalized = normalizeText(text);
  const parts = normalized.split(NO_SOAL_BLOCK_SPLIT).map((part) => part.trim()).filter(Boolean);
  return parts.map((body, index) => {
    const orderMatch = body.match(NO_SOAL_HEADER);
    return { order: Number(orderMatch?.[1]) || index + 1, body };
  });
}

function findAllOptionMarkers(text: string): Array<{ letter: string; index: number; end: number }> {
  // 1) A.teks / PatriotismeB. — tidak didahului huruf kapital
  // 2) SAKITD.Warung — opsi menempel setelah huruf/angka (ALLCAPS + letter)
  const primary = [...text.matchAll(/(?<![A-Z])([A-E])[.)](?=\s*(?:\S|$))/g)];
  // Izinkan spasi setelah titik: "SAKITD. Lawang"
  const glued = [...text.matchAll(/(?<=[A-Za-z0-9])([A-E])\.(?=\s*[A-Z0-9])/g)];
  const seen = new Set<number>();
  const markers: Array<{ letter: string; index: number; end: number }> = [];

  for (const match of [...primary, ...glued].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))) {
    const index = match.index ?? 0;
    if (seen.has(index)) continue;
    const letter = match[1] ?? '';
    if (!OPTION_LETTERS.includes(letter as (typeof OPTION_LETTERS)[number])) continue;
    seen.add(index);
    markers.push({ letter, index, end: index + match[0].length });
  }

  return markers;
}

function pickSequentialMarkers(text: string): Array<{ letter: string; index: number; end: number }> {
  const allMarkers = findAllOptionMarkers(text);
  const picked: Array<{ letter: string; index: number; end: number }> = [];
  let expected = 0;
  let lastEnd = 0;

  for (const marker of allMarkers) {
    const targetLetter = OPTION_LETTERS[expected];
    if (!targetLetter) break;

    if (marker.letter !== targetLetter) continue;
    if (picked.length > 0 && marker.index < lastEnd - 1) continue;

    picked.push(marker);
    lastEnd = marker.end;
    expected += 1;
    if (expected >= OPTION_LETTERS.length) break;
  }

  return picked;
}

function parseSequentialInlineOptions(text: string): ParsedQuestion['options'] {
  const markers = pickSequentialMarkers(text);
  const emptyOption = () => ({ label: '', imageUrl: null, isCorrect: false });

  if (!markers.length || markers[0]?.letter !== 'A') {
    return Array.from({ length: 5 }, emptyOption);
  }

  return OPTION_LETTERS.map((letter, index) => {
    const marker = markers[index];
    if (!marker) return emptyOption();

    let labelEnd = text.length;
    const nextMarker = markers[index + 1];
    if (nextMarker) {
      labelEnd = nextMarker.index;
    }

    const label = text.slice(marker.end, labelEnd).trim().replace(/\.\s*$/, '').trim();
    return { label, imageUrl: null, isCorrect: false };
  });
}

function findFirstOptionMarker(text: string): number {
  const markers = pickSequentialMarkers(text);
  return markers[0]?.index ?? -1;
}

function parseNoSoalKunciBlock(order: number, body: string, imageQueue: string[]): ParsedQuestion | null {
  const kunciMatch = [...body.matchAll(FLEXIBLE_KUNCI)][0];
  if (!kunciMatch?.[1] || kunciMatch.index === undefined) return null;

  const answerKey = kunciMatch[1].toUpperCase();
  const beforeKunci = body.slice(0, kunciMatch.index).trim();
  const afterKunci = body.slice(kunciMatch.index + kunciMatch[0].length).trim();

  let questionPart = beforeKunci.replace(/^No\.\s*\d+\b[^\n]*(?:\n|$)/, '').trim();
  questionPart = questionPart.replace(SOAL_LABEL_PREFIX, '').trim();

  let options = parseSequentialInlineOptions(questionPart);
  if (countFilledOptions(options) < 2) {
    options = extractBestOptions(questionPart);
  }
  const firstOptionIndex = findFirstOptionMarker(questionPart);
  let prompt = firstOptionIndex >= 0 ? questionPart.slice(0, firstOptionIndex).trim() : questionPart;
  prompt = prompt.replace(/[….]+\s*$/, '').trim();
  // Bersihkan sisa "(TWK POLRI 2025)" dll di akhir stem.
  prompt = prompt.replace(/\(\s*TWK[^)]*\)\s*$/i, '').trim();

  let explanation = afterKunci.replace(PEMBAHASAN_HEADER, '').trim();
  const pembahasan = extractPembahasanSection(afterKunci);
  if (pembahasan) {
    explanation = pembahasan.content;
  }
  // Jangan seret "No. berikutnya" ke pembahasan.
  const nextNo = explanation.search(/(?:^|\n)\s*No\.\s*\d+\b/);
  if (nextNo >= 0) {
    explanation = explanation.slice(0, nextNo).trim();
  }

  markCorrectAnswer(options, answerKey);
  const images = applyImageMarkers(prompt, explanation, imageQueue);

  return {
    prompt: images.prompt || `Soal ${order}`,
    imageUrl: images.imageUrl,
    explanation: images.explanation,
    explanationImageUrl: images.explanationImageUrl,
    requiresPromptImage: images.requiresPromptImage,
    requiresExplanationImage: images.requiresExplanationImage,
    order,
    options,
  };
}

function parseNoSoalKunciFormat(text: string, imageQueue: string[]): ParsedQuestion[] {
  const blocks = splitNoSoalBlocks(text);
  const questions: ParsedQuestion[] = [];

  for (const block of blocks) {
    const parsed = parseNoSoalKunciBlock(block.order, block.body, imageQueue);
    if (parsed) {
      questions.push(parsed);
    }
  }

  return questions;
}

function splitNumberedQuestionBlocks(text: string): Array<{ order: number; body: string }> {
  const normalized = normalizeText(text);
  const firstQuestion = normalized.search(/(?:^|\n)\s*\d+\.\s+/);
  if (firstQuestion < 0) return [];

  const body = normalized.slice(firstQuestion);
  const matches = [...body.matchAll(NUMBERED_QUESTION_START)];
  if (!matches.length) return [];

  // Hanya anggap "N." sebagai awal soal jika diikuti opsi A–E / Jawab: — hindari "1. Soekarno." di pembahasan.
  const mcqMatches = matches.filter((match) => {
    const start = (match.index ?? 0) + match[0].length;
    const nextIndex = matches.find((candidate) => (candidate.index ?? 0) > (match.index ?? 0))?.index;
    const windowEnd = Math.min(start + 900, nextIndex ?? body.length);
    const window = body.slice(start, windowEnd);
    return blockHasMcqOptions(window) || JAWAB_IN_BLOCK.test(window);
  });

  if (!mcqMatches.length) return [];

  const blocks: Array<{ order: number; body: string }> = [];

  mcqMatches.forEach((match, index) => {
    const order = Number(match[1]) || index + 1;
    const start = (match.index ?? 0) + match[0].length;
    const nextMatch = mcqMatches[index + 1];
    const end = nextMatch?.index ?? body.length;
    const blockBody = body.slice(start, end).trim();
    if (blockBody && (JAWAB_IN_BLOCK.test(blockBody) || blockHasMcqOptions(blockBody))) {
      blocks.push({ order, body: blockBody });
    }
  });

  return blocks;
}

/**
 * Opsi tanpa label A–E (umum di bank soal Word):
 * stem diakhiri ? / … / adalah: / tercermin…, lalu 2–5 baris/paragraf opsi.
 */
function parseUnlabeledStemAndOptions(beforeAnswer: string): {
  prompt: string;
  options: ParsedQuestion['options'];
} | null {
  const trimmed = beforeAnswer.trim();
  if (!trimmed) return null;

  const toOptions = (labels: string[]): ParsedQuestion['options'] =>
    OPTION_LETTERS.map((_, index) => ({
      label: labels[index]?.trim() ?? '',
      imageUrl: null,
      isCorrect: false,
    }));

  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((part) => !/^\(\s*Jawaban\b/i.test(part));

  // Judul pendek di awal (mis. "SOAL INTEGRITAS") — lewati.
  if (
    paragraphs.length >= 4 &&
    (paragraphs[0]?.length ?? 0) <= 60 &&
    !/[?：:]$/.test(paragraphs[0] ?? '') &&
    (paragraphs[1]?.length ?? 0) >= 80
  ) {
    paragraphs.shift();
  }

  // Format narasi + 5 opsi paragraf (bank integritas / wawasan kebangsaan).
  if (paragraphs.length >= 6) {
    const labels = paragraphs.slice(-5);
    const prompt = paragraphs.slice(0, -5).join(' ').trim();
    if (prompt.length >= 20 && labels.every((label) => label.length >= 8)) {
      return { prompt, options: toOptions(labels) };
    }
  }

  const stemMatch = trimmed.match(/^(.*?(?:[?？]|…|\.{3}|:\s*))\s+([\s\S]+)$/su);

  let prompt = '';
  let rest = '';
  if (stemMatch?.[1] && stemMatch[2] && stemMatch[1].trim().length >= 20) {
    prompt = stemMatch[1].trim();
    rest = stemMatch[2].trim();
  } else if (paragraphs.length >= 3) {
    // Ambil 5 opsi terakhir jika memungkinkan; sisanya stem.
    if (paragraphs.length >= 6) {
      prompt = paragraphs.slice(0, -5).join(' ').trim();
      rest = paragraphs.slice(-5).join('\n\n');
    } else {
      prompt = paragraphs[0] ?? '';
      rest = paragraphs.slice(1).join('\n\n');
    }
  } else {
    const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length < 3) return null;
    prompt = lines[0] ?? '';
    rest = lines.slice(1).join('\n');
  }

  const restParagraphs = rest
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const lines = rest
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  let labels: string[] = [];
  if (restParagraphs.length >= 2 && restParagraphs.length <= 5) {
    labels = restParagraphs;
  } else if (lines.length >= 2 && lines.length <= 5) {
    labels = lines;
  } else if (restParagraphs.length > 5) {
    // Opsi = 5 paragraf terakhir (bukan 5 pertama — itu sering termasuk sisa stem).
    labels = restParagraphs.slice(-5);
    const leftover = restParagraphs.slice(0, -5).join(' ').trim();
    if (leftover) {
      prompt = `${prompt} ${leftover}`.trim();
    }
  } else if (lines.length > 5) {
    labels = lines.slice(-5);
    const leftover = lines.slice(0, -5).join(' ').trim();
    if (leftover) {
      prompt = `${prompt} ${leftover}`.trim();
    }
  }

  if (labels.length < 2 || !prompt) return null;
  return { prompt, options: toOptions(labels) };
}

/** Stem soal narasi biasanya diakhiri ... / … / ? */
const NARRATIVE_STEM_END = /(\.\.\.|…\.?|\?|？)$/;

/**
 * Format penalaran WK: stem + 5 opsi tanpa label A–E (baris terpisah),
 * kunci di "Jawaban A menggambarkan…" / "Jawaban yang benar adalah C.".
 */
function detectNarrativeUnlabeledFormat(text: string): boolean {
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let stemCount = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (!NARRATIVE_STEM_END.test(line) || line.length < 40) continue;
    const next = lines.slice(index + 1, index + 6);
    if (next.length < 5) continue;
    const looksLikeOptions = next.every(
      (option) =>
        option.length >= 5 &&
        !NARRATIVE_STEM_END.test(option) &&
        !/^Jawaban\b/i.test(option) &&
        !/^Perhatikan pernyataan/i.test(option),
    );
    if (looksLikeOptions) stemCount += 1;
  }
  const narrativeKeys = [
    ...text.matchAll(
      /Jawaban\s+(?:yang\s+(?:benar|tepat)\s+adalah\s*[:：]?\s*[A-Ea-e]|[A-Ea-e]\s+(?:menggambarkan|mencerminkan|menunjukkan|menjelaskan))/gi,
    ),
  ].length;
  const parenKeys = [...text.matchAll(/\(\s*Jawaban\s*[:：]?\s*[A-Ea-e]\s*\)/gi)].length;
  return (
    stemCount >= 5 &&
    narrativeKeys >= 3 &&
    narrativeKeys > parenKeys &&
    findOptionClusters(text).length <= 2
  );
}

function extractNarrativeAnswerKey(explanation: string): string | null {
  const patterns = [
    /Jawaban\s+yang\s+(?:benar|tepat)\s+adalah\s*[:：]?\s*([A-Ea-e])/i,
    /Jawaban\s+([A-Ea-e])\s+(?:menggambarkan|mencerminkan|menunjukkan|menjelaskan)\b/i,
  ];
  for (const pattern of patterns) {
    const match = explanation.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }
  return null;
}

/**
 * Infer kunci jika pembahasan tanpa "Jawaban X":
 * - pembahasan diawali teks opsi benar, atau
 * - klausa setelah "adalah …" mencocokkan opsi, atau
 * - opsi kombinasi nomor cocok dengan butir yang disebut positif di pembahasan.
 */
function inferNarrativeKeyFromExplanation(
  explanation: string,
  labels: string[],
  promptLines: string[] = [],
): string | null {
  const haystack = explanation.replace(/\s+/g, ' ').trim();
  const haystackLower = haystack.toLowerCase();

  // 1) Pembahasan diawali oleh teks opsi.
  for (let index = 0; index < labels.length; index += 1) {
    const cleaned = (labels[index] ?? '').replace(/^[A-Ea-e]\.\s*/, '').trim();
    const letter = OPTION_LETTERS[index];
    if (!letter || cleaned.length < 28) continue;
    if (haystackLower.startsWith(cleaned.slice(0, 36).toLowerCase())) {
      return letter;
    }
  }

  // 2) Klausa setelah "adalah …" mencocokkan opsi benar.
  const afterAdalah = haystack.match(/\badalah\s+([A-Za-zÀ-ú][^.]{18,140})/);
  if (afterAdalah?.[1]) {
    const fragment = afterAdalah[1].replace(/\s+/g, ' ').trim().toLowerCase();
    for (let index = 0; index < labels.length; index += 1) {
      const cleaned = (labels[index] ?? '').replace(/^[A-Ea-e]\.\s*/, '').trim().toLowerCase();
      const letter = OPTION_LETTERS[index];
      if (!letter || cleaned.length < 20) continue;
      if (fragment.startsWith(cleaned.slice(0, 28)) || cleaned.startsWith(fragment.slice(0, 28))) {
        return letter;
      }
    }
  }

  // 3) Opsi "1,2,3,6" ↔ butir pernyataan; hanya pakai bagian pembahasan yang afirmatif.
  const promptItems = promptLines.filter(
    (line) =>
      line.length >= 12 &&
      line.length <= 140 &&
      !/^Perhatikan pernyataan/i.test(line) &&
      !/^Dari pernyataan di atas/i.test(line) &&
      !NARRATIVE_STEM_END.test(line),
  );

  const positivePart = haystackLower
    .split(/\bmeskipun\b|\btidak secara\b|\btidak sesuai\b|\bdapat memecah\b|\bmeski\b/i)[0]
    ?.toLowerCase() ?? haystackLower;

  const itemMentionedIn = (item: string, haystackText: string) => {
    const lower = item.toLowerCase();
    const paren = lower.match(/\(([^)]+)\)/)?.[1];
    if (paren && haystackText.includes(paren)) return true;
    const distinctive = lower
      .split(/\s+/)
      .map((word) => word.replace(/[^a-zà-ú0-9]/gi, ''))
      .filter((word) => word.length >= 5)
      .filter(
        (word) =>
          !/^(dalam|dengan|untuk|yang|dari|pada|atau|serta|kepada|tentang|kegiatan|sistem)$/.test(
            word,
          ),
      );
    const hits = distinctive.filter((word) => haystackText.includes(word)).length;
    return hits >= 2;
  };

  if (promptItems.length >= 4) {
    let bestLetter: string | null = null;
    let bestScore = -1;
    for (let index = 0; index < labels.length; index += 1) {
      const cleaned = (labels[index] ?? '').replace(/^[A-Ea-e]\.\s*/, '').trim();
      const letter = OPTION_LETTERS[index];
      if (!letter || !/^\d+(?:\s*,\s*\d+){2,}$/.test(cleaned)) continue;
      const nums = [...cleaned.matchAll(/\d+/g)].map((match) => Number(match[0]));
      if (nums.length < 3) continue;
      const selected = nums
        .map((num) => promptItems[num - 1])
        .filter((item): item is string => Boolean(item));
      if (selected.length < nums.length) continue;
      const mentioned = selected.filter((item) => itemMentionedIn(item, positivePart)).length;
      const rejected = promptItems.filter((_, itemIndex) => !nums.includes(itemIndex + 1));
      const rejectedLeak = rejected.filter((item) => itemMentionedIn(item, positivePart)).length;
      // Utamakan set yang lengkap disebut dan paling sedikit "bocor" butir yang seharusnya tidak dipilih.
      const score = mentioned * 10 - rejectedLeak;
      if (mentioned === selected.length && score > bestScore) {
        bestLetter = letter;
        bestScore = score;
      }
    }
    if (bestLetter) return bestLetter;
  }

  return null;
}

function parseNarrativeUnlabeledFormat(text: string, imageQueue: string[]): ParsedQuestion[] {
  const lines = normalizeText(text)
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(?:PENALARAN|SOAL)\b/i.test(line) || line.length > 60);

  const stemIndexes: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (!NARRATIVE_STEM_END.test(line) || line.length < 40) continue;
    const next = lines.slice(index + 1, index + 6);
    if (next.length < 5) continue;
    const looksLikeOptions = next.every(
      (option) =>
        option.length >= 5 &&
        !NARRATIVE_STEM_END.test(option) &&
        !/^Jawaban\b/i.test(option) &&
        !/^Perhatikan pernyataan/i.test(option),
    );
    if (looksLikeOptions) stemIndexes.push(index);
  }

  const questions: ParsedQuestion[] = [];

  stemIndexes.forEach((stemIndex, questionIndex) => {
    const optionLines = lines.slice(stemIndex + 1, stemIndex + 6).map((label) =>
      label.replace(/^[A-Ea-e]\.\s*/, '').trim(),
    );
    const nextStem = stemIndexes[questionIndex + 1] ?? lines.length;
    const explanation = lines.slice(stemIndex + 6, nextStem).join(' ').trim() || '—';

    // Gabung preamble "Perhatikan pernyataan…" + daftar butir sebelum stem (jika ada).
    const promptParts: string[] = [lines[stemIndex] ?? ''];
    const prevLine = stemIndex > 0 ? lines[stemIndex - 1] : '';
    // Stem terpotong: baris sebelumnya diakhiri koma (mis. NKRI … Pancasila,).
    if (
      prevLine &&
      /,$/.test(prevLine) &&
      prevLine.length >= 40 &&
      !/^Jawaban\b/i.test(prevLine) &&
      !stemIndexes.includes(stemIndex - 1)
    ) {
      promptParts.unshift(prevLine);
    }

    const needsPreamble =
      /Dari pernyataan di atas/i.test(lines[stemIndex] ?? '') ||
      lines
        .slice(Math.max(0, stemIndex - 10), stemIndex)
        .some((line) => /^Perhatikan pernyataan/i.test(line));

    if (needsPreamble) {
      for (let cursor = stemIndex - 1; cursor >= 0; cursor -= 1) {
        const line = lines[cursor] ?? '';
        if (/^Jawaban\b/i.test(line)) break;
        if (stemIndexes.includes(cursor)) break;
        const prevStem = stemIndexes[questionIndex - 1];
        if (prevStem !== undefined && cursor <= prevStem + 5) break;
        if (promptParts[0] === line) continue;
        promptParts.unshift(line);
        if (/^Perhatikan pernyataan/i.test(line)) break;
      }
    }

    const options = OPTION_LETTERS.map((_, optionIndex) => ({
      label: optionLines[optionIndex] ?? '',
      imageUrl: null,
      isCorrect: false,
    }));
    const prompt = promptParts.join(' ').replace(/\s+/g, ' ').trim();
    const answerKey =
      extractNarrativeAnswerKey(explanation) ??
      inferNarrativeKeyFromExplanation(explanation, optionLines, promptParts);
    if (answerKey) {
      markCorrectAnswer(options, answerKey);
    }

    const images = applyImageMarkers(prompt, explanation, imageQueue);
    questions.push({
      prompt: images.prompt,
      imageUrl: images.imageUrl,
      explanation: images.explanation || '—',
      explanationImageUrl: images.explanationImageUrl,
      requiresPromptImage: images.requiresPromptImage,
      requiresExplanationImage: images.requiresExplanationImage,
      order: questions.length + 1,
      options,
    });
  });

  return questions;
}

/** Format bank: opsi tanpa A–E + kunci "( Jawaban: E )" / "(Jawaban C)". */
const PAREN_JAWABAN = /\(\s*Jawaban\s*[:：]?\s*([A-Ea-e])\s*\)/gi;

function detectParenJawabanUnlabeledFormat(text: string): boolean {
  const matches = [...text.matchAll(PAREN_JAWABAN)];
  if (matches.length < 3) return false;
  const letteredClusters = findOptionClusters(text).length;
  return letteredClusters <= 1;
}

/** Pecah wilayah sebelum "(Jawaban: X)" menjadi satu/lebih soal (stem + 5 opsi). */
function splitUnlabeledPromptOptionChunks(beforeAnswer: string): Array<{ prompt: string; labels: string[] }> {
  const paragraphs = beforeAnswer
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((part) => !/^\(\s*Jawaban\b/i.test(part));

  if (
    paragraphs.length >= 4 &&
    (paragraphs[0]?.length ?? 0) <= 60 &&
    !/[?：:]$/.test(paragraphs[0] ?? '') &&
    (paragraphs[1]?.length ?? 0) >= 80
  ) {
    paragraphs.shift();
  }

  const chunks: Array<{ prompt: string; labels: string[] }> = [];
  let remaining = [...paragraphs];

  while (remaining.length >= 6) {
    const labels = remaining.slice(-5);
    remaining = remaining.slice(0, -5);

    const promptParts: string[] = [];
    if (remaining.length) {
      promptParts.unshift(remaining.pop()!);
      // Gabung paragraf stem sebelumnya jika masih terlihat lanjutan narasi (bukan opsi).
      while (
        remaining.length > 0 &&
        remaining.length % 6 !== 0 &&
        (remaining[remaining.length - 1]?.length ?? 0) >= 80 &&
        !/^[A-E][.)]/i.test(remaining[remaining.length - 1] ?? '')
      ) {
        // Jika sisa masih bisa membentuk soal penuh (kelipatan 6), jangan menyeret stem soal sebelumnya.
        if (remaining.length >= 6) break;
        promptParts.unshift(remaining.pop()!);
      }
    }

    const prompt = promptParts.join(' ').trim();
    if (prompt.length >= 20 && labels.every((label) => label.length >= 8)) {
      chunks.unshift({ prompt, labels });
    } else {
      break;
    }
  }

  if (!chunks.length) {
    const fallback = parseUnlabeledStemAndOptions(beforeAnswer);
    if (fallback) {
      return [
        {
          prompt: fallback.prompt,
          labels: fallback.options.map((option) => option.label),
        },
      ];
    }
  }

  return chunks;
}

function parseParenJawabanUnlabeledFormat(text: string, imageQueue: string[]): ParsedQuestion[] {
  const normalized = normalizeText(text);
  const matches = [...normalized.matchAll(new RegExp(PAREN_JAWABAN.source, 'gi'))];
  if (matches.length < 2) return [];

  const questions: ParsedQuestion[] = [];
  let regionStart = 0;

  matches.forEach((match, index) => {
    const answerKey = (match[1] ?? 'A').toUpperCase();
    const kunciIndex = match.index ?? 0;
    const before = normalized.slice(regionStart, kunciIndex).trim();
    regionStart = kunciIndex + match[0].length;

    const chunks = splitUnlabeledPromptOptionChunks(before);
    if (!chunks.length) return;

    const gapEnd = matches[index + 1]?.index ?? normalized.length;
    const gap = normalized.slice(regionStart, gapEnd).trim();
    const pembahasan = extractPembahasanSection(gap);
    const explanation = pembahasan?.content?.trim() || '—';

    chunks.forEach((chunk, chunkIndex) => {
      const options = OPTION_LETTERS.map((_, optionIndex) => ({
        label: chunk.labels[optionIndex]?.trim() ?? '',
        imageUrl: null,
        isCorrect: false,
      }));
      // Kunci "(Jawaban: X)" hanya untuk soal terakhir dalam blok (paling dekat ke penanda).
      if (chunkIndex === chunks.length - 1) {
        markCorrectAnswer(options, answerKey);
      }

      const images = applyImageMarkers(chunk.prompt, explanation, imageQueue);
      questions.push({
        prompt: images.prompt,
        imageUrl: images.imageUrl,
        explanation: images.explanation || '—',
        explanationImageUrl: images.explanationImageUrl,
        requiresPromptImage: images.requiresPromptImage,
        requiresExplanationImage: images.requiresExplanationImage,
        order: questions.length + 1,
        options,
      });
    });
  });

  return questions;
}

function parseNumberedJawabBlock(order: number, body: string, imageQueue: string[]): ParsedQuestion | null {
  if (!blockHasMcqOptions(body) && !JAWAB_IN_BLOCK.test(body)) return null;

  const jawabMatch = body.match(JAWAB_IN_BLOCK);
  const answerKey = jawabMatch?.[1]?.toUpperCase() ?? null;
  const beforeJawab =
    jawabMatch?.index !== undefined ? body.slice(0, jawabMatch.index).trim() : body.trim();
  const afterJawab =
    jawabMatch?.index !== undefined
      ? body.slice(jawabMatch.index + jawabMatch[0].length).trim()
      : '';

  const pembahasan = extractPembahasanSection(afterJawab);
  let explanation = pembahasan?.content ?? afterJawab;
  const nextQ = findNextQuestionStart(explanation);
  if (nextQ >= 0) {
    explanation = explanation.slice(0, nextQ).trim();
  }
  // Beberapa bank soal tidak menulis pembahasan — jangan gagal validasi.
  if (!explanation.trim()) {
    explanation = '—';
  }

  let resolvedOptions = parseLineOptions(beforeJawab);
  if (countFilledOptions(resolvedOptions) < 2) {
    resolvedOptions = extractBestOptions(beforeJawab);
  }

  const optionStart = findOptionSectionStart(beforeJawab);
  let prompt = optionStart >= 0 ? beforeJawab.slice(0, optionStart).trim() : beforeJawab;
  prompt = stripKnownSections(prompt, []);

  if (countFilledOptions(resolvedOptions) < 2) {
    const unlabeled = parseUnlabeledStemAndOptions(beforeJawab);
    if (unlabeled) {
      prompt = unlabeled.prompt;
      resolvedOptions = unlabeled.options;
    }
  }

  if (countFilledOptions(resolvedOptions) < 2) return null;

  if (answerKey) {
    markCorrectAnswer(resolvedOptions, answerKey);
  }

  const images = applyImageMarkers(prompt, explanation, imageQueue);

  return {
    prompt: images.prompt || `Soal ${order}`,
    imageUrl: images.imageUrl,
    explanation: images.explanation || '—',
    explanationImageUrl: images.explanationImageUrl,
    requiresPromptImage: images.requiresPromptImage,
    requiresExplanationImage: images.requiresExplanationImage,
    order,
    options: resolvedOptions,
  };
}

/** Format: 1. Pertanyaan ... A. ... Jawab: X ... pembahasan */
function parseNumberedJawabFormat(text: string, imageQueue: string[]): ParsedQuestion[] {
  const blocks = splitNumberedQuestionBlocks(text);
  const questions: ParsedQuestion[] = [];

  for (const block of blocks) {
    const parsed = parseNumberedJawabBlock(block.order, block.body, imageQueue);
    if (parsed) {
      questions.push(parsed);
    }
  }

  return questions;
}

function splitQuestionBlocks(text: string): Array<{ order: number; body: string }> {
  const normalized = normalizeText(text);
  const blocks: Array<{ order: number; body: string }> = [];
  const matches = [...normalized.matchAll(SOAL_SPLIT)];

  if (!matches.length) {
    return blocks;
  }

  matches.forEach((match, index) => {
    const order = Number(match[1]) || index + 1;
    const start = (match.index ?? 0) + match[0].length;
    const nextMatch = matches[index + 1];
    const end = nextMatch?.index ?? normalized.length;
    const body = normalized.slice(start, end).trim();
    if (body) {
      blocks.push({ order, body });
    }
  });

  return blocks;
}

function countFilledOptions(options: ParsedQuestion['options']) {
  return options.filter((option) => option.label?.trim() || option.imageUrl?.trim()).length;
}

/** Pisah opsi A–E dari teks inline: A. ...B. ... atau per baris. */
function parseInlineOptions(optionsText: string): ParsedQuestion['options'] {
  const patterns = [
    /(?:^|\n)\s*([A-Ea-e])[.)]\s*/g,
    /([A-E])[.)]\s*(?=\S)/g,
    /(?:^|\n)\s*\(([A-Ea-e])\)\s*/g,
    /\(([A-E])\)(?=\S)/g,
    /(?:^|\n)\s*([A-Ea-e])[:：=\-]\s+/g,
    /([A-E])[:：=\-]\s+/g,
  ];

  const byLetter = new Map<string, string>();

  for (const regex of patterns) {
    const matches = [...optionsText.matchAll(regex)];
    for (let i = 0; i < matches.length; i += 1) {
      const letter = (matches[i]![1] ?? '').toUpperCase();
      if (!['A', 'B', 'C', 'D', 'E'].includes(letter)) continue;
      const start = (matches[i]!.index ?? 0) + matches[i]![0].length;
      const end = matches[i + 1]?.index ?? optionsText.length;
      const label = optionsText.slice(start, end).trim();
      if (!byLetter.has(letter) || (byLetter.get(letter)?.length ?? 0) < label.length) {
        byLetter.set(letter, label);
      }
    }
  }

  if (byLetter.size >= 2) {
    return ['A', 'B', 'C', 'D', 'E'].map((letter) => ({
      label: byLetter.get(letter) ?? '',
      imageUrl: null,
      isCorrect: false,
    }));
  }

  return Array.from({ length: 5 }, () => ({ label: '', imageUrl: null, isCorrect: false }));
}

function parseLineOptions(text: string): ParsedQuestion['options'] {
  const options: ParsedQuestion['options'] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(OPTION_LINE);
    const letter = match?.[1] ?? match?.[2] ?? match?.[3];
    const label = match?.[4]?.trim();
    if (letter && label && OPTION_LETTERS.includes(letter.toUpperCase() as (typeof OPTION_LETTERS)[number])) {
      options.push({
        label,
        imageUrl: null,
        isCorrect: false,
      });
    }
  }

  while (options.length < 5) {
    options.push({ label: '', imageUrl: null, isCorrect: false });
  }

  return options.slice(0, 5);
}

function extractBestOptions(text: string): ParsedQuestion['options'] {
  const lineOpts = parseLineOptions(text);
  const inlineOpts = parseInlineOptions(text);
  const lineCount = countFilledOptions(lineOpts);
  const inlineCount = countFilledOptions(inlineOpts);

  if (lineCount >= 2 && lineCount >= inlineCount) return lineOpts;
  if (inlineCount > lineCount) return inlineOpts;
  return lineOpts;
}

function findOptionSectionStart(text: string): number {
  const patterns = [
    /(?:^|[\s.!?…])A[.)]\s+(?=\S)/im,
    /(?:^|\n)\s*\(?[A-Ea-e][)\].]\s+/im,
    /(?:^|\n)\s*A[.)]\s+/im,
    /(?:^|\n|\s)([A-E])[.)]\s+/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.index !== undefined) {
      if (pattern.source.includes('A[.)]')) {
        const letterIndex = match[0].search(/A[.)]/i);
        return match.index + (letterIndex >= 0 ? letterIndex : 0);
      }
      return match.index;
    }
  }
  return -1;
}

function extractPembahasanSection(text: string): { content: string; raw: string } | null {
  const match = text.match(PEMBAHASAN_HEADER);
  if (!match || match.index === undefined) return null;

  const start = match.index + match[0].length;
  let content = text.slice(start).trim();

  // Potong jika ada indikasi soal berikutnya
  const nextQ = content.match(NEXT_QUESTION_HINT);
  if (nextQ?.index !== undefined) {
    content = content.slice(0, nextQ.index).trim();
  }

  return { content, raw: text.slice(match.index) };
}

function stripKnownSections(text: string, parts: string[]): string {
  let next = text;
  for (const part of parts) {
    if (part) {
      next = next.replace(part, ' ');
    }
  }
  return next.replace(FLEXIBLE_KUNCI, ' ').replace(PEMBAHASAN_HEADER, ' ').replace(/\s+/g, ' ').trim();
}

function applyImageMarkers(
  prompt: string,
  explanation: string,
  _imageQueue?: string[],
): {
  prompt: string;
  explanation: string;
  imageUrl: string | null;
  explanationImageUrl: string | null;
  requiresPromptImage: boolean;
  requiresExplanationImage: boolean;
} {
  let nextPrompt = prompt;
  let nextExplanation = explanation;
  let requiresPromptImage = false;
  let requiresExplanationImage = false;

  // Marker [GAMBAR] = admin wajib isi URL; jangan ekstrak/simpan file dari Word.
  if (/\[GAMBAR\]/i.test(nextPrompt)) {
    nextPrompt = nextPrompt.replace(GAMBAR_MARKER, '').trim();
    requiresPromptImage = true;
  }

  if (/\[GAMBAR\]/i.test(nextExplanation)) {
    nextExplanation = nextExplanation.replace(GAMBAR_MARKER, '').trim();
    requiresExplanationImage = true;
  }

  return {
    prompt: nextPrompt,
    explanation: nextExplanation,
    imageUrl: null,
    explanationImageUrl: null,
    requiresPromptImage,
    requiresExplanationImage,
  };
}

function markCorrectAnswer(options: ParsedQuestion['options'], answerKey: string) {
  const letters = [...new Set(answerKey.toUpperCase().match(/[A-E]/g) ?? [])];
  letters.forEach((letter) => {
    const targetIndex = letter.charCodeAt(0) - 'A'.charCodeAt(0);
    if (options[targetIndex]) {
      options[targetIndex].isCorrect = true;
    }
  });
}

/** Infer kunci dari jumlah butir terdaftar di pembahasan (mis. 1.Parkir 2.Toko 3.Pasar → opsi "3"). */
function inferCountAnswerFromExplanation(
  explanation: string,
  options: ParsedQuestion['options'],
): string | null {
  const numberedItems = [...explanation.matchAll(/(?:^|\n)\s*\d+\s*[\.\)]\s*\S/g)];
  if (numberedItems.length < 2) return null;
  const countLabel = String(numberedItems.length);
  const index = options.findIndex((option) => (option.label ?? '').trim() === countLabel);
  return index >= 0 ? OPTION_LETTERS[index] ?? null : null;
}

type OptionCluster = {
  start: number;
  end: number;
  options: ParsedQuestion['options'];
};

/** Klaster opsi A–E berurutan (termasuk menempel: A.teksB.teks). */
function findOptionClusters(text: string): OptionCluster[] {
  const allMarkers = findAllOptionMarkers(text);
  const clusters: OptionCluster[] = [];
  /** Opsi A–E biasanya berdekatan; cegah D/E dari soal berikutnya ikut tertarik. */
  const MAX_OPTION_GAP = 120;

  for (let i = 0; i < allMarkers.length; i += 1) {
    if (allMarkers[i]?.letter !== 'A') continue;

    const picked: Array<{ letter: string; index: number; end: number }> = [];
    let expected = 0;
    let lastEnd = allMarkers[i]!.index;

    for (let j = i; j < allMarkers.length && expected < OPTION_LETTERS.length; j += 1) {
      const marker = allMarkers[j]!;
      const target = OPTION_LETTERS[expected];
      if (!target || marker.letter !== target) continue;
      if (picked.length > 0 && marker.index < lastEnd - 1) continue;
      if (picked.length > 0 && marker.index - lastEnd > MAX_OPTION_GAP) continue;
      picked.push(marker);
      lastEnd = marker.end;
      expected += 1;
    }

    if (picked.length < 4) continue;

    const lastMarker = picked[picked.length - 1]!;
    const afterLast = text.slice(lastMarker.end);
    const stop = afterLast.search(
      /\n\s*(?:👉\s*)?(?:Jawaban|Pembahasan|Kesimpulan|✅|Diketahui|Langkah|Posisi\s+Awal|Misalkan)\b|\n\s*[A-E]\.(?=\s*\S)|\n{2,}|\n\s*[→✔️❌]/i,
    );
    const labelEnd = lastMarker.end + (stop >= 0 ? stop : Math.min(80, afterLast.length));

    const options: ParsedQuestion['options'] = OPTION_LETTERS.map((_, index) => {
      const marker = picked[index];
      if (!marker) return { label: '', imageUrl: null, isCorrect: false };
      const end = picked[index + 1]?.index ?? labelEnd;
      // Ambil baris pertama saja — hindari pembahasan yang menempel setelah opsi terakhir.
      const label = text
        .slice(marker.end, end)
        .split(/\n/)[0]
        ?.trim()
        .replace(/\.\s*$/, '')
        .trim() ?? '';
      return { label, imageUrl: null, isCorrect: false };
    });

    const joined = options.map((option) => option.label).join(' ');
    // Lewati daftar pembahasan opsi (bukan soal).
    if (/[→✔️❌]/.test(joined) || /\b(berarti|memiliki arti|terlalu umum)\b/i.test(joined)) {
      continue;
    }

    clusters.push({ start: picked[0]!.index, end: labelEnd, options });
  }

  clusters.sort((a, b) => a.start - b.start);
  const deduped: OptionCluster[] = [];
  for (const cluster of clusters) {
    const prev = deduped[deduped.length - 1];
    if (prev && cluster.start < prev.end) continue;
    deduped.push(cluster);
  }
  return deduped;
}

function extractAnswerKeyFromRegion(region: string): string | null {
  // Izinkan baris baru / emoji di antara label "Jawaban" dan huruf kunci.
  const patterns: RegExp[] = [
    /(?:➡️|→)\s*([A-Ea-e])(?:\s*[\.:)（]|\s+\d|\s*$)/i,
    /Jawaban\s*Akhir\s*[:：]?\s*(?:\r?\n\s*)*(?:👉|✅)?\s*([A-Ea-e])(?:\s*dan\s*([A-Ea-e]))?/i,
    /Jawaban\s*benar\s*[:：]?\s*(?:\r?\n\s*)*([A-Ea-e])/i,
    /(?:👉|✅)\s*Jawaban\s*[:：]?\s*(?:\r?\n\s*)*([A-Ea-e])(?:\s*dan\s*([A-Ea-e]))?/i,
    /Jawaban\s*[:：]\s*(?:\r?\n\s*)*(?:👉|✅)?\s*([A-Ea-e])(?:\s*dan\s*([A-Ea-e]))?/i,
    /(?:👉|✅)\s*A\s*dan\s*B\b/i,
    /(?:👉|✅)\s*([A-Ea-e])(?:\s*dan\s*([A-Ea-e]))?\s*[\.:)（]/i,
  ];

  for (const pattern of patterns) {
    const match = region.match(pattern);
    if (!match) continue;
    if (/A\s*dan\s*B/i.test(match[0])) return 'AB';
    const letters = [match[1], match[2]].filter(Boolean).join('');
    if (letters) return letters.toUpperCase();
  }
  return null;
}

function optionsLookLikeSequence(options: ParsedQuestion['options']): boolean {
  const labels = options.map((option) => option.label.trim()).filter(Boolean);
  if (labels.length < 4) return false;
  return labels.filter((label) => /^\d+(?:\s*[–—\-]\s*\d+){2,}/.test(label)).length >= 3;
}

/** Infer kunci susun gambar dari pembahasan "awal N … terakhir M". */
function inferSequenceAnswerKey(
  explanation: string,
  options: ParsedQuestion['options'],
): string | null {
  const start = explanation.match(/Gambar\s+(\d+)\s+cocok sebagai awal/i)?.[1];
  const end =
    explanation.match(/Terakhir\s+(\d+)/i)?.[1] ??
    explanation.match(/Gambar\s+(\d+)\s+cocok sebagai akhir/i)?.[1];
  if (!start || !end) return null;

  const index = options.findIndex((option) => {
    const nums = option.label.match(/\d+/g);
    return Boolean(nums?.length && nums[0] === start && nums[nums.length - 1] === end);
  });
  return index >= 0 ? OPTION_LETTERS[index] ?? null : null;
}

function extractPromptBeforeCluster(region: string): string {
  let text = region.trim();
  if (!text) return '';

  const answerMarkers = ['jawaban akhir', '👉 jawaban', 'jawaban benar', '✅ jawaban', 'kesimpulan akhir', 'kesimpulan:'];
  let cutAt = -1;
  const lower = text.toLowerCase();
  for (const marker of answerMarkers) {
    const idx = lower.lastIndexOf(marker);
    if (idx > cutAt) cutAt = idx;
  }
  // Juga potong setelah baris kunci "👉 A." / "✅ C. 30" dari soal sebelumnya.
  const keyLine = [...text.matchAll(/(?:👉|✅)\s*[A-Ea-e]\s*[\.:)（]/g)].pop();
  if (keyLine?.index !== undefined && keyLine.index >= cutAt) {
    cutAt = keyLine.index;
  }
  if (cutAt >= 0) {
    const after = text.slice(cutAt);
    // Lewati baris kunci, ambil paragraf soal berikutnya.
    const afterKey = after.replace(/^(?:👉|✅)?\s*(?:Jawaban(?:\s*Akhir|\s*benar)?\s*[:：]?)?\s*(?:👉|✅)?\s*[A-Ea-e][^\n]*/i, '');
    const gap = afterKey.search(/\n\s*\n/);
    text = (gap >= 0 ? afterKey.slice(gap) : afterKey).trim();
  }

  text = text
    .replace(/^(?:LATIHAN[^\n]*\n)+/i, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/^JAWABAN\s*[:：][\s\S]*?(?=\n\n[A-ZÀ-ú])/i, '')
    .trim();

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((part) => !/^(gambar\s*[a-e]|diketahui|misalkan|langkah|rumus|posisi awal|pembahasan)/i.test(part))
    .filter((part) => !/^(?:👉|✅)\s*[A-Ea-e]\b/i.test(part));

  for (let i = paragraphs.length - 1; i >= 0; i -= 1) {
    const paragraph = paragraphs[i]!;
    if (/[?？…]$/.test(paragraph) || paragraph.length >= 35) {
      return paragraph;
    }
  }

  return paragraphs[paragraphs.length - 1] ?? text.replace(/\s+/g, ' ').trim();
}

function detectOptionClusterFormat(text: string): boolean {
  const clusters = findOptionClusters(text);
  const numbered = [...text.matchAll(NUMBERED_QUESTION_START)].length;
  return clusters.length >= 5 && numbered <= 5;
}

/**
 * Format bank psiko/campuran: soal bertumpuk dengan opsi A–E menempel,
 * kunci di "Jawaban: C" / "✅ A dan B" / "Jawaban Akhir: 👉 A".
 */
function parseOptionClusterFormat(text: string, imageQueue: string[]): ParsedQuestion[] {
  const normalized = normalizeText(text);
  const clusters = findOptionClusters(normalized);
  if (clusters.length < 3) return [];

  const questions: ParsedQuestion[] = [];
  let order = 1;
  let firstPromptStart = 0;

  // Soal gambar di awal (sebelum klaster teks pertama).
  const head = normalized.slice(0, clusters[0]!.start);
  if (/Gambar\s*[B-E]/i.test(head) || /Jawaban\s*benar\s*[:：]?\s*[A-Ea-e]/i.test(head)) {
    const answerKey = extractAnswerKeyFromRegion(head) ?? 'E';
    const options: ParsedQuestion['options'] = OPTION_LETTERS.map((letter) => ({
      label: `Gambar ${letter}`,
      imageUrl: null,
      isCorrect: false,
    }));
    markCorrectAnswer(options, answerKey);
    const prompt =
      'Perhatikan pola pada gambar, lalu pilih gambar lanjutan yang tepat.';
    const explanationMatch = head.match(/JAWABAN\s*[:：]([\s\S]*?)(?:Jawaban\s*benar|$)/i);
    questions.push({
      prompt,
      imageUrl: null,
      explanation: explanationMatch?.[1]?.trim() || head.slice(0, 800),
      explanationImageUrl: null,
      order: order++,
      options,
    });

    const answerLine = head.match(/Jawaban\s*benar[\s\S]*?(?=\n\s*\n)/i);
    if (answerLine?.index !== undefined) {
      firstPromptStart = answerLine.index + answerLine[0].length;
    }
  }

  for (let i = 0; i < clusters.length; i += 1) {
    const cluster = clusters[i]!;
    const prevEnd = i === 0 ? firstPromptStart : clusters[i - 1]!.end;
    const promptRegion = normalized.slice(prevEnd, cluster.start);
    const nextStart = clusters[i + 1]?.start ?? normalized.length;
    const afterRegion = normalized.slice(cluster.end, nextStart);

    const looksLikeSequenceOptions = optionsLookLikeSequence(cluster.options);
    let prompt = extractPromptBeforeCluster(promptRegion);
    if ((!prompt || prompt.length < 8) && looksLikeSequenceOptions) {
      prompt = 'Susun potongan gambar ke dalam urutan yang tepat.';
    }
    if (!prompt || prompt.length < 8) continue;

    const options = cluster.options.map((option) => ({ ...option }));
    // Hanya ambil kunci dari wilayah SETELAH opsi (jangan fallback ke pembahasan soal sebelumnya).
    const answerKey =
      extractAnswerKeyFromRegion(afterRegion) ??
      (looksLikeSequenceOptions ? inferSequenceAnswerKey(afterRegion, options) : null);
    if (answerKey) {
      markCorrectAnswer(options, answerKey);
    }

    let explanation = afterRegion.trim();
    const nextQHint = explanation.search(
      /\n\s*(?:Pilihlah|Berapakah|Sebuah|Andi |Anton |Di sebuah|Semua |Tajam |Jika |Rina |Kesimpulan yang)/i,
    );
    if (nextQHint > 40) {
      explanation = explanation.slice(0, nextQHint).trim();
    }
    explanation = explanation.replace(/^(?:JAWABAN|Jawaban)\s*[:：]?\s*/i, '').trim();

    const question: ParsedQuestion = {
      prompt,
      imageUrl: null,
      explanation: explanation.slice(0, 2000),
      explanationImageUrl: null,
      // Soal susun gambar: minta URL soal jika dokumen memuat media.
      requiresPromptImage: Boolean(looksLikeSequenceOptions && imageQueue.length),
      order: order++,
      options,
    };

    questions.push(question);
  }

  return questions;
}

/**
 * Parser otomatis — analisis struktur soal walaupun urutan acak.
 * Anchor: setiap baris/posisi "Kunci/Jawaban: X".
 * Opsi & pembahasan dicari di sekitar anchor (sebelum/sesudah).
 */
function parseAutoFormat(text: string, imageQueue: string[]): ParsedQuestion[] {
  const normalized = normalizeText(text);
  const kunciMatches = [...normalized.matchAll(FLEXIBLE_KUNCI)];
  if (!kunciMatches.length) return [];

  const questions: ParsedQuestion[] = [];
  let searchStart = 0;

  kunciMatches.forEach((kunciMatch, index) => {
    const order = index + 1;
    const kunciIndex = kunciMatch.index ?? 0;
    const answerKey = (kunciMatch[1] ?? 'A').toUpperCase();

    const beforeKunci = normalized.slice(searchStart, kunciIndex).trim();
    const afterKunciStart = kunciIndex + kunciMatch[0].length;
    const nextKunciIndex = kunciMatches[index + 1]?.index ?? normalized.length;
    let afterKunci = normalized.slice(afterKunciStart, nextKunciIndex).trim();

    const pembAfter = extractPembahasanSection(afterKunci);
    const pembBefore = extractPembahasanSection(beforeKunci);

    let explanation = pembAfter?.content ?? pembBefore?.content ?? afterKunci;
    if (pembAfter) {
      explanation = pembAfter.content;
    } else if (pembBefore) {
      explanation = pembBefore.content;
    } else {
      const nextQ = findNextQuestionStart(afterKunci);
      explanation = nextQ >= 0 ? afterKunci.slice(0, nextQ).trim() : afterKunci;
    }

    if (kunciMatches[index + 1]) {
      const nextQ = findNextQuestionStart(afterKunci);
      searchStart = nextQ >= 0 ? afterKunciStart + nextQ : nextKunciIndex;
    } else {
      searchStart = normalized.length;
    }

    const optionSourceBefore = pembBefore
      ? beforeKunci.replace(pembBefore.raw, '').trim()
      : beforeKunci;
    let options = extractBestOptions(optionSourceBefore);
    if (countFilledOptions(options) < 2) {
      const fromAfter = extractBestOptions(afterKunci.split(PEMBAHASAN_HEADER)[0] ?? afterKunci);
      if (countFilledOptions(fromAfter) >= countFilledOptions(options)) {
        options = fromAfter;
      }
    }

    const optionStart = findOptionSectionStart(optionSourceBefore);
    let prompt = optionSourceBefore;
    if (optionStart >= 0) {
      prompt = optionSourceBefore.slice(0, optionStart).trim();
    }
    prompt = stripKnownSections(prompt, [pembBefore?.raw ?? '']);

    if (!prompt || prompt.length < 15) {
      prompt = stripKnownSections(beforeKunci, [pembBefore?.raw ?? '', optionSourceBefore]);
    }

    if (countFilledOptions(options) < 2) {
      const unlabeled = parseUnlabeledStemAndOptions(optionSourceBefore);
      if (unlabeled) {
        prompt = unlabeled.prompt;
        options = unlabeled.options;
      }
    }

    markCorrectAnswer(options, answerKey);

    const images = applyImageMarkers(prompt, explanation, imageQueue);

    questions.push({
      prompt: images.prompt || `Soal ${order}`,
      imageUrl: images.imageUrl,
      explanation: images.explanation,
      explanationImageUrl: images.explanationImageUrl,
      requiresPromptImage: images.requiresPromptImage,
      requiresExplanationImage: images.requiresExplanationImage,
      order,
      options,
    });
  });

  return questions;
}

function parseQuestionBlock(order: number, body: string, imageQueue: string[]): ParsedQuestion {
  const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);
  const promptLines: string[] = [];
  const options: ParsedQuestion['options'] = [];
  let explanation = '';
  let answerKey = '';
  let phase: 'prompt' | 'options' | 'footer' = 'prompt';

  for (const line of lines) {
    const optionMatch = line.match(OPTION_LINE);
    const kunciMatch = line.match(KUNCI_LINE);
    const pembahasanMatch = line.match(PEMBAHASAN_LINE);

    if (kunciMatch?.[1]) {
      answerKey = kunciMatch[1].toUpperCase();
      phase = 'footer';
      continue;
    }

    if (pembahasanMatch) {
      explanation = pembahasanMatch[1]?.trim() ?? '';
      phase = 'footer';
      continue;
    }

    const optionLetter = optionMatch?.[1] ?? optionMatch?.[2] ?? optionMatch?.[3];
    const optionLabel = optionMatch?.[4];
    if (optionLetter && optionLabel && phase !== 'footer') {
      phase = 'options';
      options.push({
        label: optionLabel.trim(),
        imageUrl: null,
        isCorrect: false,
      });
      continue;
    }

    if (phase === 'footer') {
      explanation = explanation ? `${explanation}\n${line}` : line;
      continue;
    }

    if (phase === 'options') {
      const lastOption = options[options.length - 1];
      if (lastOption) {
        lastOption.label = `${lastOption.label} ${line}`.trim();
      }
      continue;
    }

    promptLines.push(line);
  }

  if (answerKey) {
    markCorrectAnswer(options, answerKey);
  }

  while (options.length < 5) {
    options.push({ label: '', imageUrl: null, isCorrect: false });
  }

  const prompt = promptLines.join('\n').trim();
  const images = applyImageMarkers(prompt, explanation.trim(), imageQueue);

  return {
    prompt: images.prompt || `Soal ${order}`,
    imageUrl: images.imageUrl,
    explanation: images.explanation,
    explanationImageUrl: images.explanationImageUrl,
    requiresPromptImage: images.requiresPromptImage,
    requiresExplanationImage: images.requiresExplanationImage,
    order,
    options: options.slice(0, 5),
  };
}

function isLegacyDocFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.doc';
}

/** Baca teks dari .docx (mammoth) atau .doc lama (word-extractor). */
async function extractTextFromWordFile(filePath: string): Promise<string> {
  if (isLegacyDocFile(filePath)) {
    const extractor = new WordExtractor();
    const extracted = await extractor.extract(filePath);
    return extracted.getBody() ?? '';
  }
  const { value } = await mammoth.extractRawText({ path: filePath });
  return value;
}

/** Hanya menghitung media di .docx — .doc lama tidak diekstrak gambarnya. */
async function countImagesInDocx(filePath: string): Promise<number> {
  if (isLegacyDocFile(filePath)) return 0;
  const buffer = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const mediaPrefix = 'word/media/';

  return Object.entries(zip.files).filter(([name, file]) => name.startsWith(mediaPrefix) && !file.dir).length;
}

function buildEmbeddedImageWarnings(
  questions: ParsedQuestion[],
  embeddedImageCount: number,
): ConversionWarning[] {
  if (embeddedImageCount <= 0) return [];

  const warnings: ConversionWarning[] = [
    {
      row: 0,
      field: 'images',
      message: `Dokumen berisi ${embeddedImageCount} gambar. File gambar dari Word tidak disimpan otomatis agar storage tidak penuh — unggah gambar ke hosting lalu isi URL di kolom gambar soal/opsi/pembahasan.`,
    },
  ];

  const hasRowImageError = questions.some((question) => {
    if (question.requiresPromptImage && !question.imageUrl?.trim()) return true;
    if (question.requiresExplanationImage && !question.explanationImageUrl?.trim()) return true;
    return question.options.some((option) => isImageOptionLabel(option.label) && !option.imageUrl?.trim());
  });

  // Jika parser belum menandai baris spesifik, tetap minta admin isi URL di preview.
  if (!hasRowImageError) {
    warnings.push({
      row: 0,
      field: 'images',
      message:
        'Isi URL gambar pada soal yang memakai gambar. Unduh CSV diblokir sampai URL gambar yang wajib sudah diisi.',
    });
  }

  return warnings;
}

export async function parseExamDocx(filePath: string): Promise<ParseDocxResult> {
  const embeddedImageCount = await countImagesInDocx(filePath);

  const rawText = await extractTextFromWordFile(filePath);
  const text = normalizeText(rawText);
  // Slot kosong: panjang = jumlah media (untuk deteksi kebutuhan URL), tanpa path file.
  const imageQueue = Array.from({ length: embeddedImageCount }, () => '');

  const blocks = splitQuestionBlocks(text);
  let questions: ParsedQuestion[] = [];
  let parseMode: 'template' | 'auto' = 'auto';

  if (blocks.length) {
    parseMode = 'template';
    questions = blocks.map((block) => parseQuestionBlock(block.order, block.body, imageQueue));
  } else if (detectNoSoalKunciFormat(text)) {
    questions = parseNoSoalKunciFormat(text, imageQueue);
  } else if (detectNumberedPembahasanFormat(text)) {
    questions = parseNumberedPembahasanFormat(text, imageQueue);
  } else if (detectParenJawabanUnlabeledFormat(text)) {
    questions = parseParenJawabanUnlabeledFormat(text, imageQueue);
  } else if (detectNarrativeUnlabeledFormat(text)) {
    questions = parseNarrativeUnlabeledFormat(text, imageQueue);
  } else if (detectOptionClusterFormat(text)) {
    questions = parseOptionClusterFormat(text, imageQueue);
  } else if (detectNumberedJawabFormat(text)) {
    questions = parseNumberedJawabFormat(text, imageQueue);
  } else {
    questions = parseAutoFormat(text, imageQueue);
  }

  const warnings = [
    ...validateQuestions(questions),
    ...buildEmbeddedImageWarnings(questions, embeddedImageCount),
  ];

  if (parseMode === 'auto' && questions.length > 0) {
    warnings.unshift({
      row: 0,
      field: 'auto',
      message: `${questions.length} soal terdeteksi otomatis (format fleksibel). Periksa preview sebelum unduh CSV.`,
    });
  }

  if (!questions.length && text.length > 0) {
    warnings.push({
      row: 0,
      field: 'format',
      message:
        'Tidak ada soal terdeteksi. Pastikan setiap soal memiliki opsi A–E dan kunci jawaban (mis. Kunci: B, Kunci Jawaban: B, atau Jawab: C). Pembahasan sangat disarankan.',
    });
  }

  return { questions, warnings, extractedImages: [], embeddedImageCount };
}
