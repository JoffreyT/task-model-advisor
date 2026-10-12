# Images

- **Source mock:** [`demo/demo.html`](demo/demo.html) — category + complexity labels from `src/i18n/en.ts`, recommendation rows aligned with `format-recommendation.ts`.
- **Rebuild both GIFs (one command):**

  ```bash
  bash docs/images/demo/build-gif.sh
  ```

  Writes the **same file** to:

  | Path                                     | Used for                                           |
  | ---------------------------------------- | -------------------------------------------------- |
  | [`docs/images/demo.gif`](demo.gif)       | Repo / CONTRIBUTING / Marketplace asset references |
  | [`media/demo.gif`](../../media/demo.gif) | Root README and `.vsix` packaging                  |

  Do not copy manually; the script keeps them byte-identical. Requires Google Chrome and `ffmpeg` on macOS (`CHROME=…` to override Chrome path).
