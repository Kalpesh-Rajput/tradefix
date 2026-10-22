/**
 * Avatar initials, sizing, and palette determinism.
 * Run: npx --yes tsx scripts/test-avatar.ts
 */
import assert from "node:assert/strict";

import { avatarColors, avatarInitials, resolveAvatarSize } from "../lib/avatar";

assert.equal(avatarInitials("Kalpesh Rajput"), "KR");
assert.equal(avatarInitials("Kalpesh"), "K");
assert.equal(avatarInitials("  kalpesh   kumar  rajput "), "KR");
assert.equal(avatarInitials("", "jane.doe@example.com"), "JD");
assert.equal(avatarInitials(null, null), "");
assert.equal(avatarInitials("   ", ""), "");

assert.equal(resolveAvatarSize("xs"), 24);
assert.equal(resolveAvatarSize("profile"), 120);
assert.equal(resolveAvatarSize(37), 37);

const a = avatarColors("Kalpesh Rajput", "k@x.com");
const b = avatarColors("Kalpesh Rajput", "k@x.com");
assert.deepEqual(a, b);
assert.match(a.from, /^hsl\(\d+ 52% 40%\)$/);

import { clampOffset, coverScale, sourceRect, validateAvatarFile } from "../lib/image-crop";

assert.equal(validateAvatarFile({ type: "image/png", size: 1000 }), null);
assert.ok(validateAvatarFile({ type: "image/gif", size: 1000 }));
assert.ok(validateAvatarFile({ type: "image/png", size: 3 * 1024 * 1024 }));

const scale = coverScale(400, 200, 256);
assert.equal(scale, 1.28);
assert.deepEqual(clampOffset({ x: 999, y: 999 }, 400, 200, 256, scale), { x: 128, y: 0 });
const centered = sourceRect({ x: 0, y: 0 }, 400, 200, 256, scale);
assert.equal(centered.size, 200);
assert.equal(centered.sx, 100);
assert.equal(Math.abs(centered.sy), 0);

console.log("avatar tests passed");
