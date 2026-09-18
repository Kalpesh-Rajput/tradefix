/**
 * Market session calculation tests.
 * Run: npx --yes tsx scripts/test-market-sessions.ts
 */
import {
  buildMarketSessionSnapshot,
  getActiveSessions,
  getNextSession,
  getSessionOverlaps,
  getSessionsForTrade,
  getSessionStatus,
  isSessionOpenAt,
} from "../lib/market-sessions/calculations";
import { MARKET_SESSIONS, SESSION_BY_ID } from "../lib/market-sessions/sessions";
import {
  dateKeyInZone,
  formatDurationMs,
  formatGmtOffset,
  formatTimeInZone,
  isValidTimeZone,
  zonedTimeToUtc,
} from "../lib/market-sessions/timezone";
import { getTimezoneOffsetMinutes } from "../lib/timezones";

let failed = 0;
let passed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL  ${msg}`);
}

function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  assert(ok, `${msg} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
}

function iso(d: Date): string {
  return d.toISOString();
}

const london = SESSION_BY_ID.london;
const ny = SESSION_BY_ID.new_york;
const tokyo = SESSION_BY_ID.tokyo;
const sydney = SESSION_BY_ID.sydney;

// --- Timezone conversion / DST ---
const londonWinterOpen = zonedTimeToUtc(2026, 1, 15, 8, 0, 0, "Europe/London");
assertEq(iso(londonWinterOpen), "2026-01-15T08:00:00.000Z", "London winter 08:00 is 08:00 UTC");

const londonSummerOpen = zonedTimeToUtc(2026, 7, 15, 8, 0, 0, "Europe/London");
assertEq(iso(londonSummerOpen), "2026-07-15T07:00:00.000Z", "London summer 08:00 is 07:00 UTC");

const nyWinterOpen = zonedTimeToUtc(2026, 1, 15, 8, 0, 0, "America/New_York");
assertEq(iso(nyWinterOpen), "2026-01-15T13:00:00.000Z", "NY winter 08:00 is 13:00 UTC");

const nySummerOpen = zonedTimeToUtc(2026, 7, 15, 8, 0, 0, "America/New_York");
assertEq(iso(nySummerOpen), "2026-07-15T12:00:00.000Z", "NY summer 08:00 is 12:00 UTC");

const tokyoOpen = zonedTimeToUtc(2026, 7, 15, 9, 0, 0, "Asia/Tokyo");
assertEq(iso(tokyoOpen), "2026-07-15T00:00:00.000Z", "Tokyo 09:00 is 00:00 UTC");

const sydneySummerOpen = zonedTimeToUtc(2026, 1, 15, 7, 0, 0, "Australia/Sydney");
assertEq(iso(sydneySummerOpen), "2026-01-14T20:00:00.000Z", "Sydney AEDT 07:00 is 20:00 UTC previous day");

const sydneyWinterOpen = zonedTimeToUtc(2026, 7, 15, 7, 0, 0, "Australia/Sydney");
assertEq(iso(sydneyWinterOpen), "2026-07-14T21:00:00.000Z", "Sydney AEST 07:00 is 21:00 UTC previous day");

assert(
  getTimezoneOffsetMinutes("Europe/London", new Date("2026-01-15T12:00:00Z")) === 0,
  "UK winter offset is GMT+0"
);
assert(
  getTimezoneOffsetMinutes("Europe/London", new Date("2026-07-15T12:00:00Z")) === 60,
  "UK summer offset is GMT+1"
);
assert(
  getTimezoneOffsetMinutes("America/New_York", new Date("2026-01-15T12:00:00Z")) === -300,
  "US winter offset is GMT-5"
);
assert(
  getTimezoneOffsetMinutes("America/New_York", new Date("2026-07-15T12:00:00Z")) === -240,
  "US summer offset is GMT-4"
);
assert(
  getTimezoneOffsetMinutes("Australia/Sydney", new Date("2026-01-15T12:00:00Z")) === 660,
  "AU summer offset is GMT+11"
);
assert(
  getTimezoneOffsetMinutes("Australia/Sydney", new Date("2026-07-15T12:00:00Z")) === 600,
  "AU winter offset is GMT+10"
);

