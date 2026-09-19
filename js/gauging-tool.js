import { fetchDischargeTimeSeries } from './api.js';
import { computeFlowDifferencePercent, nzUtcOffset, todayIsoNz, formatNzTime } from './form-utils.js';
import { setupSiteAutocomplete } from './site-lookup.js';
import { parseTimeSeriesResponse, renderHydrograph } from './hydrograph.js';
import { extrapolateFuturePoints, resolveComparisonPoint, computeLagShift } from './flow-math.js';

const siteInput = document.getElementById('gauging-tool-site');
const siteListEl = document.getElementById('gauging-tool-site-list');
const startInput = document.getElementById('gauging-tool-start');
const endInput = document.getElementById('gauging-tool-end');
const lagToggle = document.getElementById('gauging-tool-lag-toggle');
const lagContent = document.getElementById('gauging-tool-lag-content');
const lagVelocityInput = document.getElementById('gauging-tool-lag-velocity');
const lagDistanceInput = document.getElementById('gauging-tool-lag-distance');
const lagResultEl = document.getElementById('gauging-tool-lag-result');
const gaugedFlowInput = document.getElementById('gauging-tool-gauged-flow');
const refreshButton = document.getElementById('gauging-tool-refresh');
const statusEl = document.getElementById('gauging-tool-status');
const sparklineWrap = document.getElementById('gauging-tool-sparkline-wrap');
const sparklineEl = document.getElementById('gauging-tool-sparkline');
const flowDiffsWrap = document.getElementById('gauging-tool-flow-diffs');

let timeSeries = [];
let selectedSite = null;
let latestNowTime = null;

function showStatus(message) {
    statusEl.textContent = message;
    statusEl.style.display = message ? '' : 'none';
}

function computeLagAdjustment() {
    if (!lagToggle.checked) return null;
    const velocity = parseFloat(lagVelocityInput.value);
    const distance = parseFloat(lagDistanceInput.value);
    const direction = document.querySelector('input[name="gauging-tool-lag-direction"]:checked')?.value;
    return computeLagShift({ velocity, distance, direction });
}

function updateLagResult() {
    const lag = computeLagAdjustment();
    if (!lag) {
        lagResultEl.style.display = 'none';
        return;
    }
    const action = lag.direction === 'Upstream' ? 'added to' : 'subtracted from';
    lagResultEl.textContent = `Lag time: ${lag.minutes} minutes (${action} gauging times)`;
    lagResultEl.style.display = '';
}

function getWindow() {
    if (!startInput.value || !endInput.value) return null;
    const today = todayIsoNz();
    const offset = nzUtcOffset();
    let start = new Date(`${today}T${startInput.value}:00${offset}`);
    let end = new Date(`${today}T${endInput.value}:00${offset}`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;

    const lag = computeLagAdjustment();
    const isAdjusted = !!lag;
    if (lag) {
        start = new Date(start.getTime() + lag.shiftMs);
        end = new Date(end.getTime() + lag.shiftMs);
    }

    return { start, end, isAdjusted };
}

const ARROW_UP = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="6 11 12 5 18 11"></polyline></svg>';
const ARROW_DOWN = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="6 13 12 19 18 13"></polyline></svg>';

function renderFlowDiffSummary(rows) {
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
        flowDiffsWrap.style.display = 'none';
        return;
    }

    flowDiffsWrap.innerHTML = `
        <div class="flow-diff-summary">
            <p class="flow-diff-summary-title">Gauged flow compared to rated flow</p>
            ${rowsHtml}
        </div>
    `;
    flowDiffsWrap.style.display = '';
}

