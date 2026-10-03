# Prelegal frontend

Next.js app for creating a Mutual Non-Disclosure Agreement: fill in a form, see the Common Paper
Mutual NDA (cover page + standard terms) update live, then download it (`.md`) or print / save as PDF.

```bash
npm install
npm run dev          # http://localhost:3000
```

The standard terms are read from `../templates/Mutual-NDA.md` on the server. If `frontend/` is deployed
without the repo root, set `TEMPLATES_DIR` to the folder containing the templates.

## Tests

```bash
npm run typecheck
npm run lint
npm test             # Vitest unit + component tests
npx playwright install chromium   # first time only
npm run test:e2e     # Playwright (builds and serves the app on :3100)
```

See [MANUAL_TESTS.md](MANUAL_TESTS.md) for the manual test plan.

## Licence

Agreement text © Common Paper, used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
