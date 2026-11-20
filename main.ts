// Leonida Ledger — gta6-trophy-guide-01 hand-in program.
//
// The entry itself is app/: plain static files (HTML, CSS, ES modules, JSON) that run from any static server with
// app/ at its root, with no build step and no network. This program packages it the way the competition asks: copy
// app/ and screenshots/ from beside this file into the output directory, then write dossier.json there with the
// vendored make.fun library. The first screenshot by name becomes the cover shot in the dossier.
//
// Node 22.18+ runs this directly (TypeScript type stripping, standard library only). Outside the grader's
// container, MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps, from the kit's gate: the dossier text is bounded, and the same limits are re-checked here so an
// entry the scorer would refuse fails locally first. buildDossier throws rather than returning a report when a bound
// is broken, which is the outcome we want.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
};

mkdirSync(out, { recursive: true });

for (const name of ['app', 'screenshots']) {
  const source = join(root, name);
  if (!existsSync(source)) throw new Error(`Missing ${name}/ beside main.ts; the entry is incomplete.`);
  cpSync(source, join(out, name), { recursive: true });
}

writeFileSync(join(out, 'dossier.json'), buildDossier(out, CAPS));
console.log(`Packaged app/, screenshots/ and dossier.json into ${out}`);
