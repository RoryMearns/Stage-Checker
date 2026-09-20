import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    extrapolateFuturePoints,
    resolveComparisonPoint,
    computeLagShift,
    trailingMedianSmooth,
    EXTRAPOLATION_INTERVAL_MS,
    EXTRAPOLATION_MAX_MS,
    EXTRAPOLATION_TREND_POINTS
} from '../js/flow-math.js';

function makePoints(startTime, values, stepMs = EXTRAPOLATION_INTERVAL_MS) {
    return values.map((value, i) => ({
        time: new Date(startTime.getTime() + i * stepMs),
        value
    }));
}

describe('extrapolateFuturePoints', () => {
    test('returns nothing with fewer than 2 real points', () => {
        assert.deepEqual(extrapolateFuturePoints([]), []);
        assert.deepEqual(extrapolateFuturePoints([{ time: new Date(), value: 5 }]), []);
    });

    test('produces exactly one point per 5-minute step for a 2-hour horizon', () => {
        const points = makePoints(new Date('2026-01-01T00:00:00+13:00'), [10, 10, 10, 10, 10, 10]);
        const result = extrapolateFuturePoints(points);
        const expectedSteps = EXTRAPOLATION_MAX_MS / EXTRAPOLATION_INTERVAL_MS;
        assert.equal(result.length, expectedSteps);
    });

    test('extrapolated points are spaced exactly 5 minutes apart, starting 5 minutes after the last real point', () => {
        const lastTime = new Date('2026-01-01T00:25:00+13:00');
        const points = makePoints(new Date('2026-01-01T00:00:00+13:00'), [10, 10, 10, 10, 10, 10]);
        const result = extrapolateFuturePoints(points);
        assert.equal(result[0].time.getTime() - lastTime.getTime(), EXTRAPOLATION_INTERVAL_MS);
        for (let i = 1; i < result.length; i++) {
            assert.equal(result[i].time.getTime() - result[i - 1].time.getTime(), EXTRAPOLATION_INTERVAL_MS);
        }
    });

    test('a flat recent trend extrapolates as flat', () => {
        const points = makePoints(new Date('2026-01-01T00:00:00+13:00'), [10, 10, 10, 10, 10, 10]);
        const result = extrapolateFuturePoints(points);
        for (const p of result) {
            assert.ok(Math.abs(p.value - 10) < 1e-9, `expected ~10, got ${p.value}`);
        }
    });

    test('a genuinely falling trend keeps falling rather than flattening prematurely', () => {
        // Regression test: an earlier damped-linear model made a steep recession flatten out
        // almost immediately. The exponential model should continue the decline meaningfully
        // across the full 2-hour horizon.
        const points = makePoints(new Date('2026-01-01T00:00:00+13:00'), [90, 87, 84.5, 82.5, 81, 80]);
        const result = extrapolateFuturePoints(points);
        const at30min = result[5].value;
        const at120min = result[23].value;
        assert.ok(at30min < 80, `expected continued decline by 30min, got ${at30min}`);
        assert.ok(at120min < at30min - 5, `expected substantial further decline by 2hr, got ${at120min} vs ${at30min}`);
    });

    test('never predicts negative flow', () => {
        const points = makePoints(new Date('2026-01-01T00:00:00+13:00'), [1, 0.5, 0.2, 0.05, 0.01, 0.001]);
        const result = extrapolateFuturePoints(points);
        for (const p of result) {
            assert.ok(p.value >= 0, `expected non-negative, got ${p.value}`);
        }
    });

    test('holds flat when fewer than 2 positive values remain in the recent window', () => {
        // Only one positive value (3) survives the p.value > 0 filter here, which is too few
        // to fit a trend - this should trigger the flat-hold fallback at the last point's value.
        const points = makePoints(new Date('2026-01-01T00:00:00+13:00'), [0, 0, 0, 0, 0, 3]);
        const result = extrapolateFuturePoints(points);
        for (const p of result) {
            assert.equal(p.value, 3);
        }
    });

    test('every point is flagged isExtrapolated', () => {
        const points = makePoints(new Date('2026-01-01T00:00:00+13:00'), [10, 11, 12, 13, 14, 15]);
        const result = extrapolateFuturePoints(points);
        assert.ok(result.every(p => p.isExtrapolated === true));
    });

    test('regression: a single spurious spike at the very last point does not hijack the forecast', () => {
        // This is the exact bug reported: a lone anomalous reading right at the end (e.g. a
        // sensor glitch) previously became the extrapolation's starting point AND skewed the
        // fitted trend, sending the forecast wildly upward even though the true flow is flat.
        const points = makePoints(new Date('2026-01-01T00:00:00+13:00'), [59.8, 60.1, 59.9, 60.0, 60.2, 78.5]);
        const result = extrapolateFuturePoints(points);
        assert.ok(result[23].value < 65, `expected the spike to be smoothed out, got ${result[23].value} at +2hr`);
    });

    test('regression: noise scattered across a wider window does not derail the forecast', () => {
        const points = makePoints(new Date('2026-01-01T00:00:00+13:00'),
            [59.5, 60.8, 59.2, 60.1, 59.9, 61.5, 59.7, 60.0, 78.5, 59.8, 60.2, 59.9]);
        const result = extrapolateFuturePoints(points);
        assert.ok(Math.abs(result[23].value - 60) < 3, `expected to stay near 60, got ${result[23].value} at +2hr`);
    });

    test('a genuine sustained rise within a wider window is still detected, not washed out by earlier flat readings', () => {
        const points = makePoints(new Date('2026-01-01T00:00:00+13:00'),
            [58.0, 58.1, 58.0, 58.2, 58.1, 58.3, 59.0, 60.2, 61.5, 63.0, 64.8, 66.5]);
        const result = extrapolateFuturePoints(points);
        assert.ok(result[23].value > 70, `expected continued meaningful rise, got ${result[23].value} at +2hr`);
    });

    test('uses up to the full widened trend window when enough real points are available', () => {
        const values = Array.from({ length: 20 }, (_, i) => 50 + i);
        const points = makePoints(new Date('2026-01-01T00:00:00+13:00'), values);
        const result = extrapolateFuturePoints(points);
        // A steadily rising sequence of +1 per interval should extrapolate as a continued rise.
        assert.ok(result[0].value > values[values.length - 1]);
    });
});

