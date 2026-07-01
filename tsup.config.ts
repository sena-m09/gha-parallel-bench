import { defineConfig } from "tsup";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const componentsDir = "src/components";
const entries = readdirSync(componentsDir)
  .filter((f) => f.endsWith(".tsx"))
  .map((f) => join(componentsDir, f));

export default defineConfig({
  entry: ["src/index.ts", ...entries],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: "es2022",
  outDir: "dist",
});
