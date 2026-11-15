# World Travel Planner

An offline-first web app (PWA) for travel research and trip planning.

- **Places** on a map, by country → region → city, with search in English, Chinese or pinyin (tone marks optional).
- **Place cards** with facts, source text, your own note and a status (want to go / visited / skip).
- **Trips**: days with ordered stops, day notes, distances; a trip map with each day in its own colour; a printable day-by-day summary with local-script names.
- **Dashboard**: trips, counts, shortlist, countries.
- **Offline**: the app installs to the home screen and works with no connection. Add an offline map as a `.pmtiles` file in Settings.

## Your data stays private

This repository holds **only the app code**. No places, notes or book text are stored here or on any server.
Data is imported on each device from a private file (Settings → Import data file) and kept in the browser's IndexedDB.
Use Settings → Export backup to save your trips and notes.

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
```

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.
