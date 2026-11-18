// make-demo-units.mjs - write DEMO guest-room units to src/data/units.json.
// Room counts follow the CAD plans; type, area, view, status and price are invented demo values.
// Replace the file with the owner's real list (same fields) when it arrives.
import fs from 'node:fs/promises';
import path from 'node:path';

const SITE = path.resolve(import.meta.dirname, '..');

// plan -> rooms on that floor, default view, and the room (1-based) that has an interior shot
const FLOORS = [
  { b: 'B1', f: '1', plan: 'B1-1', rooms: 4, view: 'garden', shot: { room: 1, id: 'B1-1_cam01' } },
  { b: 'B2', f: '1', plan: 'B2-1', rooms: 6, view: 'pool', shot: { room: 1, id: 'B2-1_cam02' } },
  { b: 'B3', f: '1', plan: 'B3-1', rooms: 12, view: 'sea', shot: { room: 4, id: 'B3-1_cam01' } },
  { b: 'B3', f: '2', plan: 'B3-2', rooms: 7, view: 'sea' },
  { b: 'B4', f: '1', plan: 'B4-1', rooms: 7, view: 'pool', shot: { room: 3, id: 'B4-1_cam01' } },
  { b: 'B4', f: '2', plan: 'B4-2', rooms: 5, view: 'pool' },
  { b: 'B5', f: '1', plan: 'B5-1', rooms: 3, view: 'sea', shot: { room: 2, id: 'B5-1_cam01' } },
];

// small deterministic random so re-running gives the same demo data
let seed = 20261118;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const TYPES = {
  Standard: { area: [32, 38], beds: 1, price: [650000, 780000] },
  Deluxe: { area: [40, 46], beds: 1, price: [820000, 980000] },
  Suite: { area: [55, 64], beds: 2, price: [1200000, 1480000] },
};

const units = [];
for (const fl of FLOORS) {
  for (let n = 1; n <= fl.rooms; n++) {
    const corner = n === 1 || n === fl.rooms;
    const type = corner && fl.rooms > 4 ? 'Suite' : rnd() < 0.45 ? 'Deluxe' : 'Standard';
    const t = TYPES[type];
    const area = Math.round(t.area[0] + rnd() * (t.area[1] - t.area[0]));
    const viewBonus = fl.view === 'sea' ? 1.12 : fl.view === 'pool' ? 1.05 : 1;
    const price = Math.round(((t.price[0] + rnd() * (t.price[1] - t.price[0])) * viewBonus) / 5000) * 5000;
    const r = rnd();
    const status = r < 0.6 ? 'available' : r < 0.85 ? 'reserved' : 'sold';
    const view = fl.view === 'sea' && rnd() < 0.25 ? 'pool' : fl.view;
    units.push({
      id: `${fl.b}-${fl.f}-${String(n).padStart(2, '0')}`,
      building: fl.b,
      floor: fl.f,
      plan: fl.plan,
      type,
      area_m2: area,
      beds: t.beds,
      view,
      status,
      price,
      currency: 'AED',
      shot: fl.shot && fl.shot.room === n ? fl.shot.id : null,
      demo: true,
    });
  }
}
void pick;
await fs.writeFile(path.join(SITE, 'src', 'data', 'units.json'), JSON.stringify({ _comment: 'DEMO DATA: statuses, prices, types and areas are invented placeholders.', units }, null, 2));
const by = (k) => units.reduce((a, u) => ((a[u[k]] = (a[u[k]] ?? 0) + 1), a), {});
console.log(units.length, 'units', by('status'), by('type'));
