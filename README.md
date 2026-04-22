# Heure Sup App

Production-oriented static structure for the overtime tracker prototype.

## Structure

- `index.html`: app shell and semantic markup
- `styles/app.css`: shared visual system and component styling
- `src/app.js`: app bootstrap, UI flow, rendering, and interactions
- `src/storage.js`: localStorage access and data validation
- `src/translations.js`: language content
- `src/utils.js`: formatting, clipboard, sorting, and service worker registration
- `manifest.webmanifest`: install metadata
- `sw.js`: offline cache for the app shell
- `assets/`: icons for browser tabs and install prompts

## Run locally

Because this app uses ES modules and a service worker, serve it through a local web server instead of opening the file directly.

Examples:

```powershell
cd C:\Users\duzan\Documents\Codex\2026-04-21-files-mentioned-by-the-user-heur\heur-sup-app
```

If you have Python installed:

```powershell
python -m http.server 8080
```

Then open:

`http://localhost:8080`

## Production notes

- The app is still front-end only, so data lives in `localStorage`.
- Existing prototype data is preserved because the same storage keys are reused.
- The service worker caches the app shell for faster reloads and basic offline support.
- The current report flow is text-first; a server-backed version could later add user accounts, payroll periods, PDF export, or supervisor delivery workflows.

## GitHub Pages

This app is ready to publish as a static GitHub Pages site.

- Put the contents of this folder at the root of a GitHub repository.
- Keep the `.nojekyll` file so GitHub Pages serves the static files directly.
- In the repository settings, open `Pages`.
- Under `Build and deployment`, choose `Deploy from a branch`.
- Select the `main` branch and the `/ (root)` folder.

For a project site, the final URL will look like:

`https://<owner>.github.io/<repository-name>/`

## Good next steps

- Add automated tests for storage parsing, report formatting, and screen flow.
- Add linting and formatting so the codebase stays clean as it grows.
- Introduce a lightweight build step if you want minification, cache busting, and environment-based config.
- Replace `localStorage` with a backend if you need sync, backups, or multi-device support.
