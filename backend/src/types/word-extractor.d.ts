declare module 'word-extractor' {
  export default class WordExtractor {
    extract(filePath: string): Promise<{
      getBody(): string;
      getHeaders(): unknown;
      getFooters(): unknown;
      getAnnotations(): unknown;
      getTextboxes(): unknown;
      getEndNotes(): unknown;
      getFootnotes(): unknown;
    }>;
  }
}
