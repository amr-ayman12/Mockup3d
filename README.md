# Resort sales site

Interactive sales site for the seaside resort (B1–B5). It is built from pre-rendered images with
clickable SVG overlays (no real-time 3D), so it stays light and smooth on phones.

- Stack: Vite + React + TypeScript, React Router, OpenSeadragon (deep zoom), self-hosted Cairo font.
- Levels, each with its own URL:
  - `/` location: satellite map, project pin, nearby places with driving times, map filter, weather
  - `/master-plan` aerial / 3D model with the five buildings, tinted by type or availability, unit filter
    (type, availability, view, area, price) with result cards
  - `/master-plan/building/B4` the building and its floors
  - `/master-plan/building/B4/floor/1` the 3D floor plan with unit outlines; `?unit=B4-1-03` opens a unit card
  - `/master-plan/building/B4/floor/1/tour/B4-1_cam01` interior tour with room pills and a plan inset
- Arabic (default, RTL) and English, contact sheet (WhatsApp + email), overlay on/off, fullscreen,
  bottom sheets on phones.

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

After changing `location`, re-run `node scripts/make-landmarks.mjs`. It rebuilds `src/data/landmarks.json`
(nearest hospitals, universities and schools, attractions and malls, and the airport) from OpenStreetMap, with
driving times from the public OSRM router (no traffic). The public servers are sometimes busy; the script
retries, so just run it again if it gives up.

## Change units, statuses and prices

`src/data/units.json` holds every guest room (`id` like `B4-1-03` = building-floor-number) with `type`,
`area_m2`, `beds`, `view`, `status` (`available` / `reserved` / `sold`), `price`, `currency` and `shot` (the
interior shot used for its tour). It is DEMO data made by `scripts/make-demo-units.mjs`. Replace it with the
owner's list (same fields) and set `demo` to `false` on each unit to remove the demo notice. The outline of
each unit on its floor plan is in `src/data/unit-shapes.json` (image pixels of that floor's 3D plan).

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

## Unreal renders (master plan, facades, floor plans)

The master plan, building and floor pages use renders from the Unreal Engine 5.8 project `C:\UE\ResortViz`
(made from `web_export/resort.glb`). Every render also writes an EXR with the world position of each pixel,
so the overlays are traced automatically, never by hand. Scripts are in `C:\UE\ResortViz\Scripts`:

1. `render.ps1` renders the shots listed in `render_job.json` (use `tiles: 2` for 4000 px frames on the
   8 GB GPU). `render_floors.ps1` renders the top-down floor views, cut 2.6 m above each floor.
2. `overlays.py <shot.exr> <beauty.png> <out.json> [--floors]` traces the building/floor polygons;
   `footprints.py` derives the building outlines from the top view.
3. `plan_composite.py <B> <floor> <plan>` places the furnished 3D plan onto the site render and moves the
   unit outlines with it.
4. `node scripts/build-ue.mjs` turns all of it into deep-zoom tiles and `src/data/ue.json`.

The model has no interiors, so the furnished plans are still the AI plans from the CAD drawings.

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
- Units, statuses and prices are demo values until the owner's list arrives.
- The tour shows flat interior shots you can drag sideways, not true 360° panoramas. Real 360 tours need
  V-Ray spherical renders (6000 × 3000) of each room type from the 3ds Max scene.

## Deploy

- Live: https://mockup3d-chi.vercel.app (Vercel project `mockup3d`, connected to
  https://github.com/amr-ayman12/Mockup3d). Every push to `main` deploys automatically.
- `vercel.json` handles the single-page rewrites (deep links) and caching.
- Manual deploy from this folder: `vercel deploy --prod` (Vercel CLI).
