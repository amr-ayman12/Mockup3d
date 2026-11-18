# Resort sales site

Interactive sales site for the seaside resort (B1–B5). It is built from pre-rendered images with
clickable SVG overlays (no real-time 3D), so it stays light and smooth on phones.

- Stack: Vite + React + TypeScript, React Router, OpenSeadragon (deep zoom), self-hosted Cairo font.
- Levels, each with its own URL:
  - `/` home
  - `/master-plan` aerial with the five buildings
  - `/master-plan/building/B4` the building and its floors
  - `/master-plan/building/B4/floor/1` the 3D floor plan with numbered cameras; `?view=2d` shows the CAD plan
  - `?shot=B4-1_cam01` on any page opens that interior shot
- Arabic (default, RTL) and English, contact sheet (WhatsApp + email), overlay on/off, fullscreen,
  arrow keys / Esc in the shot viewer, bottom sheets on phones.

## Run it

Node.js is installed (portable, no admin) at `C:\Users\tota_\tools\node-v26.13.1-win-x64`.

```bash
export PATH="/c/Users/tota_/tools/node-v26.13.1-win-x64:$PATH"
cd website
npm run dev        # http://localhost:5173
npm run build      # production files in dist/
```

## Change the project details (placeholders)

Edit `src/data/site.json`:

| Field | Now | Replace with |
|---|---|---|
| `name`, `tagline` | placeholder | final project name and line (ar + en) |
| `whatsapp` | empty (button disabled) | number in international format, e.g. `9715xxxxxxxx` |
| `email` | empty (button disabled) | sales email |
| `location` | Al Marjan Island placeholder | real plot label, lat, lng |
| `placeholder` | `true` | `false` once all of the above are real |

## Add or replace images

Sources live outside the site, in `../rander shots/` (3D plans, shots, plan crops, camera plans) and
`../rander/` (the master-plan aerial). After changing any of them:

```bash
npm run images     # WebP sizes for shots, deep-zoom tiles for plans and the aerial, src/data/media.json
node scripts/check-markers.mjs   # draws all cameras on the 3D plans -> ../rander shots/_checks/markers-on-3d.jpg
```

- A new interior shot: add it to `../rander shots/shots.json` (camera `fx`, `fy` on the plan crop,
  `heading`, `fov`), put the image in `../rander shots/shots/<id>.png`, add the Arabic name to
  `src/data/spaces-ar.json`, then run `npm run images`.
- A new or corrected 3D plan: replace `../rander shots/3d-plans/<code>_3dplan.png` and run `npm run images`.

## 3D model

The master plan and building pages open on a real-time 3D model of the resort (three.js), made from the
3ds Max scene. Orbit, zoom and tap a building to open it; the building page flies the camera to it.
"Aerial image" switches back to the image view.

Rebuild the model after the scene changes:

1. In 3ds Max with `RESORT_web.max` open, run `pipeline/max/web_export.ms` (Scripting > Run Script). It
   skips V-Ray proxies, simplifies small props, converts V-Ray materials to Physical and exports
   `web_export/resort.glb`. It changes the scene in memory only: reload the file afterwards without saving.
2. `node scripts/optimize-model.mjs 0.07 0.012` (ratio, error) welds, simplifies, merges by material,
   converts textures to WebP and Draco-compresses into `public/media/model/resort.glb` (about 14 MB).
3. Clickable building volumes and the start camera are in `src/data/model.json` (3ds Max metres).

## Things that are approximate (to replace later)

- The 3D model has no trees, cars or people (they are V-Ray proxies, which do not export) and uses
  simplified real-time materials, so it looks lighter than the V-Ray renders.

- Building outlines on the aerial (`poly` in `src/data/buildings.json`) are traced by hand on the existing
  render. Replace them with polygons from V-Ray masks once the master render exists.
- Camera markers on the **3D** plans are mapped from the CAD crop by the building's box (`cropBox`), so
  they can be off by a few metres; on the **CAD** view (`?view=2d`) they are exact.
- All interior shots and 3D plans are AI interpretations of the CAD plans (see `../rander shots/INDEX.md`).
- B2 second floor has no distinct plan yet (shown as "plan pending").
- Not built yet: unit list with statuses and prices, filters, location map with landmarks, 360 tours.

## Deploy

- Live: https://mockup3d-chi.vercel.app (Vercel project `mockup3d`, connected to
  https://github.com/amr-ayman12/Mockup3d). Every push to `main` deploys automatically.
- `vercel.json` handles the single-page rewrites (deep links) and caching.
- Manual deploy from this folder: `vercel deploy --prod` (Vercel CLI).
