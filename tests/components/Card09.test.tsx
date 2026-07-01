import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Card09 } from "../../src/components/Card09";

describe("Card09", () => {
  it("renders title", () => {
    render(<Card09 title="hello" />);
    expect(screen.getByRole("heading", { name: "hello" })).toBeInTheDocument();
  });

  it("renders truncated description", () => {
    const long = "x".repeat(200);
    render(<Card09 title="t" description={long} truncateAt={10} />);
    expect(screen.getByText(/x{9}…/)).toBeInTheDocument();
  });

  it("renders badge when given", () => {
    render(<Card09 title="t" badge={7} />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("toggles expand on click", () => {
    render(<Card09 title="t" />);
    const btn = screen.getByRole("button", { name: "Expand" });
    fireEvent.click(btn);
    expect(screen.getByRole("button", { name: "Collapse" })).toBeInTheDocument();
  });

  it("calls onActivate with id", () => {
    const spy = vi.fn();
    render(<Card09 title="t" onActivate={spy} />);
    fireEvent.click(screen.getByRole("button"));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toMatch(/.+/);
  });

  it("respects disabled", () => {
    const spy = vi.fn();
    render(<Card09 title="t" disabled onActivate={spy} />);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
  });

  it("applies variant and size data attribute", () => {
    const { container } = render(<Card09 title="t" variant="danger" size="lg" />);
    const root = container.querySelector('[data-component="Card09"]');
    expect(root).not.toBeNull();
    expect(root?.className).toMatch(/card-danger/);
    expect(root?.className).toMatch(/card-lg/);
  });

  it("does not render description when missing", () => {
    const { container } = render(<Card09 title="t" />);
    expect(container.querySelector("p")).toBeNull();
  });
});