function updateComparison() {
    if (!timeSeries.length) return;

    const windowRange = getWindow();
    const extrapolatedPoints = extrapolateFuturePoints(timeSeries);
    renderHydrograph(sparklineEl, timeSeries, windowRange, latestNowTime, extrapolatedPoints, null, parseFloat(gaugedFlowInput.value));

    if (!windowRange || !gaugedFlowInput.value) {
        flowDiffsWrap.style.display = 'none';
        return;
    }

    const midTime = new Date(windowRange.start.getTime() + (windowRange.end.getTime() - windowRange.start.getTime()) / 2);

    const startResolved = resolveComparisonPoint(timeSeries, windowRange.start, extrapolatedPoints);
    const midResolved = resolveComparisonPoint(timeSeries, midTime, extrapolatedPoints);
    const endResolved = resolveComparisonPoint(timeSeries, windowRange.end, extrapolatedPoints);

    const labelPrefix = windowRange.isAdjusted ? 'Adjusted ' : '';
    const gauged = gaugedFlowInput.value;
    const gaugedNum = parseFloat(gauged);
    const rows = [
        { resolved: startResolved, targetTime: windowRange.start, label: `${labelPrefix}start` },
        { resolved: midResolved, targetTime: midTime, label: `${labelPrefix}middle` },
        { resolved: endResolved, targetTime: windowRange.end, label: `${labelPrefix}end` }
    ].map(row => {
        const ratedValue = row.resolved.point.value;
        const pct = computeFlowDifferencePercent(ratedValue, gauged);
        const direction = isNaN(gaugedNum) ? null : (gaugedNum > ratedValue ? 'up' : (gaugedNum < ratedValue ? 'down' : null));
        const suffix = row.resolved.isExtrapolated ? ' (extrapolated)' : '';
        const capitalizedLabel = row.label.charAt(0).toUpperCase() + row.label.slice(1);
        const fullLabel = `${capitalizedLabel} &middot; ${formatNzTime(row.targetTime)}${suffix}`;
        return { label: fullLabel, pct, isGood: pct !== null && pct <= 8.0, direction };
    });

    renderFlowDiffSummary(rows);
}

async function fetchAndRender(site) {
    selectedSite = site;
    showStatus('Loading data for this site...');
    sparklineWrap.style.display = 'none';
    flowDiffsWrap.style.display = 'none';
    timeSeries = [];

    try {
        const raw = await fetchDischargeTimeSeries({
            datasetId: site.datasetId,
            siteCode: site.code,
            date: todayIsoNz()
        });

        const parsed = parseTimeSeriesResponse(raw);
        if (parsed === null) {
            showStatus("Got a response, but it wasn't in the expected format - check the browser console for details.");
            return;
        }
        if (!parsed.points.length) {
            showStatus('No recent data available for this site.');
            return;
        }

        timeSeries = parsed.points;
        latestNowTime = parsed.nowTime;
        showStatus('');
        sparklineWrap.style.display = '';
        updateComparison();
    } catch (error) {
        console.error('Failed to load time series:', error);
        showStatus("Couldn't load data for this site. Check your connection and try again.");
    }
}

setupSiteAutocomplete({
    inputEl: siteInput,
    listEl: siteListEl,
    onSelect: fetchAndRender
});

refreshButton.addEventListener('click', () => {
    if (!selectedSite) return;
    fetchAndRender(selectedSite);
});

startInput.addEventListener('input', updateComparison);
endInput.addEventListener('input', updateComparison);
gaugedFlowInput.addEventListener('input', updateComparison);

function syncLagVisibility() {
    lagContent.classList.toggle('is-hidden', !lagToggle.checked);
}

lagToggle.addEventListener('change', () => {
    syncLagVisibility();
    updateLagResult();
    updateComparison();
});

lagVelocityInput.addEventListener('input', () => {
    updateLagResult();
    updateComparison();
});

lagDistanceInput.addEventListener('input', () => {
    updateLagResult();
    updateComparison();
});

document.querySelectorAll('input[name="gauging-tool-lag-direction"]').forEach(radio => {
    radio.addEventListener('change', () => {
        updateLagResult();
        updateComparison();
    });
});

syncLagVisibility();
updateLagResult();