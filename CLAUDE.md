# uapplypal

Node.js (Express 5) web app hosted on Hosting Ukraine (Business hosting, Node.js behind their proxy).

- `app.js`: Express app (routes, static files from `public/`). `server.js`: listens on `HOST`/`PORT`.
- Tests: `npm test` (Node's built-in test runner, files in `test/`).
- Deploy: `.github/workflows/deploy.yml`. Pushes to `main` run tests, then rsync over SSH to the hosting
  and run `npm ci --omit=dev`. See `docs/DEPLOY.md`. Don't commit secrets or `.env`.
- Keep the app working when started with `node server.js` from the site root. The hosting runs it that way.
