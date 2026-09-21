import { fetchDischargeTimeSeries } from './api.js';
import { nzUtcOffset, todayIsoNz, saveDraft, loadDraft, debounce, roundToNearestFiveMinutes, subtractMinutesFromTimeString } from './form-utils.js';
import { setupSiteAutocomplete } from './site-lookup.js';
import { parseTimeSeriesResponse, renderHydrograph } from './hydrograph.js';
import { extrapolateFuturePoints, computeLagShift } from './flow-math.js';
import { buildComparisonRows, renderFlowComparisonSummary } from './flow-comparison.js';

const siteInput = document.getElementById('gauging-tool-site');
const siteListEl = document.getElementById('gauging-tool-site-list');
const startInput = document.getElementById('gauging-tool-start');
const startNudgeButton = document.getElementById('gauging-tool-start-nudge');
const endInput = document.getElementById('gauging-tool-end');
const lagToggle = document.getElementById('gauging-tool-lag-toggle');
const lagContent = document.getElementById('gauging-tool-lag-content');
const lagVelocityInput = document.getElementById('gauging-tool-lag-velocity');
const lagDistanceInput = document.getElementById('gauging-tool-lag-distance');
const lagResultEl = document.getElementById('gauging-tool-lag-result');
const gaugedFlowInput = document.getElementById('gauging-tool-gauged-flow');
const refreshButton = document.getElementById('gauging-tool-refresh');
const nextSiteButton = document.getElementById('gauging-tool-next-site');
const statusEl = document.getElementById('gauging-tool-status');
const sparklineWrap = document.getElementById('gauging-tool-sparkline-wrap');
const sparklineEl = document.getElementById('gauging-tool-sparkline');
const flowDiffsWrap = document.getElementById('gauging-tool-flow-diffs');

let timeSeries = [];
let selectedSite = null;
let latestNowTime = null;

const DRAFT_KEY = 'gauging-tool';

function siteLagKey(siteCode) {
    return `gauging-tool-lag:${siteCode}`;
}

function currentLagDirection() {
    return document.querySelector('input[name="gauging-tool-lag-direction"]:checked')?.value || '';
}

function setLagDirection(direction) {
    document.querySelectorAll('input[name="gauging-tool-lag-direction"]').forEach(radio => {
        radio.checked = radio.value === direction;
    });
}

function saveLagForSite(siteCode) {
    if (!siteCode) return;
    saveDraft(siteLagKey(siteCode), {
        velocity: lagVelocityInput.value,
        distance: lagDistanceInput.value,
        direction: currentLagDirection()
    });
}

function applySavedLagForSite(siteCode) {
    const saved = loadDraft(siteLagKey(siteCode));
    if (!saved) return false;
    lagVelocityInput.value = saved.velocity || '';
    lagDistanceInput.value = saved.distance || '';
    setLagDirection(saved.direction || '');
    lagToggle.checked = true;
    return true;
}

