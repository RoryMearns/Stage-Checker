import { formatNzTime, parseApiTimeAsNzLocal } from './form-utils.js';

export function formatFlowValue(value) {
    if (value < 10.0) return value.toFixed(3);
    if (value < 100.0) return value.toFixed(2);
    if (value < 1000.0) return value.toFixed(1);
    return value.toFixed(0);
}

export function parseTimeSeriesResponse(raw) {
    const rawPoints = raw?.Series?.[0]?.Data;

    if (!Array.isArray(rawPoints)) {
        console.error('Unexpected Dataset_Chart response shape - raw response:', raw);
        return null;
    }

    const points = rawPoints
        .map(p => ({
            time: parseApiTimeAsNzLocal(p.Time),
            value: parseFloat(p.Value)
        }))
        .filter(p => p.time !== null && !isNaN(p.value))
        .sort((a, b) => a.time - b.time);

    const nowTime = parseApiTimeAsNzLocal(raw?.NowTime);

    return { points, nowTime };
}

export function renderHydrograph(el, points, windowRange = null, nowTime = null, extrapolatedPoints = [], methodThresholds = null, gaugedFlow = null) {
    if (!points.length) {
        el.innerHTML = '<p class="calc-help">No data points to show.</p>';
        return;
    }

    const width = 600;
    const height = 100;
    const padTop = 10;
    const padBottom = 4;
    const padRight = 3;
    const hasMethodIcons = methodThresholds?.icons
        && typeof methodThresholds.ftUpperLimit === 'number'
        && typeof methodThresholds.sxsUpperLimit === 'number';
    const padLeft = hasMethodIcons ? 34 : 3;
    const hasGaugedFlow = windowRange && typeof gaugedFlow === 'number' && !isNaN(gaugedFlow);

    const scalePoints = points.concat(extrapolatedPoints);
    const times = scalePoints.map(p => p.time.getTime());
    const values = scalePoints.map(p => p.value);
    let minTime = Math.min(...times);
    let maxTime = Math.max(...times);
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);

    if (hasGaugedFlow) {
        minVal = Math.min(minVal, gaugedFlow);
        maxVal = Math.max(maxVal, gaugedFlow);
    }
    const valRange = maxVal - minVal || 1;

    if (windowRange) {
        minTime = Math.min(minTime, windowRange.start.getTime());
        maxTime = Math.max(maxTime, windowRange.end.getTime());
    }
    const timeRange = maxTime - minTime || 1;

    const x = t => padLeft + ((t - minTime) / timeRange) * (width - padLeft - padRight);
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

    const clampX = px => Math.min(Math.max(px, padLeft), width - padRight);
    const windowBand = windowRange
        ? `<rect x="${clampX(x(windowRange.start.getTime())).toFixed(1)}" y="0" width="${(clampX(x(windowRange.end.getTime())) - clampX(x(windowRange.start.getTime()))).toFixed(1)}" height="${height}" fill="var(--river-mid)" opacity="0.12" />`
        : '';

    let methodLineMarkers = [];
    const methodIconMarkers = [];
    if (hasMethodIcons) {
        const ft = methodThresholds.ftUpperLimit;
        const sxs = methodThresholds.sxsUpperLimit;
        const icons = methodThresholds.icons;

        const ftShown = ft > minVal && ft < maxVal;
        const sxsShown = sxs > minVal && sxs < maxVal;

        const NEAR_EDGE_PCT = 0.22;

        function addIcon(iconKey, yPx, side) {
            const topPct = ((yPx / height) * 100).toFixed(2);
            const offsetClass = side === 'above' ? 'is-above' : 'is-below';
            const label = methodThresholds.iconLabels?.[iconKey] || iconKey;
            methodIconMarkers.push(`<img src="${icons[iconKey]}" alt="${label}" title="${label}" class="sparkline-method-icon ${offsetClass}" style="top: ${topPct}%;">`);
        }

        function addLine(yPx) {
            const topPct = ((yPx / height) * 100).toFixed(2);
            methodLineMarkers.push(`<div class="sparkline-method-line" style="top: ${topPct}%;"></div>`);
        }

        if (ftShown) {
            const ftY = y(ft);
            addLine(ftY);
            const pct = ftY / height;
            if (pct <= 1 - NEAR_EDGE_PCT) addIcon('flowtracker', ftY, 'below');
            if (pct >= NEAR_EDGE_PCT && !sxsShown) addIcon('microboard', ftY, 'above');
        }

        if (sxsShown) {
            const sxsY = y(sxs);
            addLine(sxsY);
            const pct = sxsY / height;
            if (pct <= 1 - NEAR_EDGE_PCT) addIcon('microboard', sxsY, 'below');
            if (pct >= NEAR_EDGE_PCT) addIcon('moving-boat', sxsY, 'above');
        }
    }

    let gaugedFlowLineHtml = '';
    let gaugedFlowMarkerHtml = '';
    if (hasGaugedFlow) {
        const gaugedY = y(gaugedFlow);
        const startX = clampX(x(windowRange.start.getTime()));
        const endX = clampX(x(windowRange.end.getTime()));

        gaugedFlowLineHtml = `<line x1="${startX.toFixed(1)}" y1="${gaugedY.toFixed(1)}" x2="${endX.toFixed(1)}" y2="${gaugedY.toFixed(1)}" stroke="var(--river-deep)" stroke-width="1.75" vector-effect="non-scaling-stroke" />`;

        const anchorTime = windowRange.start.getTime();
        let closestPoint = scalePoints[0];
        let closestDiff = Math.abs(scalePoints[0].time.getTime() - anchorTime);
        for (const p of scalePoints) {
            const diff = Math.abs(p.time.getTime() - anchorTime);
            if (diff < closestDiff) {
                closestPoint = p;
                closestDiff = diff;
            }
        }
        const curveValueAtAnchor = closestPoint.value;

        const topPct = ((gaugedY / height) * 100).toFixed(2);
        const leftPct = ((startX / width) * 100).toFixed(2);
        const side = gaugedFlow < curveValueAtAnchor ? 'is-below' : 'is-above';
        gaugedFlowMarkerHtml = `
            <div class="sparkline-gauged-dot" style="left: ${leftPct}%; top: ${topPct}%;"></div>
            <div class="sparkline-gauged-label ${side}" style="left: ${leftPct}%; top: ${topPct}%;">Gauged ${formatFlowValue(gaugedFlow)}</div>
        `;
    }

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

    el.innerHTML = `
        <p class="sparkline-caption">${captionText}</p>
        <div class="sparkline-stats">
            <div class="sparkline-stat">
                <span class="sparkline-stat-label">Peak flow</span>
                <span class="sparkline-stat-line">
                    <span class="sparkline-stat-value">${formatFlowValue(peak.value)}<small> m&sup3;/s</small></span>
                    <span class="sparkline-stat-time">${formatNzTime(peak.time)}</span>
                </span>
            </div>
            <div class="sparkline-stat">
                <span class="sparkline-stat-label">Low flow</span>
                <span class="sparkline-stat-line">
                    <span class="sparkline-stat-value">${formatFlowValue(low.value)}<small> m&sup3;/s</small></span>
                    <span class="sparkline-stat-time">${formatNzTime(low.time)}</span>
                </span>
            </div>
            <div class="sparkline-stat">
                <span class="sparkline-stat-label">Latest flow</span>
                <span class="sparkline-stat-line">
                    <span class="sparkline-stat-value">${formatFlowValue(lastPoint.value)}<small> m&sup3;/s</small></span>
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
                <path d="${linePath}" fill="none" stroke="var(--river-mid)" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
                ${extrapolatedPath ? `<path d="${extrapolatedPath}" fill="none" stroke="var(--river-deep)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="5,4" opacity="0.6" vector-effect="non-scaling-stroke" />` : ''}
                ${gaugedFlowLineHtml}
            </svg>
            <div class="sparkline-end-marker" style="left: ${endMarkerLeftPct}%; top: ${endMarkerTopPct}%;"></div>
            ${methodLineMarkers.join('')}
            ${methodIconMarkers.join('')}
            ${gaugedFlowMarkerHtml}
        </div>
        ${legendHtml}
    `;
}