import { describe, expect, it } from "vitest";
import { cn } from "../../src/utils/classnames";

describe("cn", () => {
  it("joins strings", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("skips falsy", () => {
    expect(cn("a", false, null, undefined, 0, "b")).toBe("a b");
  });

  it("handles objects", () => {
    expect(cn({ a: true, b: false, c: true })).toBe("a c");
  });

  it("handles nested arrays", () => {
    expect(cn(["a", ["b", { c: true }]])).toBe("a b c");
  });
});
