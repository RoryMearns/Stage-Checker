export const EXTRAPOLATION_INTERVAL_MS = 5 * 60 * 1000;
export const EXTRAPOLATION_MAX_MS = 2 * 60 * 60 * 1000;
export const EXTRAPOLATION_DAMPING = 0.98;
export const EXTRAPOLATION_TREND_POINTS = 6;

export function extrapolateFuturePoints(points) {
    if (points.length < 2) return [];

    const lastPoint = points[points.length - 1];
    const recentCount = Math.min(EXTRAPOLATION_TREND_POINTS, points.length);
    const recent = points.slice(-recentCount).filter(p => p.value > 0);

    const steps = Math.floor(EXTRAPOLATION_MAX_MS / EXTRAPOLATION_INTERVAL_MS);
    const extrapolated = [];

    if (recent.length < 2 || lastPoint.value <= 0) {
        for (let i = 1; i <= steps; i++) {
            extrapolated.push({
                time: new Date(lastPoint.time.getTime() + i * EXTRAPOLATION_INTERVAL_MS),
                value: lastPoint.value,
                isExtrapolated: true
            });
        }
        return extrapolated;
    }

    const n = recent.length;
    const xMean = (n - 1) / 2;
    const logValues = recent.map(p => Math.log(p.value));
    const yMean = logValues.reduce((sum, v) => sum + v, 0) / n;
    let num = 0;
    let den = 0;
    recent.forEach((p, i) => {
        num += (i - xMean) * (logValues[i] - yMean);
        den += (i - xMean) ** 2;
    });
    const logSlopePerInterval = den !== 0 ? num / den : 0;

    let cumulativeLogChange = 0;
    let slope = logSlopePerInterval;

    for (let i = 1; i <= steps; i++) {
        cumulativeLogChange += slope;
        slope *= EXTRAPOLATION_DAMPING;
        const value = Math.max(0, lastPoint.value * Math.exp(cumulativeLogChange));
        extrapolated.push({
            time: new Date(lastPoint.time.getTime() + i * EXTRAPOLATION_INTERVAL_MS),
            value,
            isExtrapolated: true
        });
    }

    return extrapolated;
}

export function nearestPoint(points, targetTime) {
    if (!points.length) return null;
    let closest = points[0];
    let closestDiff = Math.abs(points[0].time - targetTime);
    for (const p of points) {
        const diff = Math.abs(p.time - targetTime);
        if (diff < closestDiff) {
            closest = p;
            closestDiff = diff;
        }
    }
    return closest;
}

export function resolveComparisonPoint(points, targetTime, extrapolatedPoints) {
    const lastPoint = points[points.length - 1];
    if (targetTime <= lastPoint.time) {
        return { point: nearestPoint(points, targetTime), isExtrapolated: false };
    }
    if (!extrapolatedPoints.length) {
        return { point: lastPoint, isExtrapolated: true };
    }
    return { point: nearestPoint(extrapolatedPoints, targetTime), isExtrapolated: true };
}

export function computeLagShift({ velocity, distance, direction }) {
    if (isNaN(velocity) || velocity <= 0 || isNaN(distance) || distance < 0 || !direction) return null;
    const minutes = Math.round((distance / velocity) / 60);
    const signedMinutes = direction === 'Upstream' ? minutes : -minutes;
    return { minutes, direction, shiftMs: signedMinutes * 60 * 1000 };
}