describe('trailingMedianSmooth', () => {
    test('removes an isolated spike at the very end, using only preceding values', () => {
        assert.deepEqual(trailingMedianSmooth([5, 5, 5, 100, 5]), [5, 5, 5, 5, 5]);
    });

    test('removes an isolated dip in the middle', () => {
        assert.deepEqual(trailingMedianSmooth([10, 10, 1, 10, 10]), [10, 10, 10, 10, 10]);
    });

    test('preserves a genuine, sustained step change', () => {
        const result = trailingMedianSmooth([10, 10, 20, 20, 20]);
        assert.equal(result[result.length - 1], 20);
    });

    test('leaves the first value unchanged (no preceding values to smooth with)', () => {
        const result = trailingMedianSmooth([42, 1, 1]);
        assert.equal(result[0], 42);
    });

    test('handles arrays shorter than the smoothing window', () => {
        assert.deepEqual(trailingMedianSmooth([7]), [7]);
        assert.deepEqual(trailingMedianSmooth([7, 9]), [7, 9]);
    });
});

describe('resolveComparisonPoint', () => {
    const points = makePoints(new Date('2026-01-01T00:00:00+13:00'), [10, 20, 30]);
    const lastTime = points[points.length - 1].time;

    test('uses real data when the target time is within the real range', () => {
        const result = resolveComparisonPoint(points, points[1].time, []);
        assert.equal(result.isExtrapolated, false);
        assert.equal(result.point.value, 20);
    });

    test('uses real data exactly at the last real timestamp', () => {
        const result = resolveComparisonPoint(points, lastTime, []);
        assert.equal(result.isExtrapolated, false);
        assert.equal(result.point.value, 30);
    });

    test('falls back to the last real point when target is beyond it and nothing was extrapolated', () => {
        const future = new Date(lastTime.getTime() + 60 * 60 * 1000);
        const result = resolveComparisonPoint(points, future, []);
        assert.equal(result.isExtrapolated, true);
        assert.equal(result.point.value, 30);
    });

    test('uses the extrapolated curve when target time is beyond the real data', () => {
        const extrapolated = extrapolateFuturePoints(points);
        const target = new Date(lastTime.getTime() + 30 * 60 * 1000);
        const result = resolveComparisonPoint(points, target, extrapolated);
        assert.equal(result.isExtrapolated, true);
        assert.equal(result.point.time.getTime(), target.getTime());
    });

    test('caps at the furthest extrapolated point for a target beyond the 2-hour horizon', () => {
        const extrapolated = extrapolateFuturePoints(points);
        const farFuture = new Date(lastTime.getTime() + 5 * 60 * 60 * 1000);
        const capped = new Date(lastTime.getTime() + 3 * 60 * 60 * 1000);
        const resultFar = resolveComparisonPoint(points, farFuture, extrapolated);
        const resultCapped = resolveComparisonPoint(points, capped, extrapolated);
        assert.equal(resultFar.point.time.getTime(), resultCapped.point.time.getTime());
        assert.equal(resultFar.point.time.getTime(), extrapolated[extrapolated.length - 1].time.getTime());
    });
});

describe('computeLagShift', () => {
    test('upstream adds the shift (positive)', () => {
        const result = computeLagShift({ velocity: 2, distance: 1800, direction: 'Upstream' });
        assert.equal(result.minutes, 15);
        assert.equal(result.shiftMs, 15 * 60 * 1000);
    });

    test('downstream subtracts the shift (negative)', () => {
        const result = computeLagShift({ velocity: 2, distance: 1800, direction: 'Downstream' });
        assert.equal(result.minutes, 15);
        assert.equal(result.shiftMs, -15 * 60 * 1000);
    });

    test('rounds to the nearest minute', () => {
        const result = computeLagShift({ velocity: 1, distance: 100, direction: 'Upstream' });
        assert.equal(result.minutes, Math.round(100 / 1 / 60));
    });

    test('rejects invalid inputs', () => {
        assert.equal(computeLagShift({ velocity: 0, distance: 100, direction: 'Upstream' }), null);
        assert.equal(computeLagShift({ velocity: -1, distance: 100, direction: 'Upstream' }), null);
        assert.equal(computeLagShift({ velocity: 2, distance: -1, direction: 'Upstream' }), null);
        assert.equal(computeLagShift({ velocity: NaN, distance: 100, direction: 'Upstream' }), null);
        assert.equal(computeLagShift({ velocity: 2, distance: 100, direction: null }), null);
    });

    test('accepts zero distance (gauging at the recorder itself)', () => {
        const result = computeLagShift({ velocity: 2, distance: 0, direction: 'Upstream' });
        assert.equal(result.minutes, 0);
        assert.equal(result.shiftMs, 0);
    });
});