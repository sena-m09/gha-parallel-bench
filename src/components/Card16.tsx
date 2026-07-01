import { useId, useMemo, useState, type ReactNode } from "react";
import { cn } from "../utils/classnames";
import { truncate } from "../utils/format";
import { useToggle } from "../hooks/useToggle";

export type Card16Variant = "primary" | "secondary" | "subtle" | "danger";
export type Card16Size = "sm" | "md" | "lg";

export interface Card16Props {
  title: string;
  description?: string;
  variant?: Card16Variant;
  size?: Card16Size;
  badge?: number;
  disabled?: boolean;
  truncateAt?: number;
  onActivate?: (id: string) => void;
  children?: ReactNode;
}

interface InternalState {
  hovered: boolean;
  pressed: boolean;
}

function classFor(variant: Card16Variant, size: Card16Size, state: InternalState): string {
  return cn(
    "card",
    `card-${variant}`,
    `card-${size}`,
    { hovered: state.hovered, pressed: state.pressed },
  );
}

export function Card16({
  title,
  description,
  variant = "primary",
  size = "md",
  badge,
  disabled = false,
  truncateAt = 64,
  onActivate,
  children,
}: Card16Props) {
  const id = useId();
  const [expanded, toggle] = useToggle(false);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const cls = useMemo(
    () => classFor(variant, size, { hovered, pressed }),
    [variant, size, hovered, pressed],
  );

  const visibleDesc = description ? truncate(description, truncateAt) : "";

  return (
    <div
      className={cls}
      id={id}
      data-disabled={disabled}
      data-component="Card16"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      <header>
        <h3>{title}</h3>
        {typeof badge === "number" ? <span className="badge">{badge}</span> : null}
      </header>
      {visibleDesc ? <p>{visibleDesc}</p> : null}
      {children}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          toggle();
          onActivate?.(id);
        }}
      >
        {expanded ? "Collapse" : "Expand"}
      </button>
    </div>
  );
}

export default Card16;
