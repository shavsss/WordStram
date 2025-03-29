import { getCaptionDetector } from '@/services/caption-detectors';
import type { ContentSource, CaptionDetector } from '@/types';

export class CaptionManager {
  private detector: CaptionDetector;
  private isActive = false;

  constructor(source: ContentSource) {
    this.detector = getCaptionDetector(source);
  }

  async init() {
    if (this.isActive) return;
    
    const captionElement = await this.detector.detect();
    if (!captionElement) {
      console.log('No captions found');
      return;
    }

    this.detector.processCaption(captionElement);
    this.isActive = true;
  }

  cleanup() {
    if (!this.isActive) return;
    
    this.detector.cleanup();
    this.isActive = false;
  }
} 