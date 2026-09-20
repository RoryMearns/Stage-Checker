import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    computeFlowDifferencePercent,
    flowDifferenceDirectionWord,
    nzUtcOffset,
    todayIsoNz,
    formatNzTime,
    parseApiTimeAsNzLocal,
    roundToNearestFiveMinutes,
    subtractMinutesFromTimeString
} from '../js/form-utils.js';

describe('computeFlowDifferencePercent', () => {
    test('computes a known percentage, rounded to 1dp', () => {
        assert.equal(computeFlowDifferencePercent(100, 108), 8.0);
        assert.equal(computeFlowDifferencePercent(100, 92), 8.0);
    });

    test('is always non-negative (absolute difference)', () => {
        assert.equal(computeFlowDifferencePercent(50, 55), computeFlowDifferencePercent(50, 45));
    });

    test('guards against division by zero when rated is 0', () => {
        assert.equal(computeFlowDifferencePercent(0, 10), null);
    });

    test('returns null for non-numeric input', () => {
        assert.equal(computeFlowDifferencePercent('abc', 10), null);
        assert.equal(computeFlowDifferencePercent(10, ''), null);
        assert.equal(computeFlowDifferencePercent(10, undefined), null);
    });

    test('avoids floating-point boundary errors right at a threshold', () => {
        // 8.000000000000007-style float noise should not tip 8.0% into "above 8%".
        const pct = computeFlowDifferencePercent(3, 3.24);
        assert.equal(pct, 8.0);
    });
});

describe('flowDifferenceDirectionWord', () => {
    test('identifies above, below, and equal', () => {
        assert.equal(flowDifferenceDirectionWord(100, 110), 'above');
        assert.equal(flowDifferenceDirectionWord(100, 90), 'below');
        assert.equal(flowDifferenceDirectionWord(100, 100), 'equal to');
    });
});

describe('nzUtcOffset', () => {
    test('is always exactly +12:00 (NZST) or +13:00 (NZDT)', () => {
        assert.ok(['+12:00', '+13:00'].includes(nzUtcOffset()));
    });
});

describe('todayIsoNz', () => {
    test('returns a well-formed ISO date string', () => {
        assert.match(todayIsoNz(), /^\d{4}-\d{2}-\d{2}$/);
    });
});

describe('formatNzTime', () => {
    test('formats as zero-padded HH:MM', () => {
        assert.match(formatNzTime(new Date()), /^\d{2}:\d{2}$/);
    });

    test('midnight NZ local does not render as 24:xx', () => {
        // June is unambiguously NZST (UTC+12) year-round, so this is safe regardless of
        // when this test suite happens to run - no dependency on the current real-world offset.
        const midnightNzAsUtc = new Date('2026-06-14T12:00:00Z');
        assert.equal(formatNzTime(midnightNzAsUtc).startsWith('00:'), true);
    });
});

describe('parseApiTimeAsNzLocal (regression: the Z-suffix timezone bug)', () => {
    // AQWebPortal's Dataset_Chart response labels timestamps with a trailing 'Z' as if they
    // were UTC, but they are actually already NZ local time (the request specifies timezone=720).
    // Treating them as real UTC and converting again silently added a spurious +12/+13 hours.
    // This locks in the fix: the raw digits must be read back out unchanged as NZ local time,
    // regardless of what timezone the machine running the code is in.
    test('a Z-suffixed timestamp is read as NZ local time, not converted from UTC', () => {
        const parsed = parseApiTimeAsNzLocal('2026-09-18T08:35:00Z');
        assert.equal(formatNzTime(parsed), '08:35');
    });

    test('round-trips arbitrary times on today\'s date without drifting', () => {
        // parseApiTimeAsNzLocal uses *today's* current NZ offset for every timestamp it parses,
        // which matches how it's actually used in production (always on recent data, never an
        // arbitrary past or future date). Testing against today keeps this test's correctness
        // independent of which season it happens to run in.
        const today = todayIsoNz();
        for (const time of ['00:00', '12:34', '23:59']) {
            const parsed = parseApiTimeAsNzLocal(`${today}T${time}:00Z`);
            assert.equal(formatNzTime(parsed), time, `mismatch for ${time}`);
        }
    });

    test('returns null for missing or unparseable input', () => {
        assert.equal(parseApiTimeAsNzLocal(null), null);
        assert.equal(parseApiTimeAsNzLocal(undefined), null);
        assert.equal(parseApiTimeAsNzLocal('not a date'), null);
    });
});

describe('roundToNearestFiveMinutes', () => {
    test('rounds down when closer to the previous 5-minute mark', () => {
        assert.equal(roundToNearestFiveMinutes(9, 32), '09:30');
    });

    test('rounds up when closer to the next 5-minute mark', () => {
        assert.equal(roundToNearestFiveMinutes(9, 33), '09:35');
    });

    test('rolls over to the next hour when rounding up from :58', () => {
        assert.equal(roundToNearestFiveMinutes(9, 58), '10:00');
    });

    test('rolls over past midnight when rounding up from 23:58', () => {
        assert.equal(roundToNearestFiveMinutes(23, 58), '00:00');
    });

    test('pads single-digit hours and minutes', () => {
        assert.equal(roundToNearestFiveMinutes(3, 2), '03:00');
    });
});

describe('subtractMinutesFromTimeString', () => {
    test('subtracts minutes within the same hour', () => {
        assert.equal(subtractMinutesFromTimeString('08:03', 5), '07:58');
    });

    test('wraps backward across midnight', () => {
        assert.equal(subtractMinutesFromTimeString('00:02', 5), '23:57');
    });

    test('wraps backward from exactly midnight', () => {
        assert.equal(subtractMinutesFromTimeString('00:00', 5), '23:55');
    });

    test('handles a subtraction larger than an hour', () => {
        assert.equal(subtractMinutesFromTimeString('01:00', 90), '23:30');
    });
});