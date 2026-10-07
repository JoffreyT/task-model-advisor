# Images

- `demo.gif` — animated walkthrough shown at the top of the [README](../../README.md). It is a **mock-up** rendered from `demo/demo.html` (labels from `src/i18n/en.ts`, row format from `format-recommendation.ts`), not a screen recording.
- Rebuild after UI copy changes: `bash docs/images/demo/build-gif.sh` (macOS, needs Google Chrome and `ffmpeg`).

Marketplace README images are resolved from the repository URL in `package.json`, so `demo.gif` must be pushed to the default branch before publishing.
