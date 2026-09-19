import { fetchDischargeTimeSeries } from './api.js';
import { computeFlowDifferencePercent } from './form-utils.js';
import { setupSiteAutocomplete } from './site-lookup.js';

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

function nzUtcOffset() {
    const parts = new Intl.DateTimeFormat('en-NZ', {
        timeZone: 'Pacific/Auckland',
        timeZoneName: 'short'
    }).formatToParts(new Date());
    const tz = parts.find(p => p.type === 'timeZoneName')?.value;
    return tz === 'NZDT' ? '+13:00' : '+12:00';
}

function todayIso() {
    const parts = new Intl.DateTimeFormat('en-NZ', {
        timeZone: 'Pacific/Auckland',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const partMap = {};
    parts.forEach(p => { partMap[p.type] = p.value; });
    return `${partMap.year}-${partMap.month}-${partMap.day}`;
}

function formatNzTime(date) {
    const parts = new Intl.DateTimeFormat('en-NZ', {
        timeZone: 'Pacific/Auckland',
        hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(date);
    const partMap = {};
    parts.forEach(p => { partMap[p.type] = p.value; });
    let hours = parseInt(partMap.hour, 10);
    if (hours === 24) hours = 0;
    return `${String(hours).padStart(2, '0')}:${partMap.minute}`;
}

function showStatus(message) {
    statusEl.textContent = message;
    statusEl.style.display = message ? '' : 'none';
}

function parseApiTime(rawTimeString) {
    if (!rawTimeString) return null;
    const stripped = String(rawTimeString).replace(/Z$/, '');
    const date = new Date(`${stripped}${nzUtcOffset()}`);
    return isNaN(date.getTime()) ? null : date;
}

function parseTimeSeriesResponse(raw) {
    const rawPoints = raw?.Series?.[0]?.Data;

    if (!Array.isArray(rawPoints)) {
        console.error('Unexpected Dataset_Chart response shape - raw response:', raw);
        return null;
    }

    const points = rawPoints
        .map(p => ({
            time: parseApiTime(p.Time),
            value: parseFloat(p.Value)
        }))
        .filter(p => p.time !== null && !isNaN(p.value))
        .sort((a, b) => a.time - b.time);

    const nowTime = parseApiTime(raw?.NowTime);

    return { points, nowTime };
}

function computeLagAdjustment() {
    if (!lagToggle.checked) return null;
    const velocity = parseFloat(lagVelocityInput.value);
    const distance = parseFloat(lagDistanceInput.value);
    const direction = document.querySelector('input[name="gauging-tool-lag-direction"]:checked')?.value;
    if (isNaN(velocity) || velocity <= 0 || isNaN(distance) || distance < 0 || !direction) return null;

    const minutes = Math.round((distance / velocity) / 60);
    const signedMinutes = direction === 'Upstream' ? minutes : -minutes;
    return { minutes, direction, shiftMs: signedMinutes * 60 * 1000 };
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
    const today = todayIso();
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

const EXTRAPOLATION_INTERVAL_MS = 5 * 60 * 1000;
const EXTRAPOLATION_MAX_MS = 2 * 60 * 60 * 1000;
const EXTRAPOLATION_DAMPING = 0.98;
const EXTRAPOLATION_TREND_POINTS = 6;

function extrapolateFuturePoints(points) {
    if (points.length < 2) return [];

    const lastPoint = points[points.length - 1];
    const recentCount = Math.min(EXTRAPOLATION_TREND_POINTS, points.length);
    const recent = points.slice(-recentCount).filter(p => p.value > 0);

    const steps = Math.floor(EXTRAPOLATION_MAX_MS / EXTRAPOLATION_INTERVAL_MS);
    const extrapolated = [];

    if (recent.length < 2 || lastPoint.value <= 0) {
        // Not enough valid data to fit a trend - hold flat rather than guess.
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

function nearestPoint(points, targetTime) {
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

function resolveComparisonPoint(points, targetTime, extrapolatedPoints) {
    const lastPoint = points[points.length - 1];
    if (targetTime <= lastPoint.time) {
        return { point: nearestPoint(points, targetTime), isExtrapolated: false };
    }
    if (!extrapolatedPoints.length) {
        return { point: lastPoint, isExtrapolated: true };
    }
    return { point: nearestPoint(extrapolatedPoints, targetTime), isExtrapolated: true };
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

function renderSparkline(points, windowRange, nowTime, extrapolatedPoints = []) {
    if (!points.length) {
        sparklineEl.innerHTML = '<p class="calc-help">No data points to show.</p>';
        return;
    }

    const width = 600;
    const height = 100;
    const padTop = 10;
    const padBottom = 4;
    const padX = 3;

    const scalePoints = points.concat(extrapolatedPoints);
    const times = scalePoints.map(p => p.time.getTime());
    const values = scalePoints.map(p => p.value);
    let minTime = Math.min(...times);
    let maxTime = Math.max(...times);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const valRange = maxVal - minVal || 1;

    if (windowRange) {
        minTime = Math.min(minTime, windowRange.start.getTime());
        maxTime = Math.max(maxTime, windowRange.end.getTime());
    }
    const timeRange = maxTime - minTime || 1;

    const x = t => padX + ((t - minTime) / timeRange) * (width - padX * 2);
    const y = v => height - padBottom - ((v - minVal) / valRange) * (height - padTop - padBottom);

    function smoothPath(pts) {
        if (pts.length < 2) return '';
        let d = `M ${x(pts[0].time.getTime()).toFixed(1)} ${y(pts[0].value).toFixed(1)}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const x0 = x(pts[i].time.getTime());
            const y0 = y(pts[i].value);
            const x1 = x(pts[i + 1].time.getTime());
            const y1 = y(pts[i + 1].value);
            d += ` Q ${x0.toFixed(1)} ${y0.toFixed(1)} ${((x0 + x1) / 2).toFixed(1)} ${((y0 + y1) / 2).toFixed(1)}`;
        }
        const last = pts[pts.length - 1];
        d += ` L ${x(last.time.getTime()).toFixed(1)} ${y(last.value).toFixed(1)}`;
        return d;
    }

    const linePath = smoothPath(points);
    const firstX = x(points[0].time.getTime());
    const lastPoint = points[points.length - 1];
    const lastX = x(lastPoint.time.getTime());
    const lastY = y(lastPoint.value);
    const areaPath = `${linePath} L ${lastX.toFixed(1)} ${height} L ${firstX.toFixed(1)} ${height} Z`;

    const extrapolatedPath = extrapolatedPoints.length ? smoothPath([lastPoint, ...extrapolatedPoints]) : '';

    const clampX = px => Math.min(Math.max(px, padX), width - padX);
    const windowBand = windowRange
        ? `<rect x="${clampX(x(windowRange.start.getTime())).toFixed(1)}" y="0" width="${(clampX(x(windowRange.end.getTime())) - clampX(x(windowRange.start.getTime()))).toFixed(1)}" height="${height}" fill="var(--river-mid)" opacity="0.12" />`
        : '';

    let peak = points[0];
    let low = points[0];
    for (const p of points) {
        if (p.value > peak.value) peak = p;
        if (p.value < low.value) low = p;
    }

    const captionText = nowTime ? `Last 24 hours (as at ${formatNzTime(nowTime)})` : 'Last 24 hours';

    const endMarkerLeftPct = ((lastX / width) * 100).toFixed(2);
    const endMarkerTopPct = ((lastY / height) * 100).toFixed(2);

    const legendHtml = extrapolatedPoints.length ? `
        <div class="sparkline-legend">
            <span class="sparkline-legend-item"><span class="sparkline-legend-swatch is-measured"></span>Measured</span>
            <span class="sparkline-legend-item"><span class="sparkline-legend-swatch is-extrapolated"></span>Extrapolated</span>
        </div>
    ` : '';

    sparklineEl.innerHTML = `
        <p class="sparkline-caption">${captionText}</p>
        <div class="sparkline-stats">
            <div class="sparkline-stat">
                <span class="sparkline-stat-label">Peak flow</span>
                <span class="sparkline-stat-line">
                    <span class="sparkline-stat-value">${peak.value.toFixed(1)}<small> m&sup3;/s</small></span>
                    <span class="sparkline-stat-time">${formatNzTime(peak.time)}</span>
                </span>
            </div>
            <div class="sparkline-stat">
                <span class="sparkline-stat-label">Low flow</span>
                <span class="sparkline-stat-line">
                    <span class="sparkline-stat-value">${low.value.toFixed(1)}<small> m&sup3;/s</small></span>
                    <span class="sparkline-stat-time">${formatNzTime(low.time)}</span>
                </span>
            </div>
            <div class="sparkline-stat">
                <span class="sparkline-stat-label">Latest flow</span>
                <span class="sparkline-stat-line">
                    <span class="sparkline-stat-value">${lastPoint.value.toFixed(1)}<small> m&sup3;/s</small></span>
                    <span class="sparkline-stat-time">${formatNzTime(lastPoint.time)}</span>
                </span>
            </div>
        </div>
        <div class="sparkline-svg-wrap">
            <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="sparkline-svg">
                <defs>
                    <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="var(--river-mid)" stop-opacity="0.25" />
                        <stop offset="100%" stop-color="var(--river-mid)" stop-opacity="0" />
                    </linearGradient>
                </defs>
                ${windowBand}
                <path d="${areaPath}" fill="url(#sparkline-fill)" stroke="none" />
                <path d="${linePath}" fill="none" stroke="var(--river-mid)" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
                ${extrapolatedPath ? `<path d="${extrapolatedPath}" fill="none" stroke="var(--river-deep)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="5,4" opacity="0.6" />` : ''}
            </svg>
            <div class="sparkline-end-marker" style="left: ${endMarkerLeftPct}%; top: ${endMarkerTopPct}%;"></div>
        </div>
        ${legendHtml}
    `;
}

function updateComparison() {
    if (!timeSeries.length) return;

    const windowRange = getWindow();
    const extrapolatedPoints = extrapolateFuturePoints(timeSeries);
    renderSparkline(timeSeries, windowRange, latestNowTime, extrapolatedPoints);

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
            date: todayIso()
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