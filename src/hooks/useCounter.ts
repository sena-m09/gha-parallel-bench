import { useCallback, useState } from "react";

export interface UseCounterOptions {
  min?: number;
  max?: number;
  step?: number;
}

export function useCounter(initial = 0, options: UseCounterOptions = {}) {
  const { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY, step = 1 } = options;
  const [count, setCount] = useState(initial);
  const inc = useCallback(() => setCount((c) => Math.min(max, c + step)), [max, step]);
  const dec = useCallback(() => setCount((c) => Math.max(min, c - step)), [min, step]);
  const reset = useCallback(() => setCount(initial), [initial]);
  return { count, inc, dec, reset, setCount };
}
