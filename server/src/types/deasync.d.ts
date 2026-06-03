declare module 'deasync' {
  export function loopWhile(test: () => boolean): void;
  export function sleep(ms: number): void;
  export function runLoopOnce(): void;
}
