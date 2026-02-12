import fs from 'fs';
import chardet from 'chardet';
import iconv from 'iconv-lite';
import { parse } from 'csv-parse/sync';

type ParsedQuestion = {
  prompt: string;
  imageUrl?: string | null;
  explanation?: string | null;
  explanationImageUrl?: string | null;
  order?: number;
  options: Array<{ label: string; imageUrl?: string | null; isCorrect?: boolean }>;
};

type CsvRow = Record<string, string>;

function normalizeBoolean(value: string | undefined) {
  if (!value) return false;
  const val = value.trim().toLowerCase();
  return val === 'true' || val === '1' || val === 'y';
}

const OPTION_KEY_ORDER = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e'];
const CSV_HEADERS = [
  'prompt',
  'prompt_image',
  'explanation',
  'explanationImageUrl',
  'order',
  'option_a',
  'option_a_image',
  'option_a_correct',
  'option_b',
  'option_b_image',
  'option_b_correct',
  'option_c',
  'option_c_image',
  'option_c_correct',
  'option_d',
  'option_d_image',
  'option_d_correct',
  'option_e',
  'option_e_image',
  'option_e_correct',
];
const TEXT_COLUMNS = new Set([
  'prompt',
  'prompt_image',
  'explanation',
  'explanationImageUrl',
  'explanation_image',
  'option_a',
  'option_a_image',
  'option_b',
  'option_b_image',
  'option_c',
  'option_c_image',
  'option_d',
  'option_d_image',
  'option_e',
  'option_e_image',
]);

function stripBom(value: string | undefined) {
  if (!value) return '';
  return value.replace(/^\ufeff/, '');
}

function normalizeCell(value: string | undefined) {
  if (!value) return '';
  return stripBom(value).replace(/^"+|"+$/g, '').trim();
}

function detectDelimiter(content: string) {
  const headerLine = stripBom(content.split(/\r?\n/).find((line) => line.trim().length > 0) ?? '');
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const semicolonCount = (headerLine.match(/;/g) ?? []).length;
  if (semicolonCount > commaCount && semicolonCount >= 5) {
    return ';';
  }
  return ',';
}

function extractHeaders(content: string, delimiter: string) {
  const headerLine = stripBom(content.split(/\r?\n/).find((line) => line.trim().length > 0) ?? '');
  if (!headerLine) {
    return CSV_HEADERS;
  }
  const headers = headerLine.split(delimiter).map((header) => normalizeCell(header));
  return headers.length ? headers : CSV_HEADERS;
}

function parseLegacyCsv(content: string, delimiter: string, headers: string[]): CsvRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => stripBom(line).trim())
    .filter((line) => line.length > 0);
  if (!lines.length) {
    return [];
  }
  lines.shift();
  const rows: CsvRow[] = [];
  for (const rawLine of lines) {
    const tokens = rawLine.split(delimiter);
    const row: CsvRow = {};
    let tokenIndex = 0;
    headers.forEach((header, headerIndex) => {
      const isLastColumn = headerIndex === headers.length - 1;
      const isTextual = TEXT_COLUMNS.has(header);
      if (isLastColumn) {
        const remaining = tokens.slice(tokenIndex).join(delimiter);
        row[header] = normalizeCell(remaining);
        tokenIndex = tokens.length;
        return;
      }

      if (isTextual) {
        const chunk: string[] = [];
        while (tokenIndex < tokens.length) {
          const nextToken = tokens[tokenIndex++] ?? '';
          chunk.push(nextToken);
          const remainingTokens = tokens.length - tokenIndex;
          const remainingColumns = headers.length - headerIndex - 1;
          if (remainingTokens <= remainingColumns) {
            break;
          }
        }
        row[header] = normalizeCell(chunk.join(delimiter));
        return;
      }

      row[header] = normalizeCell(tokens[tokenIndex++]);
    });
    rows.push(row);
  }
  return rows;
}

function readCsvRows(filePath: string): CsvRow[] {
  const buffer = fs.readFileSync(filePath);
  const detected = chardet.detect(buffer) ?? 'UTF-8';
  const normalized = String(detected).toUpperCase();
  const encoding = normalized === 'UTF8' || normalized === 'UTF-8' ? 'utf8' : normalized;
  const content = iconv.decode(buffer, encoding);
  const delimiter = detectDelimiter(content);
  try {
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter,
    }) as CsvRow[];
  } catch (error) {
    if (error instanceof Error && /Invalid Record Length/i.test(error.message)) {
      const headers = extractHeaders(content, delimiter);
      return parseLegacyCsv(content, delimiter, headers);
    }
    throw error;
  }
}

function parseOptions(row: CsvRow) {
  const options: Array<{ label: string; imageUrl?: string | null; isCorrect?: boolean }> = [];
  const discoveredKeys = Object.keys(row).filter((key) => key.startsWith('option_') && !key.endsWith('_correct'));
  const orderedKeys = [...OPTION_KEY_ORDER, ...discoveredKeys].filter((key, index, arr) => arr.indexOf(key) === index);

  orderedKeys.forEach((key) => {
    const label = row[key]?.trim();
    if (!label) return;
    const correctKey = `${key}_correct`;
    const imageKey = `${key}_image`;
    options.push({ label, imageUrl: row[imageKey]?.trim() || null, isCorrect: normalizeBoolean(row[correctKey]) });
  });

  return options;
}

export function parseTryoutCsv(filePath: string): ParsedQuestion[] {
  const records = readCsvRows(filePath);
  return records.map((row, index) => {
    const explanation = row.explanation?.trim();
    if (!explanation) {
      throw new Error(`CSV tryout: pembahasan wajib diisi (baris ${index + 2}).`);
    }
    const explanationImageUrl = row.explanationImageUrl?.trim() || row.explanation_image?.trim() || null;
    const parsedOrder = Number(row.order);
    return {
      prompt: row.prompt?.trim() ?? `Soal ${index + 1}`,
      imageUrl: row.prompt_image?.trim() || null,
      explanation,
      explanationImageUrl,
      order: Number.isFinite(parsedOrder) ? parsedOrder : index + 1,
      options: parseOptions(row),
    };
  });
}

export function parsePracticeCsv(filePath: string): ParsedQuestion[] {
  const records = readCsvRows(filePath);
  return records.map((row, index) => {
    const explanation = row.explanation?.trim();
    if (!explanation) {
      throw new Error(`CSV latihan: pembahasan wajib diisi (baris ${index + 2}).`);
    }
    const explanationImageUrl = row.explanationImageUrl?.trim() || row.explanation_image?.trim() || null;
    const parsedOrder = Number(row.order);
    return {
      prompt: row.prompt?.trim() ?? `Soal ${index + 1}`,
      imageUrl: row.prompt_image?.trim() || null,
      explanation,
      explanationImageUrl,
      order: Number.isFinite(parsedOrder) ? parsedOrder : index + 1,
      options: parseOptions(row),
    };
  });
}
