export type ClassValue = string | number | boolean | null | undefined | ClassValue[] | Record<string, boolean>;

export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    if (typeof v === "string" || typeof v === "number") {
      out.push(String(v));
    } else if (Array.isArray(v)) {
      const sub = cn(...v);
      if (sub) out.push(sub);
    } else if (typeof v === "object") {
      for (const [k, b] of Object.entries(v)) if (b) out.push(k);
    }
  }
  return out.join(" ");
}
