// Runs a scenario file and prints the fight.
//   npm run duel -- scenarios/footsies-melee.json [--trace] [--json]

import { readFileSync } from 'node:fs';
import { runBout } from './bout.ts';
import { newBout } from './referee.ts';
import { LEGEND, report, rosterLines } from './report.ts';
import { rulesFor, scenarioController, separationOf, type Scenario } from './scenario.ts';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('Usage: npm run duel -- scenarios/<file>.json [--trace] [--json]');
  process.exit(1);
}

try {
  const sc = JSON.parse(readFileSync(file, 'utf8')) as Scenario;
  const bout = newBout(sc.A, sc.B, separationOf(sc), sc.challenged ?? 'B');
  const controllers = { A: scenarioController(sc, 'A'), B: scenarioController(sc, 'B') };
  const header = rosterLines(bout, controllers);
  const events = runBout(bout, controllers, rulesFor(sc), { trace: args.includes('--trace') });

  if (args.includes('--json')) {
    console.log(JSON.stringify(events, null, 2));
  } else {
    if (sc.title) console.log(`# ${sc.title}`);
    if (sc.note) console.log(sc.note);
    console.log(['', ...header, '', LEGEND].join('\n'));
    console.log(report(bout, events).join('\n'));
    if (!bout.over) {
      const F = bout.fighters;
      console.log(`\nNo KO. Wounds: A ${F.A.name} ${F.A.wounds}/${F.A.sheet.wounds}, B ${F.B.name} ${F.B.wounds}/${F.B.sheet.wounds}.`);
    }
  }
} catch (err) {
  console.error(`Error: ${(err as Error).message}`);
  process.exit(1);
}
