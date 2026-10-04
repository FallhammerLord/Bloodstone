// Runs a scenario file and prints the fight.
//   node --experimental-strip-types src/cli.ts scenarios/footsies-melee.json [--trace] [--json]

import { readFileSync } from 'node:fs';
import { parseAction } from './actions.ts';
import { newBout, runExchange, type Event, type FighterSetup, type Side } from './referee.ts';
import { LEGEND, report, rosterLines } from './report.ts';

interface Scenario {
  title?: string;
  note?: string;
  separation: number;
  challenged?: Side;
  A: FighterSetup;
  B: FighterSetup;
  exchanges: { A: string[]; B: string[] }[];
}

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('Usage: npm run duel -- scenarios/<file>.json [--trace] [--json]');
  process.exit(1);
}

try {
  const sc = JSON.parse(readFileSync(file, 'utf8')) as Scenario;
  const bout = newBout(sc.A, sc.B, sc.separation, sc.challenged ?? 'B');
  const events: Event[] = [];
  const header = rosterLines(bout);
  for (const ex of sc.exchanges) {
    events.push(...runExchange(bout, { A: ex.A.map(parseAction), B: ex.B.map(parseAction) }, { trace: args.includes('--trace') }));
  }
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
