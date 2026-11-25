# Heures supplémentaires

A small installable web app (PWA) for logging overtime and sending a monthly report to an employer by WhatsApp or copy-paste. No server and no account: everything is stored on the device.

Live: https://bluekeyapp.github.io/heur-sup-app/

## Features

- Log overtime in three steps: date, hours (up to 24h, in 15-minute steps), optional note. A 0h entry needs a note.
- Monthly totals with a month filter; edit or delete entries (delete can be undone).
- Report in French for the employer, copied or sent through WhatsApp.
- Interface in French (default), English and Portuguese.
- Backup export/import as a JSON file, from the name screen ("Vos données").
- Works offline once opened; installable on iPhone and Android.

## Structure

| Path | Contents |
|---|---|
| `index.html` | App shell and markup |
| `styles/app.css` | All styles |
| `src/app.js` | Screens, rendering and interactions |
| `src/storage.js` | `localStorage` access, entry validation, backup format |
| `src/utils.js` | Formatting, the French report, dates, clipboard, service worker registration |
| `src/translations.js` | UI text in EN / FR / PT |
| `sw.js` | Offline cache (serves the cached copy first, refreshes in the background) |
| `manifest.webmanifest` | Install metadata and icons |
| `assets/` | Icons (SVG sources and PNGs, including `icon-1024.png` for app stores) and the self-hosted Inter font |
| `scripts/` | `bump-version.mjs` (see below) |
| `tests/` | Unit tests and screen tests (`screens.test.js`), run with Node's built-in test runner |
| `eslint.config.js` | Lint rules |

## Run locally

The app uses ES modules and a service worker, so it must be served over HTTP rather than opened as a file:

```powershell
python -m http.server 8080
```

Then open http://localhost:8080.

## Tests and lint

Requires Node 22.8 or later (for `--test-isolation`). The app itself has no dependencies; ESLint and jsdom are dev-only and are never published. Install them once:

```powershell
npm install
```

Then:

```powershell
npm test
```

```powershell
npm run lint
```

- **Unit tests** cover storage, the backup format, formatting, the French report and versioning.
- **Screen tests** (`tests/screens.test.js`) load the real `index.html` and `src/app.js` into jsdom and click through the app: first launch, adding, editing and deleting entries, undo, the 24h limit, future dates, the month filter, the report sheet, language switching and backup import. The loader in `tests/helpers/load-app.js` gives each test a fresh page, fresh storage and a fixed date (24 Nov 2026).
- jsdom does not lay out or animate the page, so these tests do not catch visual problems.

CI runs `npm ci`, `npm run lint` and `npm test` on every pull request (`.github/workflows/test.yml`).

## Releasing a change

Files are loaded with a `?v=` version so installed copies pick up updates. After changing any app file, bump it everywhere in one go:

```powershell
npm run version:bump
```

This updates the `?v=` value in `index.html`, `src/app.js`, `src/storage.js` and `sw.js`, and increments the service worker cache name. A test fails if the versions ever get out of step.

Because the service worker serves the cached copy first, users see a new version on their second launch after it is published.

## Data

- Entries are stored in `localStorage` under the keys `ot` (entries), `ot_first` / `ot_last` (name) and `ot_lang` (language). Keep these keys when changing the code, or existing users lose their data.
- Data stays on one device. The backup file (`heures-sup-YYYY-MM-DD.json`) is the only way to move it to another phone; importing merges entries by id, so importing the same file twice is harmless.

## Deployment

Pushing to `main` deploys to GitHub Pages through `.github/workflows/pages.yml`. Only the files the app needs are published (`index.html`, `manifest.webmanifest`, `sw.js`, `.nojekyll`, `assets/`, `src/`, `styles/`); tests, scripts and this README are not. If you add a new top-level file the app loads, add it to the "Collect site files" step.
