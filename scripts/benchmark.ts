#!/usr/bin/env tsx
/**
 * 4 種類の workflow を交互に N 回ずつ起動し、
 * wall-clock と billable minutes を results.csv に逐次追記する。
 *
 *   sequential : 4 タスクを直列
 *   parallel   : 4 タスクを 1 job 内で `parallel:` ブロック
 *   matrix     : 1 job 定義 × strategy.matrix で 4 job
 *   multi-job  : 4 個の独立 job
 *
 * 使い方: pnpm bench -- --n 20 --branch main
 */

import { spawn } from "node:child_process";
import { appendFile, stat, writeFile } from "node:fs/promises";
import { argv, exit } from "node:process";

type WorkflowLabel = "sequential" | "parallel" | "matrix" | "multi-job";

interface Args {
  n: number;
  branch: string;
  csv: string;
  files: Record<WorkflowLabel, string>;
}

const WORKFLOWS: WorkflowLabel[] = ["sequential", "parallel", "matrix", "multi-job"];

function parseArgs(): Args {
  const args = argv.slice(2);
  const get = (k: string, def?: string) => {
    const i = args.indexOf(`--${k}`);
    return i >= 0 ? args[i + 1] : def;
  };
  return {
    n: Number(get("n", "20")),
    branch: get("branch", "main")!,
    csv: get("csv", "results.csv")!,
    files: {
      sequential: get("seq", "sequential.yml")!,
      parallel: get("par", "parallel.yml")!,
      matrix: get("mat", "matrix.yml")!,
      "multi-job": get("multi", "multi-job.yml")!,
    },
  };
}

function run(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    p.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

async function dispatchAndGetRunId(workflow: string, branch: string): Promise<string> {
  const before = await listLatestRunIds(workflow, 5);
  const r = await run("gh", ["workflow", "run", workflow, "--ref", branch]);
  if (r.code !== 0) throw new Error(`gh workflow run failed: ${r.stderr || r.stdout}`);

  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const after = await listLatestRunIds(workflow, 5);
    const fresh = after.find((id) => !before.includes(id));
    if (fresh) return fresh;
  }
  throw new Error(`could not locate new run id for ${workflow}`);
}

async function listLatestRunIds(workflow: string, limit: number): Promise<string[]> {
  const r = await run("gh", [
    "run",
    "list",
    "--workflow",
    workflow,
    "--limit",
    String(limit),
    "--json",
    "databaseId",
  ]);
  if (r.code !== 0) throw new Error(`gh run list failed: ${r.stderr}`);
  const list = JSON.parse(r.stdout) as Array<{ databaseId: number }>;
  return list.map((x) => String(x.databaseId));
}

async function waitForCompletion(runId: string): Promise<void> {
  const r = await run("gh", ["run", "watch", runId, "--exit-status"]);
  if (r.code !== 0) {
    console.warn(`run ${runId} did not finish cleanly: ${r.stderr || r.stdout}`);
  }
}

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

interface RunTiming {
  wallClockSec: number;
  billableMin: number;
  jobs: JobTiming[];
}

async function fetchTiming(runId: string): Promise<RunTiming> {
  const r = await run("gh", ["run", "view", runId, "--json", "jobs"]);
  if (r.code !== 0) throw new Error(`gh run view failed: ${r.stderr}`);
  const data = JSON.parse(r.stdout) as {
    jobs: Array<{
      name: string;
      startedAt: string;
      completedAt: string;
      steps: Array<{ name: string; startedAt: string; completedAt: string }>;
    }>;
  };
  if (data.jobs.length === 0) throw new Error(`no jobs on run ${runId}`);

  const jobs: JobTiming[] = data.jobs.map((j) => {
    const jStart = Date.parse(j.startedAt);
    const jEnd = Date.parse(j.completedAt);
    const steps = j.steps.map((s) => {
      const a = Date.parse(s.startedAt);
      const b = Date.parse(s.completedAt);
      return {
        name: s.name,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        durationSec: (b - a) / 1000,
      };
    });
    return {
      name: j.name,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
      durationSec: (jEnd - jStart) / 1000,
      steps,
    };
  });

  // wall-clock = max(completedAt) - min(startedAt) across all jobs of the run
  const minStart = Math.min(...jobs.map((j) => Date.parse(j.startedAt)));
  const maxEnd = Math.max(...jobs.map((j) => Date.parse(j.completedAt)));
  const wallClockSec = (maxEnd - minStart) / 1000;

  // billable minutes: each job rounded up to the nearest minute (GitHub billing policy)
  const billableMin = jobs.reduce((acc, j) => acc + Math.ceil(j.durationSec / 60), 0);

  return { wallClockSec, billableMin, jobs };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureCsv(path: string): Promise<void> {
  try {
    await stat(path);
  } catch {
    await writeFile(path, "timestamp,workflow,run_id,wall_clock_sec,billable_min,jobs_json\n");
  }
}

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function main() {
  const { n, branch, csv, files } = parseArgs();
  await ensureCsv(csv);

  const plan: Array<{ label: WorkflowLabel; file: string }> = [];
  for (let i = 0; i < n; i++) {
    for (const label of WORKFLOWS) {
      plan.push({ label, file: files[label] });
    }
  }

  console.log(`running ${plan.length} runs (${n} of each × ${WORKFLOWS.length}), branch=${branch}`);
  for (let i = 0; i < plan.length; i++) {
    const { label, file } = plan[i];
    const stamp = new Date().toISOString();
    console.log(`[${i + 1}/${plan.length}] ${label} dispatch ...`);
    try {
      const runId = await dispatchAndGetRunId(file, branch);
      console.log(`  run_id=${runId}, watching ...`);
      await waitForCompletion(runId);
      const t = await fetchTiming(runId);
      const row = [
        stamp,
        label,
        runId,
        t.wallClockSec.toFixed(2),
        String(t.billableMin),
        csvEscape(JSON.stringify(t.jobs)),
      ].join(",");
      await appendFile(csv, row + "\n");
      console.log(`  wall_clock=${t.wallClockSec.toFixed(1)}s, billable=${t.billableMin}min`);
    } catch (e) {
      console.error(`  FAILED: ${(e as Error).message}`);
    }
  }
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  exit(1);
});
