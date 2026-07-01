import { describe, expect, it } from "vitest";
import { formatNumber, slugify, truncate } from "../../src/utils/format";

describe("format utils", () => {
  it("truncates long strings", () => {
    expect(truncate("hello world", 5)).toBe("hell…");
  });

  it("does not truncate short strings", () => {
    expect(truncate("hi", 5)).toBe("hi");
  });

  it("slugifies", () => {
    expect(slugify("Hello, World! 123")).toBe("hello-world-123");
  });

  it("formats numbers", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
});
