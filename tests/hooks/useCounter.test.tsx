import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCounter } from "../../src/hooks/useCounter";

describe("useCounter", () => {
  it("increments and decrements", () => {
    const { result } = renderHook(() => useCounter(0));
    act(() => result.current.inc());
    expect(result.current.count).toBe(1);
    act(() => result.current.dec());
    expect(result.current.count).toBe(0);
  });

  it("clamps to max", () => {
    const { result } = renderHook(() => useCounter(0, { max: 1 }));
    act(() => result.current.inc());
    act(() => result.current.inc());
    expect(result.current.count).toBe(1);
  });

  it("clamps to min", () => {
    const { result } = renderHook(() => useCounter(0, { min: 0 }));
    act(() => result.current.dec());
    expect(result.current.count).toBe(0);
  });

  it("respects step", () => {
    const { result } = renderHook(() => useCounter(0, { step: 5 }));
    act(() => result.current.inc());
    expect(result.current.count).toBe(5);
  });

  it("resets to initial", () => {
    const { result } = renderHook(() => useCounter(3));
    act(() => result.current.inc());
    act(() => result.current.reset());
    expect(result.current.count).toBe(3);
  });
});
