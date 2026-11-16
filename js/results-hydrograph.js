import { nzUtcOffset, todayIsoNz } from './form-utils.js';
import { fetchDischargeTimeSeries } from './api.js';
import { parseTimeSeriesResponse, renderHydrograph } from './hydrograph.js';
import { extrapolateFuturePoints } from './flow-math.js';
import { buildComparisonRows, renderFlowComparisonSummary } from './flow-comparison.js';

const COMPARISON_HEADING = 'Mean Q compared to rated flow';

export function createResultsHydrograph({ dateInput, startInput, endInput, meanQInput, statusEl, wrapEl, hydrographEl, diffsEl }) {
    let timeSeries = [];
    let nowTime = null;

    function showStatus(message) {
        statusEl.textContent = message;
        statusEl.style.display = message ? '' : 'none';
    }

    function getWindow() {
        if (!startInput.value || !endInput.value) return null;
        const date = dateInput.value || todayIsoNz();
        const offset = nzUtcOffset();
        const start = new Date(`${date}T${startInput.value}:00${offset}`);
        const end = new Date(`${date}T${endInput.value}:00${offset}`);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;
        return { start, end, isAdjusted: false };
    }

    function update() {
        if (!timeSeries.length) return;

        const windowRange = getWindow();
        const extrapolatedPoints = extrapolateFuturePoints(timeSeries);
        renderHydrograph(hydrographEl, timeSeries, windowRange, nowTime, extrapolatedPoints, null, parseFloat(meanQInput.value));

        if (!windowRange || !meanQInput.value) {
            diffsEl.style.display = 'none';
            return;
        }

        const rows = buildComparisonRows({
            timeSeries,
            extrapolatedPoints,
            windowRange,
            gaugedFlow: meanQInput.value
        });

        renderFlowComparisonSummary(diffsEl, rows, COMPARISON_HEADING);
    }

    async function fetchFor(siteCode, datasetId) {
        showStatus('Loading hydrograph for this site...');
        wrapEl.style.display = 'none';
        diffsEl.style.display = 'none';
        timeSeries = [];

        try {
            const raw = await fetchDischargeTimeSeries({ datasetId, siteCode, date: todayIsoNz() });
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
            nowTime = parsed.nowTime;
            showStatus('');
            wrapEl.style.display = '';
            update();
        } catch (error) {
            console.error('Failed to load time series:', error);
            showStatus("Couldn't load hydrograph for this site. Check your connection and try again.");
        }
    }

    function reset() {
        timeSeries = [];
        nowTime = null;
        wrapEl.style.display = 'none';
        diffsEl.style.display = 'none';
        showStatus('');
    }

    function appendToReport(report, meanQValue) {
        if (!timeSeries.length) return;

        const windowRange = getWindow();
        const extrapolatedPoints = extrapolateFuturePoints(timeSeries);

        const hydrographWrap = document.createElement('div');
        hydrographWrap.className = 'gq-report-hydrograph-wrap';
        renderHydrograph(hydrographWrap, timeSeries, windowRange, nowTime, extrapolatedPoints, null, parseFloat(meanQValue));
        report.appendChild(hydrographWrap);

        if (windowRange && meanQValue) {
            const rows = buildComparisonRows({
                timeSeries,
                extrapolatedPoints,
                windowRange,
                gaugedFlow: meanQValue
            });
            const comparisonWrap = document.createElement('div');
            comparisonWrap.className = 'gq-report-comparison-wrap';
            renderFlowComparisonSummary(comparisonWrap, rows, COMPARISON_HEADING);
            report.appendChild(comparisonWrap);
        }
    }

    startInput.addEventListener('input', update);
    endInput.addEventListener('input', update);
    meanQInput.addEventListener('input', update);

    return { fetchFor, update, reset, appendToReport };
}