// US DST spring-forward 2026-03-08: NY 08:00 local still maps after the jump
const nyDstDayOpen = zonedTimeToUtc(2026, 3, 8, 8, 0, 0, "America/New_York");
assertEq(iso(nyDstDayOpen), "2026-03-08T12:00:00.000Z", "NY DST start day 08:00 is 12:00 UTC (EDT)");

const nyPreDst = zonedTimeToUtc(2026, 3, 7, 8, 0, 0, "America/New_York");
assertEq(iso(nyPreDst), "2026-03-07T13:00:00.000Z", "NY day before DST 08:00 is 13:00 UTC (EST)");

// UK DST 2026-03-29
const londonDstDay = zonedTimeToUtc(2026, 3, 29, 8, 0, 0, "Europe/London");
assertEq(iso(londonDstDay), "2026-03-29T07:00:00.000Z", "UK DST start day 08:00 is 07:00 UTC");

const londonPreDst = zonedTimeToUtc(2026, 3, 28, 8, 0, 0, "Europe/London");
assertEq(iso(londonPreDst), "2026-03-28T08:00:00.000Z", "UK day before DST 08:00 is 08:00 UTC");

// AU DST ends first Sunday of April 2026 (Apr 5, 03:00 AEDT → 02:00 AEST)
const auBeforeDstEnd = zonedTimeToUtc(2026, 4, 4, 7, 0, 0, "Australia/Sydney");
assertEq(iso(auBeforeDstEnd), "2026-04-03T20:00:00.000Z", "Sydney day before DST end 07:00 is AEDT (UTC+11)");

const auAfterDstEnd = zonedTimeToUtc(2026, 4, 5, 7, 0, 0, "Australia/Sydney");
assertEq(iso(auAfterDstEnd), "2026-04-04T21:00:00.000Z", "Sydney DST-end day 07:00 is AEST (UTC+10)");

// --- Display conversion in Kolkata changes with London DST ---
assertEq(
  formatTimeInZone(londonWinterOpen, "Asia/Kolkata", "h24"),
  "13:30",
  "London winter open in Kolkata is 13:30"
);
assertEq(
  formatTimeInZone(londonSummerOpen, "Asia/Kolkata", "h24"),
  "12:30",
  "London summer open in Kolkata is 12:30"
);
assertEq(
  formatTimeInZone(nyWinterOpen, "Asia/Kolkata", "h12"),
  "6:30 PM",
  "NY winter open in Kolkata is 6:30 PM"
);
assertEq(
  formatTimeInZone(nySummerOpen, "Asia/Kolkata", "h12"),
  "5:30 PM",
  "NY summer open in Kolkata is 5:30 PM"
);

// --- Open / closed at known UTC instants (winter) ---
const noonWinter = new Date("2026-01-15T12:00:00.000Z");
assertEq(getSessionStatus(london, noonWinter), "open", "London open at 12:00 UTC winter");
assertEq(getSessionStatus(ny, noonWinter), "closed", "NY closed at 12:00 UTC winter");
assertEq(getSessionStatus(tokyo, noonWinter), "closed", "Tokyo closed at 12:00 UTC winter");
assertEq(getSessionStatus(sydney, noonWinter), "closed", "Sydney closed at 12:00 UTC winter");

const overlapWinter = new Date("2026-01-15T14:00:00.000Z");
const activeOverlap = getActiveSessions(overlapWinter).map((s) => s.id).sort();
assertEq(activeOverlap.join(","), "london,new_york", "London+NY both open at 14:00 UTC winter");
assert(getSessionOverlaps(overlapWinter).length === 1, "One overlap pair at 14:00 UTC winter");
assertEq(
  getSessionOverlaps(overlapWinter)[0].map((s) => s.id).join("+"),
  "london+new_york",
  "Overlap pair is London+NY"
);

