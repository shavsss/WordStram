export interface CaptionDetector {
  source: string;
  detect(): Promise<HTMLElement | null>;
  processCaption(caption: HTMLElement): void;
  processTextNode(textNode: Text): void;
  startObserving(captionContainer: HTMLElement): void;
  stopObserving(): void;
  cleanup(): void;
} 