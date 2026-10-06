# Recommendation popup copy

**Status:** Approved in chat  
**Date:** 2026-10-06

## Summary

The model picker stays a VS Code QuickPick. Each of the top three rows shows the model name, then context, thinking effort, and price, then one sentence. Scores, the jargon rationale, the cost tier, and the `matched` / `enterprise` badges leave the popup.

Runtime copy lives in one file per language, English and French. The extension setting `taskModelAdvisor.language` selects it. The default is English. Ranking, matching, and apply behavior stay the same.

## Language

`package.json` gains:

```json
"taskModelAdvisor.language": {
  "type": "string",
  "enum": ["en", "fr"],
  "default": "en",
  "description": "Language for Task Model Advisor prompts, recommendations, and notifications."
}
```

`SETTING_KEYS` includes `language`, so the existing seeder writes `en` on first launch when the key is unset. A value other than `fr` resolves to `en`. The command reads the setting each time it runs.

Catalogs:

- `src/i18n/en.ts`
- `src/i18n/fr.ts`

Both export the same `Messages` type. Fixed strings are properties. Messages that include a name, price, or error are functions, so each language owns its word order. No i18n library.

`messagesFor(language)` returns the catalog. Formatters and QuickPicks take a `Messages` value. They do not call `vscode` to translate.

The command title and the setting descriptions in `package.json` stay English. They do not follow `taskModelAdvisor.language`.

Price amounts use `$X.XX/1M` in both languages. Toasts keep the existing `~$X.XX/1M` form.

## Model QuickPick

`showRecommendations` receives the task label from the active catalog and sets it as the QuickPick `title`. The filter placeholder comes from the catalog (`Choose a recommendation` / `Choisissez une recommandation`).

The title is the preset the user selected. After **Other**, the title is the catalog word for Other (`Other` / `Autre`), not the classified profile and not the free text.

Each row:

| Field       | Content                                  |
| ----------- | ---------------------------------------- |
| Label       | `$(sparkle)` plus the session model name |
| Description | `{context} · {thinking} · {price}`       |
| Detail      | The sentence below                       |

English context words: `standard context`, `medium context`, `high context`.

English thinking words: `thinking off`, `low thinking`, `medium thinking`, `high thinking`.

French context words: `contexte standard`, `contexte moyen`, `contexte élevé`.

French thinking words: `réflexion désactivée`, `réflexion faible`, `réflexion moyenne`, `réflexion élevée`.

An unknown price is `unknown price` / `prix inconnu`. The cost tier is not shown.

English example, Python-script ranking in the eval catalog:

```
Composer 2.5          standard context · medium thinking · $1.50/1M
Best fit for this task, at a reasonable price.

GPT-5.6 Sol Medium    standard context · medium thinking · $6.50/1M
Strong fit, and well ranked in comparisons. Pricier.

GLM 5.3 Flash         standard context · medium thinking · $0.24/1M
The cheapest. Weaker fit for this task.
```

French for the same three rows:

```
Composer 2.5          contexte standard · réflexion moyenne · $1.50/1M
Le plus adapté à cette tâche, à un prix raisonnable.

GPT-5.6 Sol Medium    contexte standard · réflexion moyenne · $6.50/1M
Très adapté, et bien classé dans les comparatifs. Plus cher.

GLM 5.3 Flash         contexte standard · réflexion moyenne · $0.24/1M
Le moins cher. Moins adapté à cette tâche.
```

`matchOnDescription` and `matchOnDetail` stay enabled. An empty recommendation list still closes the flow without a QuickPick.

## Sentence

The sentence is computed when the visible rows are formatted. It is not stored on `Recommendation.rationale`. The ranker rationale and `formatScoreBreakdown` stay in the eval report.

A row whose badges include `weak` uses the catalog string `No reliable benchmark.` / `Sans benchmark fiable.` The `enterprise` badge is not rendered.

For every other row, take the two largest contributions among `taskFit * weight`, `arena * weight`, and `cost * weight`, using the ranking weights. Contributions of zero or less are dropped. A tie breaks toward task fit, then arena, then cost.

Which clauses appear is language-independent. The words come from the catalog.

- **Fit**, only when task fit is in that pair. Best-fit wording when this row's task fit is strictly greater than every other non-weak row. Otherwise the strong wording when task fit is at least 0.5, or the weaker wording below that. A tie for the highest fit uses the 0.5 threshold, not the best-fit wording.
- **Comparisons**, only when arena is in that pair.
- **Price.** Compare finite prices on the visible rows. A row is the cheapest when its price is strictly lower than every other known price, and the priciest when strictly higher. A single known price is neither. The cheapest wording leads the sentence. The pricier wording is its own final sentence when the row is the priciest. Otherwise, when cost is in the top pair, append the reasonable-price wording.

English fragments: `Best fit for this task`, `Strong fit`, `Weaker fit for this task`, `well ranked in comparisons`, `The cheapest`, `Pricier`, `at a reasonable price`, `Limited benchmark data.`

French fragments: `Le plus adapté à cette tâche`, `Très adapté`, `Moins adapté à cette tâche`, `bien classé dans les comparatifs`, `Le moins cher`, `Plus cher`, `à un prix raisonnable`, `Données de benchmark insuffisantes.`

Join fit and comparisons with the catalog joiner (`, and ` / `, et `) when both are present. Append the reasonable-price fragment with a comma. The cheapest wording is its own sentence, then the remaining sentence. The pricier wording is its own final sentence. A clause that opens the detail, or that follows the cheapest sentence, starts with a capital letter. If no clause remains, the detail is the limited-data string.

## Rest of the UI

Both catalogs include these strings.

