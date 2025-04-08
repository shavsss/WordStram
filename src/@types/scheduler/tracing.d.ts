declare module 'scheduler/tracing' {
  export interface Interaction {
    id: number;
    name: string;
    timestamp: number;
  }

  export const __interactionsRef: { current: Set<Interaction> };
  export const __subscriberRef: { current: null | ((...args: any[]) => any) };
  
  export function unstable_clear(callback: (...args: any[]) => any): any;
  export function unstable_getCurrent(): Set<Interaction>;
  export function unstable_getThreadID(): number;
  export function unstable_trace(name: string, timestamp: number, callback: (...args: any[]) => any, ...rest: any[]): any;
  export function unstable_wrap(callback: (...args: any[]) => any, ...rest: any[]): (...args: any[]) => any;
  export function unstable_subscribe(subscriber: (...args: any[]) => any): () => void;
  export function unstable_unsubscribe(subscriber: (...args: any[]) => any): void;
} 