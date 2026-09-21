import { computeFlowDifferencePercent, formatNzTime } from './form-utils.js';
import { resolveComparisonPoint } from './flow-math.js';

const ARROW_UP = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="6 11 12 5 18 11"></polyline></svg>';
const ARROW_DOWN = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="6 13 12 19 18 13"></polyline></svg>';

export function buildComparisonRows({ timeSeries, extrapolatedPoints, windowRange, gaugedFlow }) {
    const midTime = new Date(windowRange.start.getTime() + (windowRange.end.getTime() - windowRange.start.getTime()) / 2);

    const startResolved = resolveComparisonPoint(timeSeries, windowRange.start, extrapolatedPoints);
    const midResolved = resolveComparisonPoint(timeSeries, midTime, extrapolatedPoints);
    const endResolved = resolveComparisonPoint(timeSeries, windowRange.end, extrapolatedPoints);

    const labelPrefix = windowRange.isAdjusted ? 'Adjusted ' : '';
    const gaugedNum = parseFloat(gaugedFlow);

    return [
        { resolved: startResolved, targetTime: windowRange.start, label: `${labelPrefix}start` },
        { resolved: midResolved, targetTime: midTime, label: `${labelPrefix}middle` },
        { resolved: endResolved, targetTime: windowRange.end, label: `${labelPrefix}end` }
    ].map(row => {
        const ratedValue = row.resolved.point.value;
        const pct = computeFlowDifferencePercent(ratedValue, gaugedFlow);
        const direction = isNaN(gaugedNum) ? null : (gaugedNum > ratedValue ? 'up' : (gaugedNum < ratedValue ? 'down' : null));
        const suffix = row.resolved.isExtrapolated ? ' (extrapolated)' : '';
        const capitalizedLabel = row.label.charAt(0).toUpperCase() + row.label.slice(1);
        const fullLabel = `${capitalizedLabel} &middot; ${formatNzTime(row.targetTime)}${suffix}`;
        return { label: fullLabel, pct, isGood: pct !== null && pct <= 8.0, direction };
    });
}

export function renderFlowComparisonSummary(el, rows, titleText = 'Gauged flow compared to rated flow') {
    const rowsHtml = rows
        .filter(row => row.pct !== null)
        .map(row => {
            const stateClass = row.isGood ? 'is-good' : 'is-warning';
            const arrow = row.direction === 'up' ? ARROW_UP : (row.direction === 'down' ? ARROW_DOWN : '');
            return `
                <div class="flow-diff-summary-row ${stateClass}">
                    <span class="flow-diff-summary-left">
                        <span class="flow-diff-summary-dot"></span>
                        <span class="flow-diff-summary-label">${row.label}</span>
                    </span>
                    <span class="flow-diff-summary-pct">${arrow}${row.pct.toFixed(1)}%</span>
                </div>
            `;
        })
        .join('');

    if (!rowsHtml) {
        el.style.display = 'none';
        return;
    }

    el.innerHTML = `
        <div class="flow-diff-summary">
            <p class="flow-diff-summary-title">${titleText}</p>
            ${rowsHtml}
        </div>
    `;
    el.style.display = '';
}