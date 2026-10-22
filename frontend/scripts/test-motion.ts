/**
 * Page transition key rules.
 * Run: npx --yes tsx scripts/test-motion.ts
 */
import assert from "node:assert/strict";

import { DURATION, MOTION, pageTransitionKey, reducedPreset } from "../lib/motion";

for (const [name, preset] of Object.entries(MOTION)) {
  const duration = preset.transition.duration ?? 0;
  assert.ok(duration > 0 && duration <= 0.3, `${name} duration ${duration}s must stay under 300ms`);
}
assert.ok(DURATION.fast < DURATION.base && DURATION.base < DURATION.panel);
assert.deepEqual(reducedPreset(MOTION.modal, true).animate, { opacity: 1 });
assert.equal(reducedPreset(MOTION.modal, false), MOTION.modal);

assert.equal(pageTransitionKey("/analytics"), "/analytics");
assert.equal(pageTransitionKey("/analytics?view=insights&from=2026-01-01"), "/analytics");
assert.equal(pageTransitionKey("/analytics?view=overview#panel"), "/analytics");
assert.equal(pageTransitionKey("/today"), "/today");
assert.equal(pageTransitionKey("/home"), "/home");

assert.equal(pageTransitionKey("/trades"), "/trades");
assert.equal(pageTransitionKey("/trades/abc"), "/trades/abc");
assert.notEqual(pageTransitionKey("/trades"), pageTransitionKey("/trades/abc"));

assert.equal(pageTransitionKey("/playbooks"), "/playbooks");
assert.equal(pageTransitionKey("/playbooks/setup-1"), "/playbooks/setup-1");
assert.notEqual(pageTransitionKey("/playbooks"), pageTransitionKey("/playbooks/setup-1"));

assert.equal(pageTransitionKey("/settings/profile"), "/settings/profile");
assert.equal(pageTransitionKey("/settings/broker"), "/settings/broker");
assert.notEqual(pageTransitionKey("/settings/profile"), pageTransitionKey("/settings/broker"));

assert.equal(pageTransitionKey("/tradefiz-ai"), "/tradefiz-ai");
assert.equal(pageTransitionKey("/tradefiz-ai/chat"), "/tradefiz-ai/chat");
assert.equal(pageTransitionKey("/tradefiz-ai/chat/conv-1"), "/tradefiz-ai/chat");
assert.equal(pageTransitionKey("/tradefiz-ai/chat/conv-1?q=hello"), "/tradefiz-ai/chat");
assert.notEqual(pageTransitionKey("/tradefiz-ai"), pageTransitionKey("/tradefiz-ai/chat/conv-1"));

assert.equal(pageTransitionKey(""), "/");
assert.equal(pageTransitionKey("analytics"), "/analytics");
assert.equal(pageTransitionKey("/settings/profile/"), "/settings/profile");

console.log("motion key checks passed");
