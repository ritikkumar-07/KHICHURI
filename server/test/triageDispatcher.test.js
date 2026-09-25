import assert from 'node:assert/strict';
import test from 'node:test';
import { safeParseJson } from '../src/services/aiDispatcher.js';

test('safeParseJson extracts JSON properly from code blocks and raw text', () => {
  const rawWithMarkdown = "```json\n{\n  \"isFinalVerdict\": true,\n  \"alertLevel\": \"RED\",\n  \"summary\": \"Severe allergic reaction\",\n  \"immediateActions\": [\"Administer epinephrine\"],\n  \"recommendedAction\": \"Emergency Room immediately\",\n  \"voiceResponse\": \"Call 112 right now.\"\n}\n```";
  const parsed = safeParseJson(rawWithMarkdown);
  assert.ok(parsed);
  assert.equal(parsed.isFinalVerdict, true);
  assert.equal(parsed.alertLevel, "RED");
  assert.equal(parsed.summary, "Severe allergic reaction");
  assert.deepEqual(parsed.immediateActions, ["Administer epinephrine"]);
  assert.equal(parsed.recommendedAction, "Emergency Room immediately");
  assert.equal(parsed.voiceResponse, "Call 112 right now.");
});

test('safeParseJson handles raw JSON strings without markdown', () => {
  const raw = JSON.stringify({
    isFinalVerdict: true,
    alertLevel: "GREEN",
    summary: "Mild dehydration",
    immediateActions: ["Drink water"],
    recommendedAction: "Rest and hydration at home",
    voiceResponse: "Drink plenty of water and rest."
  });
  const parsed = safeParseJson(raw);
  assert.ok(parsed);
  assert.equal(parsed.isFinalVerdict, true);
  assert.equal(parsed.alertLevel, "GREEN");
});

test('safeParseJson returns null on invalid or empty text', () => {
  assert.equal(safeParseJson(""), null);
  assert.equal(safeParseJson("not a json"), null);
});
