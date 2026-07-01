#!/usr/bin/env tsx
/**
 * results.csv を読み、4 workflow の wall-clock / billable を比較して REPORT.md を書く。
 */

import { readFile, writeFile } from "node:fs/promises";
import { argv } from "node:process";

type WorkflowLabel = "sequential" | "parallel" | "matrix" | "multi-job";
const ORDER: WorkflowLabel[] = ["sequential", "parallel", "matrix", "multi-job"];

interface StepTiming {
  name: string;
  startedAt: string;
  completedAt: string;
  durationSec: number;
}
interface JobTiming {
  name: string;
  startedAt: string;
  completedAt: string;
  durationSec: number;
  steps: StepTiming[];
}
interface Row {
  timestamp: string;
  workflow: WorkflowLabel;
  runId: string;
  wallClockSec: number;
  billableMin: number;
  jobs: JobTiming[];
}

function parseCsv(text: string): Row[] {
  const lines = text.split("\n").filter((l) => l.length > 0);
  const header = lines.shift();
  if (!header) return [];
  const rows: Row[] = [];
  for (const line of lines) {
    const cells = splitCsv(line);
    if (cells.length < 6) continue;
    rows.push({
      timestamp: cells[0],
      workflow: cells[1] as WorkflowLabel,
      runId: cells[2],
      wallClockSec: Number(cells[3]),
      billableMin: Number(cells[4]),
      jobs: JSON.parse(cells[5]) as JobTiming[],
    });
  }
  return rows;
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQ = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQ = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

interface Stats {
  n: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  stddev: number;
}

function stats(xs: number[]): Stats {
  const sorted = [...xs].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return { n: 0, min: 0, max: 0, mean: 0, median: 0, p95: 0, stddev: 0 };
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  return {
    n,
    min: sorted[0],
    max: sorted[n - 1],
    mean,
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    stddev: Math.sqrt(variance),
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function fmt(n: number): string {
  return n.toFixed(2);
}

function stepMedians(rows: Row[]): Array<{ name: string; medianSec: number }> {
  const byStep = new Map<string, number[]>();
  for (const r of rows) {
    for (const j of r.jobs) {
      for (const s of j.steps) {
        const key = `${j.name} / ${s.name}`;
        if (!byStep.has(key)) byStep.set(key, []);
        byStep.get(key)!.push(s.durationSec);
      }
    }
  }
  return [...byStep.entries()]
    .map(([name, xs]) => ({ name, medianSec: percentile([...xs].sort((a, b) => a - b), 0.5) }))
    .sort((a, b) => b.medianSec - a.medianSec);
}

async function main() {
  const csvPath = argv[2] ?? "results.csv";
  const reportPath = argv[3] ?? "REPORT.md";
  const text = await readFile(csvPath, "utf8");
  const rows = parseCsv(text);

  const buckets: Record<WorkflowLabel, Row[]> = {
    sequential: [],
    parallel: [],
    matrix: [],
    "multi-job": [],
  };
  for (const r of rows) if (r.workflow in buckets) buckets[r.workflow].push(r);

  const wallStats: Record<WorkflowLabel, Stats> = {} as Record<WorkflowLabel, Stats>;
  const billStats: Record<WorkflowLabel, Stats> = {} as Record<WorkflowLabel, Stats>;
  for (const label of ORDER) {
    wallStats[label] = stats(buckets[label].map((r) => r.wallClockSec));
    billStats[label] = stats(buckets[label].map((r) => r.billableMin));
  }

  const baseMedianWall = wallStats.sequential.median || 1;
  const baseMedianBill = billStats.sequential.median || 1;

  const md: string[] = [];
  md.push("# Bench report");
  md.push("");
  md.push(
    `samples per workflow: ${ORDER.map((l) => `${l}=${wallStats[l].n}`).join(", ")}`,
  );
  md.push("");

  md.push("## Wall-clock (seconds)");
  md.push("");
  md.push("| workflow | n | min | median | mean | p95 | max | stddev | vs sequential |");
  md.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const label of ORDER) {
    const s = wallStats[label];
    const delta = ((s.median / baseMedianWall - 1) * 100).toFixed(1);
    md.push(
      `| ${label} | ${s.n} | ${fmt(s.min)} | ${fmt(s.median)} | ${fmt(s.mean)} | ${fmt(s.p95)} | ${fmt(s.max)} | ${fmt(s.stddev)} | ${delta}% |`,
    );
  }
  md.push("");

  md.push("## Billable minutes (sum over jobs, ceil per job)");
  md.push("");
  md.push("| workflow | n | min | median | mean | p95 | max | stddev | vs sequential |");
  md.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const label of ORDER) {
    const s = billStats[label];
    const delta = ((s.median / baseMedianBill - 1) * 100).toFixed(1);
    md.push(
      `| ${label} | ${s.n} | ${fmt(s.min)} | ${fmt(s.median)} | ${fmt(s.mean)} | ${fmt(s.p95)} | ${fmt(s.max)} | ${fmt(s.stddev)} | ${delta}% |`,
    );
  }
  md.push("");

  md.push("## Step medians (per workflow)");
  md.push("");
  for (const label of ORDER) {
    md.push(`### ${label}`);
    md.push("");
    md.push("| step | median (s) |");
    md.push("|---|---:|");
    for (const s of stepMedians(buckets[label])) md.push(`| ${s.name} | ${fmt(s.medianSec)} |`);
    md.push("");
  }

  await writeFile(reportPath, md.join("\n") + "\n");
  console.log(`wrote ${reportPath}`);
  for (const label of ORDER) {
    console.log(
      `${label.padEnd(12)} wall median=${fmt(wallStats[label].median)}s  billable median=${fmt(billStats[label].median)}min`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