function roundedNowTime() {
    const parts = new Intl.DateTimeFormat('en-NZ', {
        timeZone: 'Pacific/Auckland',
        hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date());
    const partMap = {};
    parts.forEach(p => { partMap[p.type] = p.value; });
    return roundToNearestFiveMinutes(parseInt(partMap.hour, 10), parseInt(partMap.minute, 10));
}

function collectState() {
    return {
        site: selectedSite,
        start: startInput.value,
        end: endInput.value,
        lagOn: lagToggle.checked,
        lagVelocity: lagVelocityInput.value,
        lagDistance: lagDistanceInput.value,
        lagDirection: currentLagDirection(),
        gaugedFlow: gaugedFlowInput.value
    };
}

const saveDraftDebounced = debounce(() => saveDraft(DRAFT_KEY, collectState()), 400);

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

function updateComparison() {
    if (!timeSeries.length) return;

    const windowRange = getWindow();
    const extrapolatedPoints = extrapolateFuturePoints(timeSeries);
    renderHydrograph(sparklineEl, timeSeries, windowRange, latestNowTime, extrapolatedPoints, null, parseFloat(gaugedFlowInput.value));

    if (!windowRange || !gaugedFlowInput.value) {
        flowDiffsWrap.style.display = 'none';
        return;
    }

    const rows = buildComparisonRows({
        timeSeries,
        extrapolatedPoints,
        windowRange,
        gaugedFlow: gaugedFlowInput.value
    });

    renderFlowComparisonSummary(flowDiffsWrap, rows, 'Gauged flow compared to rated flow');
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

function selectSite(site, { loadSavedLag = true } = {}) {
    if (loadSavedLag) {
        const loaded = applySavedLagForSite(site.code);
        syncLagVisibility();
        updateLagResult();
        if (loaded) updateComparison();
    }
    fetchAndRender(site);
}

setupSiteAutocomplete({
    inputEl: siteInput,
    listEl: siteListEl,
    onSelect: site => {
        selectSite(site);
        saveDraftDebounced();
    }
});

refreshButton.addEventListener('click', () => {
    if (!selectedSite) return;
    fetchAndRender(selectedSite);
});

startInput.addEventListener('input', () => {
    updateComparison();
    saveDraftDebounced();
});
endInput.addEventListener('input', () => {
    updateComparison();
    saveDraftDebounced();
});
gaugedFlowInput.addEventListener('input', () => {
    updateComparison();
    saveDraftDebounced();
});

startNudgeButton.addEventListener('click', () => {
    const base = startInput.value || roundedNowTime();
    startInput.value = subtractMinutesFromTimeString(base, 5);
    updateComparison();
    saveDraftDebounced();
});

function syncLagVisibility() {
    lagContent.classList.toggle('is-hidden', !lagToggle.checked);
}

lagToggle.addEventListener('change', () => {
    syncLagVisibility();
    updateLagResult();
    updateComparison();
    saveDraftDebounced();
});

lagVelocityInput.addEventListener('input', () => {
    updateLagResult();
    updateComparison();
    saveLagForSite(selectedSite?.code);
    saveDraftDebounced();
});

lagDistanceInput.addEventListener('input', () => {
    updateLagResult();
    updateComparison();
    saveLagForSite(selectedSite?.code);
    saveDraftDebounced();
});

document.querySelectorAll('input[name="gauging-tool-lag-direction"]').forEach(radio => {
    radio.addEventListener('change', () => {
        updateLagResult();
        updateComparison();
        saveLagForSite(selectedSite?.code);
        saveDraftDebounced();
    });
});

nextSiteButton.addEventListener('click', () => {
    if (!confirm('Clear this form? This clears the site, times and gauged flow.')) return;

    selectedSite = null;
    siteInput.value = '';
    startInput.value = roundedNowTime();
    endInput.value = '';
    gaugedFlowInput.value = '';
    lagToggle.checked = false;
    lagVelocityInput.value = '';
    lagDistanceInput.value = '';
    setLagDirection('');
    syncLagVisibility();
    updateLagResult();

    timeSeries = [];
    latestNowTime = null;
    sparklineWrap.style.display = 'none';
    flowDiffsWrap.style.display = 'none';
    showStatus('');

    saveDraft(DRAFT_KEY, collectState());
    siteInput.focus();
});

function init() {
    const draft = loadDraft(DRAFT_KEY);

    if (draft) {
        startInput.value = draft.start || '';
        endInput.value = draft.end || '';
        lagToggle.checked = !!draft.lagOn;
        lagVelocityInput.value = draft.lagVelocity || '';
        lagDistanceInput.value = draft.lagDistance || '';
        setLagDirection(draft.lagDirection || '');
        gaugedFlowInput.value = draft.gaugedFlow || '';
        syncLagVisibility();
        updateLagResult();

        if (draft.site) {
            siteInput.value = draft.site.name;
            selectSite(draft.site, { loadSavedLag: false });
        }
    } else {
        startInput.value = roundedNowTime();
        syncLagVisibility();
        updateLagResult();
    }
}

init();