| Key                | English                                  | French                                              |
| ------------------ | ---------------------------------------- | --------------------------------------------------- |
| Task placeholder   | What kind of task?                       | Quel type de tâche ?                                |
| `spec`             | Write a spec                             | Écrire une spec                                     |
| `userStory`        | Write a user story                       | Écrire une user story                               |
| `testScenario`     | Write a test scenario                    | Écrire un scénario de test                          |
| `pythonScript`     | Write a Python script to automate a task | Écrire un script Python pour automatiser une action |
| `other`            | Other                                    | Autre                                               |
| Other prompt       | Describe the task                        | Décrivez la tâche                                   |
| Other example      | e.g. refactor the auth module            | Ex. refactorer le module auth                       |
| Apply              | Apply (copy config)                      | Valider (copier la config)                          |
| Copy               | Copy only                                | Copier seulement                                    |
| Refresh            | Refresh benchmarks                       | Actualiser les benchmarks                           |
| Action placeholder | Action                                   | Action                                              |

Notifications, English:

- Copy success: `Task Model Advisor: config copied for "{name}" ({price}).`
- Copy failure: `Task Model Advisor: could not copy ({message}).`
- Validation failure, in both the recommend command and the apply adapter: `Task Model Advisor: validation failed ({message}).`
- Manual apply: `Task Model Advisor: model "{name}" ({price}), context "{context}", thinking "{effort}". Config copied — set these manually in the Agent picker.`
- Cursor success: `Task Model Advisor: {new Agent | current composer model} → model "{name}" ({price}) · thinking "{effort}" or thinking "{effort}" (effort) · Max Mode ON|OFF (context {context}) or context "{context}" must be set manually (Max Mode) via {commandId}. Config copied too.`
- Failed probes: `probes failed ({errors})` and `no runnable probe`.

Notifications, French:

- Copy success: `Task Model Advisor: config copiée pour "{name}" ({price}).`
- Copy failure: `Task Model Advisor: impossible de copier ({message}).`
- Validation failure: `Task Model Advisor: la validation a échoué ({message}).`
- Manual apply: `Task Model Advisor: modèle "{name}" ({price}), contexte "{context}", thinking "{effort}". Config copiée — applique-les manuellement dans le sélecteur Agent.`
- Cursor success: `Task Model Advisor: {nouvel Agent | modèle du composer courant} → modèle "{name}" ({price}) · thinking "{effort}" (effort) ou thinking "{effort}" · Max Mode ON|OFF (contexte {context}) ou contexte "{context}" à régler manuellement (Max Mode) via {commandId}. Config aussi copiée.`
- Failed probes: `probes échouées ({errors})` and `aucune sonde exécutable`.

Context and thinking inside notifications stay the raw values (`standard`, `medium`, `high`, `off`, `low`). The display phrases are only on the recommendation row.

Network errors, the progress title `Task Model Advisor`, and the command title in `package.json` stay English in both languages.

`classify-other` keeps its French and English keyword patterns.

## Docs and gif

README:

- Remove “The interface labels are currently in French.”
- Name the default actions Apply, Copy only, and Refresh benchmarks, and state that French is `taskModelAdvisor.language` = `fr`.
- Replace the “weak badge” note with the sentence shown for a model that has no reliable benchmark.

CONTRIBUTING: the macOS Cursor manual-test row expects the new row (context, thinking, price, sentence), not badges and the old rationale. Mention `src/i18n/en.ts`, `src/i18n/fr.ts`, and the language setting.

The demo gif is the mock-up in `docs/images/demo/demo.html`, rebuilt with `bash docs/images/demo/build-gif.sh`. Update that mock to the English catalog, which is the default:

- Task list: Write a spec, Write a user story, Write a test scenario, Write a Python script to automate a task, Other.
- Recommendation placeholder: `Choose a recommendation`.
- The three spec-task models stay Claude Opus 5.5 Medium, Claude Opus 5 High, and Grok 4.6 Medium. Descriptions are `high context · medium thinking · $8.00/1M` for both Opus rows and `high context · medium thinking · $2.20/1M` for Grok.
- Details, from the sentence rule on the eval-catalog spec ranking: `Best fit for this task, and well ranked in comparisons.` / `Strong fit, and well ranked in comparisons.` / `The cheapest. Weaker fit for this task, and well ranked in comparisons.`
- Actions: Apply (copy config), Copy only, Refresh benchmarks.

`docs/images/README.md` keeps the rebuild command. It does not ask for a screen recording.

## Shape

- `formatRecommendationDescription` and `formatRecommendationDetail` live in `src/ui/format-recommendation.ts`. Both are pure. They take a `Messages` catalog. The detail function also takes the row and the visible rows.
- `showRecommendations(recs, warnings, taskLabel, messages)` uses those functions.
- `resolveConfig` sets `language` to `fr` only when the setting is `fr`, otherwise `en`.
- `recommend` loads `messagesFor(config.language)`. It passes the catalog’s Other label when `customText` is set, otherwise the catalog preset for `profileId`.
- Task picker, actions, and apply toasts read the same catalog.

## Tests

- English and French catalogs expose the same keys.
- Formatter tests use the Python-script top three numbers and expect both the English and French details in this spec. They also cover a `weak` row, an unknown price, a fit tie, and a single known price.
- `resolveConfig` maps a missing or unknown language to `en`, and `fr` to `fr`.
- The existing `SETTING_KEYS` test still matches `package.json`, including `language`.
- Ranker tests stay as they are.

## Out of scope

- A webview or a third QuickPick line.
- Changing scores, weights, diversification, or clipboard JSON.
- Removing `rationale`, `costTier`, or badges from the `Recommendation` type.
- A real screen recording of the gif.
- VS Code `package.nls` or following the editor display language.
- A third language.