const tokyoLondon = new Date("2026-01-15T08:30:00.000Z");
assert(isSessionOpenAt(tokyo, tokyoLondon), "Tokyo still open at 08:30 UTC");
assert(isSessionOpenAt(london, tokyoLondon), "London already open at 08:30 UTC");
assert(
  getSessionOverlaps(tokyoLondon).some((p) => p[0].id === "tokyo" && p[1].id === "london"),
  "Tokyo+London overlap detected"
);

const sydneyTokyo = new Date("2026-01-15T02:00:00.000Z");
assert(isSessionOpenAt(sydney, sydneyTokyo), "Sydney open at 02:00 UTC summer-AU");
assert(isSessionOpenAt(tokyo, sydneyTokyo), "Tokyo open at 02:00 UTC");
assert(getActiveSessions(sydneyTokyo).length >= 2, "Multiple active sessions at Sydney/Tokyo overlap");

// Summer NY/London overlap starts earlier in UTC
const summerOverlap = new Date("2026-07-15T13:00:00.000Z");
assert(isSessionOpenAt(london, summerOverlap), "London open at 13:00 UTC summer");
assert(isSessionOpenAt(ny, summerOverlap), "NY open at 13:00 UTC summer");
const winterSameClock = new Date("2026-01-15T13:00:00.000Z");
assert(isSessionOpenAt(ny, winterSameClock), "NY opens at 13:00 UTC winter");
assert(
  getActiveSessions(new Date("2026-01-15T12:30:00.000Z")).every((s) => s.id !== "new_york"),
  "NY still closed at 12:30 UTC winter"
);

// --- Next session ---
const beforeLondon = new Date("2026-01-15T07:00:00.000Z");
const next = getNextSession(beforeLondon);
assert(next != null, "Next session exists before London open");
assertEq(next?.def.id, "london", "Next session is London at 07:00 UTC winter");

const afterNyClose = new Date("2026-01-16T22:30:00.000Z");
const nextAfterNy = getNextSession(afterNyClose);
assert(nextAfterNy != null, "Next session exists after NY close");
assertEq(nextAfterNy?.def.id, "tokyo", "After NY close in January, Sydney is already open so next open is Tokyo");

// --- Midnight-crossing timeline (Sydney as seen from New York) ---
const nyView = buildMarketSessionSnapshot({
  now: new Date("2026-01-15T18:00:00.000Z"),
  viewTimeZone: "America/New_York",
  viewDate: "2026-01-15",
});
const sydneyRow = nyView.rows.find((r) => r.def.id === "sydney");
assert(sydneyRow != null && sydneyRow.segments.length >= 1, "Sydney has timeline segments in NY view");
assert(
  (sydneyRow?.segments.length ?? 0) >= 1 &&
    sydneyRow!.segments.some((s) => s.startPct > 50 || s.endPct < 20),
  "Sydney wraps or sits near NY midnight on the timeline"
);

const wrapView = buildMarketSessionSnapshot({
  now: new Date("2026-01-15T05:00:00.000Z"),
  viewTimeZone: "America/New_York",
  viewDate: "2026-01-14",
});
const sydneyWrap = wrapView.rows.find((r) => r.def.id === "sydney");
assert((sydneyWrap?.segments.length ?? 0) >= 1, "Sydney still renders when it crosses NY midnight");

// --- Snapshot: Kolkata display times are dynamic ---
const kolkataSnap = buildMarketSessionSnapshot({
  now: noonWinter,
  viewTimeZone: "Asia/Kolkata",
  viewDate: dateKeyInZone(noonWinter, "Asia/Kolkata"),
});
assert(kolkataSnap.isToday, "Kolkata snapshot is today");
assertEq(kolkataSnap.activeIds.join(","), "london", "Only London active at noon UTC winter in snapshot");
assert(kolkataSnap.currentOverlaps.length === 0, "No current overlap at noon UTC winter");
assert(kolkataSnap.nextOverlap != null, "Next overlap is calculated");
assertEq(kolkataSnap.nextOverlap?.names, "London + New York", "Next overlap is London + New York");
assert(kolkataSnap.rows.length === 4, "Four session rows");
assert(
  kolkataSnap.rows.every((r) => r.segments.length >= 1),
  "Every session has at least one timeline bar"
);
assert(kolkataSnap.activity.some((v) => v >= 2), "Activity curve has overlap peaks");

