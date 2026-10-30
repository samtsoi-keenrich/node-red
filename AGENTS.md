# Base44 sandbox notes

## Running the app here

```bash
docker compose -f docker-compose.base44.yml up -d --build
docker compose -f docker-compose.base44.yml logs -f node-red
```

- One service, `node-red`, built from `node:22` and run **from the cloned source** at `/workspace`
  (no app image). Node.js must be >= 22.9 (`engines` in `package.json`).
- Startup installs dependencies with `npm ci` from the root lockfile into the `node_modules`
  named volume, then runs the repo's own dev command `node scripts/dev --userDir /data`.
  `scripts/dev.js` builds the editor client (`packages/node_modules/@node-red/editor-client/public`,
  gitignored) and runs the runtime under nodemon, rebuilding the editor on source changes and
  restarting Node-RED on backend JS changes.
- Node-RED's user directory is the `node-red-data` volume at `/data`: `settings.js` is copied from
  the packaged default on first start and `flows.json` / credentials live there, so they survive
  container recreation.
- The editor is served on the admin root `/` (not `/red`), on port 3000 via `PORT`.

## Visual theme

The editor uses a custom theme in `theme/`:

- `theme/base44-theme.css` — overrides the editor's `--red-ui-*` custom properties and restyles the
  chrome (masthead, tabs, palette, sidebar panels, dialogs, forms). Accent `#fcba03` is used for
  branding, icons, highlights and the Deploy button only; surfaces stay neutral.
- `theme/base44-mark.svg` — the amber masthead mark.
- The palette is a list (colour tile, bold label, chevron), not coloured pills. Node-RED keeps
  each node's colour as an inline `background-color` on the palette row and its core icons are
  white SVGs, so the row paints a white gradient over that colour and the icon tile uses
  `background-color: inherit` to pick the colour back up — change both together.

They are wired through the supported `editorTheme` mechanism by the `-D` defines in
`docker-compose.base44.yml` (`editorTheme.page.css`, `editorTheme.header.image`). The CSS is served
statically from `/theme/css/base44-theme.css`, so editing the file only needs a browser reload.
The styling is presentation-only: no Node-RED behaviour, flow data or API is touched.

## Gotchas

- No database, queue or external service is required; the app boots with no secrets.
- The editor client must be built before it can be served; a bare `npm start` on a fresh clone
  returns `index.html` but the UI does not load. `scripts/dev` handles this.
- The Node-RED editor is desktop-oriented and does not reflow at phone widths (the workspace keeps
  its wider minimum width). That is upstream behaviour, not a sandbox issue.

## Verifying

- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` should return `200`.
- `curl -s http://localhost:3000/flows` returns the deployed flow JSON array.
- In the preview, the editor shows the palette (~40 nodes), a "Flow 1" tab and a Deploy button, with
  no "Lost connection" notification (that notification appears when the `/comms` WebSocket fails).
- Tests (inside the container): `docker compose -f docker-compose.base44.yml exec -T node-red npm run mocha:core`
