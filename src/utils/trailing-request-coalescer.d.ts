export type TrailingRequestCoalescer = {
  run: (key: string, task: () => Promise<void>) => Promise<void>;
};

export function createTrailingRequestCoalescer(): TrailingRequestCoalescer;
