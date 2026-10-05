// Runs one npm script at several commits, side by side, to see what a run of rule changes did.
//   npm run ladder -- <ref> [<ref> ...] -- <script> [args]
//   npm run ladder -- HEAD~2 HEAD~1 HEAD -- brains --skill novice
// Each ref gets a temporary git worktree sharing this checkout's node_modules; output lands in ladder/<ref>.txt.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const split = argv.indexOf('--');
if (split < 1 || split === argv.length - 1) {
  console.error('Usage: npm run ladder -- <ref> [<ref> ...] -- <script> [args]');
  process.exit(1);
}
const refs = argv.slice(0, split);
const [script, ...args] = argv.slice(split + 1);

const here = fileURLToPath(new URL('..', import.meta.url));
const git = (...a: string[]) => execFileSync('git', a, { cwd: here, encoding: 'utf8' }).trim();
const top = git('rev-parse', '--show-toplevel');
const sub = here.slice(top.length).replace(/^\/|\/$/g, '');
const outDir = join(here, 'ladder');
mkdirSync(outDir, { recursive: true });

for (const ref of refs) {
  const sha = git('rev-parse', '--short', ref);
  const subject = git('log', '-1', '--format=%s', ref);
  const dir = mkdtempSync(join(tmpdir(), `ladder-${sha}-`));
  git('worktree', 'add', '--detach', '--quiet', dir, sha);
  try {
    const work = join(dir, sub);
    symlinkSync(join(here, 'node_modules'), join(work, 'node_modules'));
    console.log(`\n════ ${ref} (${sha}) ${subject} ════`);
    const out = execFileSync('npm', ['run', '-s', script, '--', ...args], { cwd: work, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    console.log(out);
    writeFileSync(join(outDir, `${ref.replace(/[^\w.-]/g, '_')}.txt`), `${ref} (${sha}) ${subject}\n\n${out}`);
  } finally {
    git('worktree', 'remove', '--force', dir);
    rmSync(dir, { recursive: true, force: true });
  }
}
