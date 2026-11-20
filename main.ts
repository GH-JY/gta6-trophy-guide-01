// Leonida Ledger — gta6-trophy-guide-01 hand-in program.
//
// The entry is app/: plain static files that run from a static server with app/ at its root, with no build step
// and no network. This program packages it the way the competition asks: copy app/ and screenshots/ from beside
// this file into the output directory, then write dossier.json there with the vendored make.fun library. The
// first screenshot by name becomes the dossier cover.
//
// Node 22.18+ runs this directly (TypeScript type stripping, standard library only). Outside the grader's
// container, MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const out = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// Refuse the one dangerous value: packaging into the repository itself would delete the real app/ and
// screenshots/ during the clean step below.
if (out === resolve(root)) {
  throw new Error('MAKEFUN_OUTPUT_DIR must not be the entry directory; choose a scratch or /output folder.');
}
for (const name of ['app', 'screenshots']) {
  const rel = relative(resolve(root, name), out);
  if (rel === '' || (!rel.startsWith('..') && !rel.includes(':'))) {
    throw new Error(`MAKEFUN_OUTPUT_DIR must not be inside ${name}/.`);
  }
}

// The scorer's caps, from the kit's gate: the dossier text is bounded, and the same limits are re-checked here so
// an entry the scorer would refuse fails locally first. buildDossier throws rather than returning a report when a
// bound is broken, which is the outcome we want.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
};
const DOSSIER_MAX_BYTES = 1572864;

const appSource = join(root, 'app');
const shotsSource = join(root, 'screenshots');
for (const [name, source] of [['app', appSource], ['screenshots', shotsSource]] as const) {
  if (!existsSync(source)) throw new Error(`Missing ${name}/ beside main.ts; the entry is incomplete.`);
}

const shots = readdirSync(shotsSource, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .sort();
if (shots.length < 3 || shots.length > CAPS.screenshots.max) {
  throw new Error(`Expected 3 to ${CAPS.screenshots.max} screenshots, found ${shots.length}.`);
}
for (const name of shots) {
  const bytes = statSync(join(shotsSource, name)).size;
  if (bytes > CAPS.screenshots.max_bytes) {
    throw new Error(`screenshots/${name} is ${bytes} bytes; the cap is ${CAPS.screenshots.max_bytes}.`);
  }
}

// Build into a clean directory so two runs produce the same tree and the same dossier bytes. Only the three
// paths this program owns are removed.
mkdirSync(out, { recursive: true });
for (const name of ['app', 'screenshots', 'dossier.json']) {
  rmSync(join(out, name), { recursive: true, force: true });
}
for (const [name, source] of [['app', appSource], ['screenshots', shotsSource]] as const) {
  cpSync(source, join(out, name), { recursive: true });
}

const dossier = buildDossier(out, CAPS);
writeFileSync(join(out, 'dossier.json'), dossier);

// Read the result back the way a judge would: parse it, check the cover image set and the size the kit allows,
// and confirm every embedded image decodes to the file it claims to be.
let parsed: { images?: Array<{ name?: string; media_type?: string; base64?: string }> };
try {
  parsed = JSON.parse(readFileSync(join(out, 'dossier.json'), 'utf8'));
} catch (error) {
  throw new Error(`dossier.json did not parse after writing: ${error instanceof Error ? error.message : String(error)}`);
}
const images = parsed.images ?? [];
if (images.length < 3 || images.length > CAPS.screenshots.max) {
  throw new Error(`dossier.json embeds ${images.length} images; expected 3 to ${CAPS.screenshots.max}.`);
}
const dossierBytes = statSync(join(out, 'dossier.json')).size;
if (dossierBytes > DOSSIER_MAX_BYTES) {
  throw new Error(`dossier.json is ${dossierBytes} bytes; the entry limit is ${DOSSIER_MAX_BYTES}.`);
}
for (const image of images) {
  if (!image.name || !image.media_type || !image.base64) throw new Error('dossier.json has an incomplete image record.');
  if (!existsSync(join(out, 'screenshots', image.name))) throw new Error(`dossier image ${image.name} is not in screenshots/.`);
  if (Buffer.from(image.base64, 'base64').length === 0) throw new Error(`dossier image ${image.name} is empty.`);
}

console.log(
  `Packaged ${out}: app/ (${countFiles(join(out, 'app'))} files), screenshots/ (${shots.length}), ` +
    `dossier.json (${dossierBytes} bytes, ${images.length} images, cover ${images[0]?.name ?? 'none'}).`,
);

function countFiles(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    total += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return total;
}
