import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { diff, goldenScenarios, GOLDEN_FILES } from '../src/golden.ts';

// The fast half of the golden masters; `npm run golden` checks the brain bouts too.
test('every scenario plays out exactly as recorded', () => {
  const want = JSON.parse(readFileSync(GOLDEN_FILES.scenarios, 'utf8'));
  assert.deepEqual(diff('scenarios', want, goldenScenarios()), []);
});
