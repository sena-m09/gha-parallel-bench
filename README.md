# GitHub Actions parallel steps ベンチ

2026/6/25 に追加された `parallel:` / `background` / `wait` / `wait-all` / `cancel`
のうち、`parallel:` を使った「独立タスクのファンアウト」が wall-clock を
どれだけ縮めるかを統計的に計測する検証用リポジトリ。

## 構成

- `src/`: React 19 + TypeScript の小さなコンポーネントライブラリ
  - `components/Card01..Card40.tsx`: lint/typecheck/build に時間を稼ぐためのダミー
  - `hooks/`, `utils/`: 一緒にビルド・テストされる補助モジュール
- `tests/`: vitest テスト (jsdom + @testing-library/react)
- `.github/workflows/`:
  - `sequential.yml`: 1 job・4 タスク直列
  - `parallel.yml`: 1 job・4 タスクを `- parallel:` ブロックで並列
  - `matrix.yml`: 1 job 定義 × `strategy.matrix` で 4 job (それぞれ別 runner)
  - `multi-job.yml`: 独立 4 job (それぞれ別 runner)
  - 4 本は **依存セットアップまで完全一致**、違いは並列化のやり方だけ
- `scripts/benchmark.ts`: gh CLI で 4 種を交互に N 回ずつ起動して `results.csv` に追記
- `scripts/analyze.ts`: `results.csv` を集計して `REPORT.md` を書き出す

**wall-clock と billable minutes 両方を記録する**。前者は run 中の全 job にわたって
`max(completedAt) - min(startedAt)` で計算し、後者は job ごとに `ceil(duration/60)` を
足したもの (GitHub の課金ポリシーに合わせている)。matrix / multi-job は wall-clock
は縮む可能性がある一方 billable は増えるはずで、そのトレードオフを見るのが
このベンチの主目的。

## セットアップ

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

初回 `pnpm install` で `pnpm-lock.yaml` が生成される。CI は
`--frozen-lockfile` なので lockfile を必ずコミットすること。

## GitHub 側の準備

1. このディレクトリを GitHub リポジトリにして push
2. Actions タブで `bench-sequential` / `bench-parallel` / `bench-matrix` /
   `bench-multi-job` の 4 本を `workflow_dispatch` で 1 回ずつグリーンに通ることを確認
3. `parallel:` 側、ステップ間の競合がないか (`dist/`, `coverage/`, lockfile への
   書き込みなど) を必ず目視確認

## ベンチ実行

```sh
# gh CLI で認証済みであること
gh auth status

# 20 サンプル × 4 workflow = 計 80 run。交互起動・1 run ごとに CSV へ追記。
pnpm bench -- --n 20 --branch main
```

matrix / multi-job は 4 個ずつ runner を消費するので、フリー枠でやるなら N を
少なめ (10 程度) から始めることを推奨。

`results.csv` は append モードなので、途中で止まっても次回は
そこから続行できる (重複を避けたければ手動で間引く)。

## 集計

```sh
pnpm analyze
# -> REPORT.md にテーブル + クリティカルパスを書き出し
```

## 所要時間の調整

各タスクの目安は 20〜40 秒。最初の手動実行で短すぎたら以下を増やす:

- **test が短い** → `Card*.test.tsx` のテスト数を増やす、or
  Card 数を増やす (テストは Card 数に比例)
- **build が短い** → `Card*.tsx` のサイズ・数を増やす。tsup は
  `src/components/*.tsx` を全部エントリにしているので、数で線形に伸びる
- **typecheck が短い** → 同上、Card 数を増やす
- **lint が短い** → 同上

Card 数を変えるには `src/components/Card??.tsx` を増減し、`src/index.ts` の
barrel export を合わせて更新する (`scripts/` に generator を置くまではしない)。

## 計測上の注意

- runner プールの混雑差を均すため `benchmark.ts` は必ず交互に dispatch する
- billable time API (`/actions/runs/{id}/timing`) は分単位丸めのため使わず、
  `gh run view --json jobs` の `startedAt` / `completedAt` (秒精度) を使う
- `actions/cache` は使わないでキャッシュヒット差を排除している

## 参考

- [Changelog: Actions steps can now be run in parallel](https://github.blog/changelog/2026-06-25-actions-steps-can-now-be-run-in-parallel/)
- [Workflow syntax (parallel)](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstepsparallel)
