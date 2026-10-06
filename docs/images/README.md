# Images

- `demo.gif` — animated walkthrough shown at the top of the [README](../../README.md). It is a **mock-up** rendered from `demo/demo.html` (labels and row format copied from the extension UI), not a screen recording.
- Rebuild it after changing the mock-up or the UI labels: `bash docs/images/demo/build-gif.sh` (macOS, needs Google Chrome and `ffmpeg`).
- Replace it with a real screen recording (ideally ≤ 1 MB, ~960 px wide) once the extension is published.

Marketplace README images are resolved from the repository URL in `package.json`, so `demo.gif` must be pushed to the default branch before publishing.