const londonRow = kolkataSnap.rows.find((r) => r.def.id === "london");
assert(londonRow?.isOpen === true, "London row is open");
assert(londonRow?.closesInMs != null && londonRow.closesInMs > 0, "London has closes-in countdown");

const tokyoRow = kolkataSnap.rows.find((r) => r.def.id === "tokyo");
assert(tokyoRow?.isOpen === false, "Tokyo row is closed at noon UTC");
assert(tokyoRow?.opensInMs != null && tokyoRow.opensInMs > 0, "Tokyo has opens-in countdown");

// Switching timezone recalculates converted times
const nySnap = buildMarketSessionSnapshot({
  now: noonWinter,
  viewTimeZone: "America/New_York",
  viewDate: dateKeyInZone(noonWinter, "America/New_York"),
});
assert(
  formatTimeInZone(londonRow!.open, "Asia/Kolkata", "h24") !==
    formatTimeInZone(nySnap.rows.find((r) => r.def.id === "london")!.open, "America/New_York", "h24"),
  "Converted London open differs between Kolkata and New York views"
);

// --- Multiple active sessions panel ---
const multi = buildMarketSessionSnapshot({
  now: overlapWinter,
  viewTimeZone: "UTC",
  viewDate: "2026-01-15",
});
assert(multi.activeIds.length === 2, "Two active sessions in snapshot");
assert(multi.currentOverlaps.length === 1, "Current overlap present");
assert(multi.nextClose != null, "Next close exists while sessions are open");

const saturday = buildMarketSessionSnapshot({
  now: new Date("2026-01-17T10:00:00.000Z"),
  viewTimeZone: "UTC",
  viewDate: "2026-01-17",
});
assert(saturday.rows.length === 4, "Weekend still shows the four session windows");
assert(saturday.nextOpen != null || saturday.activeIds.length > 0, "Weekend snapshot still has live session state");

// --- Trade helpers ---
const trade = getSessionsForTrade(overlapWinter, new Date("2026-01-15T23:00:00.000Z"));
assert(trade.entrySessions.includes("london") && trade.entrySessions.includes("new_york"), "Entry during LN/NY");
assert(trade.entryOverlap, "Entry overlap flag");
assert(trade.exitSessions.length <= 1, "Late UTC exit is not an overlap");

// --- Formatting ---
assertEq(formatDurationMs(102 * 60_000), "01h 42m", "Countdown pads hours and minutes");
assertEq(formatDurationMs(18 * 60_000), "18m", "Sub-hour countdown");
assertEq(formatTimeInZone(new Date("2026-01-15T13:30:00.000Z"), "UTC", "h12"), "1:30 PM", "12-hour format");
assertEq(formatTimeInZone(new Date("2026-01-15T13:30:00.000Z"), "UTC", "h24"), "13:30", "24-hour format");
assertEq(formatGmtOffset(330), "GMT+5:30", "Kolkata offset label");
assertEq(formatGmtOffset(0), "GMT+0", "UTC offset label");
assertEq(formatGmtOffset(-240), "GMT-4", "EDT offset label");
assert(isValidTimeZone("Asia/Kolkata"), "Kolkata is valid");
assert(!isValidTimeZone("Not/A_Zone"), "Invalid zone rejected");
assert(isValidTimeZone("UTC"), "UTC is valid");

// --- Different user timezones produce different date keys around midnight ---
const aroundNyMidnight = new Date("2026-01-16T03:30:00.000Z");
assertEq(dateKeyInZone(aroundNyMidnight, "America/New_York"), "2026-01-15", "NY still previous evening");
assertEq(dateKeyInZone(aroundNyMidnight, "Asia/Kolkata"), "2026-01-16", "Kolkata already next morning");

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`All ${passed} market-session tests passed.`);
