import { todayIsoDate, formatDateForDisplay, sanitizeForFilename, downloadElementAsPng, saveDraft, loadDraft, clearDraft, debounce, encodeStateToCode, decodeCodeToState, copyToClipboard } from './form-utils.js';

const DRAFT_KEY = 'site-visit';

const VALUE_UNITS = {
    'Staff gauge': '(m)',
    'EPB': '(m)',
    'Sensor': '(m)',
    'Temperature': '(&deg;C)',
    'Other': ''
};

const UNCERTAINTY_UNITS = {
    'Staff gauge': '(mm)',
    'EPB': '(mm)',
    'Sensor': '(mm)',
    'Temperature': '',
    'Other': ''
};

function currentNzTimeExact() {
    const parts = new Intl.DateTimeFormat('en-NZ', {
        timeZone: 'Pacific/Auckland',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(new Date());

    const partMap = {};
    parts.forEach(p => { partMap[p.type] = p.value; });

    let hours = parseInt(partMap.hour, 10);
    if (hours === 24) hours = 0;

    return `${String(hours).padStart(2, '0')}:${partMap.minute}`;
}

function nzTimeRoundedToFive() {
    const parts = new Intl.DateTimeFormat('en-NZ', {
        timeZone: 'Pacific/Auckland',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZoneName: 'short'
    }).formatToParts(new Date());

    const partMap = {};
    parts.forEach(p => { partMap[p.type] = p.value; });

    let hours = parseInt(partMap.hour, 10);
    let minutes = parseInt(partMap.minute, 10);
    if (hours === 24) hours = 0;

    if (partMap.timeZoneName === 'NZDT') {
        hours -= 1;
        if (hours < 0) hours += 24;
    }

    minutes = Math.round(minutes / 5) * 5;
    if (minutes === 60) {
        minutes = 0;
        hours = (hours + 1) % 24;
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function textValue(el) {
    const value = el.value.trim();
    return value || null;
}

function radioValue(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : null;
}

function setRadio(name, value) {
    if (!value) return;
    const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (input) input.checked = true;
}

function fieldRow(label, value) {
    return `<li><span class="gq-report-name">${label}:</span> <span class="gq-report-value">${value ?? '—'}</span></li>`;
}

function stripedRow(label, value, stripeIndex) {
    const stripeClass = stripeIndex % 2 === 0 ? 'gq-report-stripe-a' : 'gq-report-stripe-b';
    return `<li class="${stripeClass}"><span class="gq-report-name">${label}:</span> <span class="gq-report-value">${value ?? '—'}</span></li>`;
}

function divider() {
    return '<li class="gq-report-divider" aria-hidden="true"></li>';
}

function sectionHeading(text) {
    return `<li class="gq-report-section-heading">${text}</li>`;
}

const TYPE_ABBREVIATIONS = {
    'Staff gauge': 'SG'
};

const siteNameInput = document.getElementById('sv-site-name');
const dateInput = document.getElementById('sv-date');
const partyInput = document.getElementById('sv-party');
const siteNumberInput = document.getElementById('sv-site-number');
const weatherNotesInput = document.getElementById('sv-weather-notes');
const notesInput = document.getElementById('sv-notes');

const measurementsList = document.getElementById('sv-measurements-list');
const addMeasurementButton = document.getElementById('sv-add-measurement');
const measurementTemplate = document.getElementById('sv-measurement-template');

const raingaugeContent = document.getElementById('sv-raingauge-content');
const raingaugeToggle = document.getElementById('sv-raingauge-visited');
const checkGaugeInput = document.getElementById('sv-checkgauge-input');
const checkGaugeAddButton = document.getElementById('sv-checkgauge-add');
const checkGaugeListEl = document.getElementById('sv-checkgauge-list');
const checkGaugeTotalEl = document.getElementById('sv-checkgauge-total');
const manualTipsInput = document.getElementById('sv-manual-tips');
const tipsIncrementButton = document.getElementById('sv-tips-increment');
const tipsDecrementButton = document.getElementById('sv-tips-decrement');
const tipsAtInput = document.getElementById('sv-tips-at');
const raingaugeNotesInput = document.getElementById('sv-raingauge-notes');

const batteryContent = document.getElementById('sv-battery-content');
const batteryToggle = document.getElementById('sv-battery-changed');
const batteryNotesInput = document.getElementById('sv-battery-notes');

const clearButton = document.getElementById('sv-clear-button');
const shareButton = document.getElementById('sv-share');
const downloadButton = document.getElementById('sv-download');
const shareLinkEl = document.getElementById('sv-share-link');
const draftNotice = document.getElementById('draft-restored-notice');
const dismissDraftNoticeButton = document.getElementById('dismiss-draft-notice');

const form = siteNameInput.closest('.run-section');

let checkGaugeReadings = [];

function saveSiteVisitDraft() {
    saveDraft(DRAFT_KEY, collectSiteVisitState());
}

const debouncedSaveDraft = debounce(saveSiteVisitDraft, 400);

function updateValueLabel(row) {
    const type = row.querySelector('.measurement-type').value;
    const label = row.querySelector('.measurement-value-label');
    const unit = VALUE_UNITS[type] || '';
    label.innerHTML = unit ? `Value ${unit}` : 'Value';
}

function updateUncertaintyLabel(row) {
    const type = row.querySelector('.measurement-type').value;
    const label = row.querySelector('.measurement-uncertainty-label');
    const unit = UNCERTAINTY_UNITS[type] || '';
    label.innerHTML = unit ? `Uncertainty ${unit}` : 'Uncertainty';
}

function addMeasurementRow(data = null) {
    const fragment = measurementTemplate.content.cloneNode(true);
    const row = fragment.querySelector('.measurement-row');

    const typeSelect = row.querySelector('.measurement-type');
    const timeInput = row.querySelector('.measurement-time');
    const valueInput = row.querySelector('.measurement-value');
    const uncertaintyInput = row.querySelector('.measurement-uncertainty');
    const otherInput = row.querySelector('.measurement-other');
    const removeButton = row.querySelector('.measurement-remove');

    if (data) {
        typeSelect.value = data.type || 'Staff gauge';
        timeInput.value = data.time || '';
        valueInput.value = data.value ?? '';
        uncertaintyInput.value = data.uncertainty ?? '0';
        otherInput.value = data.other || '';
    } else {
        timeInput.value = nzTimeRoundedToFive();
    }

    updateValueLabel(row);
    updateUncertaintyLabel(row);
    typeSelect.addEventListener('change', () => {
        updateValueLabel(row);
        updateUncertaintyLabel(row);
        debouncedSaveDraft();
    });

    removeButton.addEventListener('click', () => {
        row.remove();
        debouncedSaveDraft();
    });

    measurementsList.appendChild(row);
    return row;
}

function collectMeasurements() {
    return Array.from(measurementsList.querySelectorAll('.measurement-row'))
        .map(row => ({
            type: row.querySelector('.measurement-type').value,
            time: row.querySelector('.measurement-time').value,
            value: row.querySelector('.measurement-value').value,
            uncertainty: row.querySelector('.measurement-uncertainty').value,
            other: row.querySelector('.measurement-other').value.trim()
        }))
        .filter(m => m.time || m.value || m.uncertainty || m.other);
}

function renderCheckGauge() {
    checkGaugeListEl.innerHTML = checkGaugeReadings.map((val, i) => `
        <li class="checkgauge-item">
            <span>${val} mm</span>
            <button type="button" class="checkgauge-remove" data-index="${i}" aria-label="Remove reading">&times;</button>
        </li>
    `).join('');
    const total = checkGaugeReadings.reduce((sum, v) => sum + v, 0);
    checkGaugeTotalEl.textContent = total.toFixed(1);
}

function syncToggle(checkboxEl, contentEl) {
    contentEl.classList.toggle('is-hidden', !checkboxEl.checked);
}

function setupToggle(checkboxEl, contentEl) {
    function sync() {
        syncToggle(checkboxEl, contentEl);
        debouncedSaveDraft();
    }
    checkboxEl.addEventListener('change', sync);
    return () => syncToggle(checkboxEl, contentEl);
}

function collectSiteVisitState() {
    const state = {};
    const set = (key, value) => { if (value) state[key] = value; };

    set('s', textValue(siteNameInput));
    set('sn', textValue(siteNumberInput));
    set('d', dateInput.value);
    set('p', textValue(partyInput));
    set('w', radioValue('sv-weather'));
    set('wn', textValue(weatherNotesInput));

    const measurements = collectMeasurements();
    if (measurements.length) state.measurements = measurements;

    set('notes', textValue(notesInput));

    set('rg', raingaugeToggle.checked ? 'Yes' : null);
    if (checkGaugeReadings.length) state.checkGauge = checkGaugeReadings.slice();
    const tips = parseInt(manualTipsInput.value, 10);
    if (tips) state.tips = tips;
    set('tipsAt', tipsAtInput.value);
    set('rgNotes', textValue(raingaugeNotesInput));

    set('bc', batteryToggle.checked ? 'Yes' : null);
    set('bcNotes', textValue(batteryNotesInput));

    return state;
}

function applySiteVisitState(state) {
    if (!state) return;

    if (state.s) siteNameInput.value = state.s;
    if (state.sn) siteNumberInput.value = state.sn;
    if (state.d) dateInput.value = state.d;
    if (state.p) partyInput.value = state.p;
    setRadio('sv-weather', state.w);
    if (state.wn) weatherNotesInput.value = state.wn;

    measurementsList.innerHTML = '';
    if (Array.isArray(state.measurements) && state.measurements.length) {
        state.measurements.forEach(m => addMeasurementRow(m));
    } else {
        addMeasurementRow();
    }

    if (state.notes) notesInput.value = state.notes;

    raingaugeToggle.checked = state.rg === 'Yes';
    checkGaugeReadings = Array.isArray(state.checkGauge) ? state.checkGauge.slice() : [];
    renderCheckGauge();
    if (state.tips) manualTipsInput.value = state.tips;
    if (state.tipsAt) tipsAtInput.value = state.tipsAt;
    if (state.rgNotes) raingaugeNotesInput.value = state.rgNotes;

    batteryToggle.checked = state.bc === 'Yes';
    if (state.bcNotes) batteryNotesInput.value = state.bcNotes;

    syncRaingaugeToggle();
    syncBatteryToggle();
}

function buildSiteVisitReport() {
    const report = document.createElement('div');
    report.className = 'gq-report';
    report.innerHTML = '<h2 class="gq-report-title">Site Visit</h2>';

    const rows = [
        fieldRow('Site', textValue(siteNameInput)),
        fieldRow('Date', formatDateForDisplay(dateInput.value)),
        fieldRow('Party', textValue(partyInput)),
        fieldRow('Site number', textValue(siteNumberInput)),
        fieldRow('Weather', radioValue('sv-weather')),
        fieldRow('Weather notes', textValue(weatherNotesInput)),
        divider(),
        sectionHeading('Measurements')
    ];

    const measurements = collectMeasurements();
    if (measurements.length) {
        measurements.forEach((m, i) => {
            const unit = m.type === 'Temperature' ? '&deg;C' : (m.type === 'Other' ? '' : 'm');
            const valueText = m.value ? `${m.value}${unit ? ' ' + unit : ''}` : '—';
            const uncertaintyUnit = (UNCERTAINTY_UNITS[m.type] || '').replace(/[()]/g, '');
            const uncertaintyText = m.uncertainty ? `, &plusmn;${m.uncertainty}${uncertaintyUnit ? ' ' + uncertaintyUnit : ''}` : '';
            const otherText = m.other ? ` (${m.other})` : '';
            const typeLabel = TYPE_ABBREVIATIONS[m.type] || m.type;
            const label = `${typeLabel}${m.time ? ' at ' + m.time : ''}`;
            rows.push(stripedRow(label, `${valueText}${uncertaintyText}${otherText}`, i));
        });
    } else {
        rows.push(fieldRow('Measurements', null));
    }

    rows.push(divider());
    rows.push(fieldRow('Visit notes', textValue(notesInput)));

    if (raingaugeToggle.checked) {
        rows.push(divider());
        rows.push(sectionHeading('Rain Gauge'));
        const checkGaugeText = checkGaugeReadings.length
            ? `${checkGaugeReadings.reduce((sum, v) => sum + v, 0).toFixed(1)} mm (${checkGaugeReadings.join(', ')})`
            : null;
        rows.push(fieldRow('Check gauge total', checkGaugeText));
        rows.push(fieldRow('Manual tips', manualTipsInput.value || '0'));
        rows.push(fieldRow('Tips at', textValue(tipsAtInput)));
        rows.push(fieldRow('Rain gauge notes', textValue(raingaugeNotesInput)));
    }

    if (batteryToggle.checked) {
        rows.push(divider());
        rows.push(sectionHeading('Battery'));
        rows.push(fieldRow('Battery notes', textValue(batteryNotesInput)));
    }

    const list = document.createElement('ul');
    list.className = 'gq-report-list';
    list.innerHTML = rows.join('');
    report.appendChild(list);

    return report;
}

async function showCopyFeedback(url, copied) {
    if (copied) {
        shareLinkEl.style.display = 'none';
        flashButtonLabel('Copied!', 5000);
    } else {
        shareLinkEl.dataset.url = url;
        shareLinkEl.textContent = url;
        shareLinkEl.style.display = '';
    }
}

const shareButtonDefaultLabel = shareButton.textContent;
let shareResetTimer = null;

function flashButtonLabel(text, duration) {
    clearTimeout(shareResetTimer);
    shareButton.textContent = text;
    shareResetTimer = setTimeout(() => {
        shareButton.textContent = shareButtonDefaultLabel;
    }, duration);
}

async function loadFromUrlIfPresent() {
    const code = new URLSearchParams(window.location.search).get('d');
    if (!code) return false;

    try {
        const state = await decodeCodeToState(code);
        applySiteVisitState(state);
    } catch (error) {
        console.error('Failed to load shared link:', error);
    } finally {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
    }
    return true;
}

function restoreDraftIfPresent() {
    const draft = loadDraft(DRAFT_KEY);
    if (!draft) return false;
    applySiteVisitState(draft);
    return true;
}

const syncRaingaugeToggle = setupToggle(raingaugeToggle, raingaugeContent);
const syncBatteryToggle = setupToggle(batteryToggle, batteryContent);

form.addEventListener('input', debouncedSaveDraft);
form.addEventListener('change', debouncedSaveDraft);

addMeasurementButton.addEventListener('click', () => {
    addMeasurementRow();
    debouncedSaveDraft();
});

checkGaugeAddButton.addEventListener('click', () => {
    const value = parseFloat(checkGaugeInput.value);
    if (isNaN(value)) return;
    checkGaugeReadings.push(value);
    checkGaugeInput.value = '';
    renderCheckGauge();
    debouncedSaveDraft();
});

checkGaugeInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
        event.preventDefault();
        checkGaugeAddButton.click();
    }
});

checkGaugeListEl.addEventListener('click', event => {
    const button = event.target.closest('.checkgauge-remove');
    if (!button) return;
    const index = parseInt(button.dataset.index, 10);
    checkGaugeReadings.splice(index, 1);
    renderCheckGauge();
    debouncedSaveDraft();
});

tipsIncrementButton.addEventListener('click', () => {
    manualTipsInput.value = (parseInt(manualTipsInput.value, 10) || 0) + 1;
    debouncedSaveDraft();
});

tipsDecrementButton.addEventListener('click', () => {
    manualTipsInput.value = Math.max(0, (parseInt(manualTipsInput.value, 10) || 0) - 1);
    debouncedSaveDraft();
});

dismissDraftNoticeButton.addEventListener('click', () => {
    draftNotice.style.display = 'none';
});

shareButton.addEventListener('click', async () => {
    const code = await encodeStateToCode(collectSiteVisitState());
    const url = `${window.location.origin}${window.location.pathname}?d=${code}`;
    const copied = await copyToClipboard(url);
    showCopyFeedback(url, copied);
});

shareLinkEl.addEventListener('click', async () => {
    const url = shareLinkEl.dataset.url;
    if (!url) return;
    const copied = await copyToClipboard(url);
    showCopyFeedback(url, copied);
});

downloadButton.addEventListener('click', () => {
    const report = buildSiteVisitReport();
    const siteValue = sanitizeForFilename(siteNameInput.value.trim() || siteNumberInput.value.trim());
    const dateValue = dateInput.value || '';
    const nameParts = ['Site Visit', siteValue, dateValue].filter(Boolean);
    downloadElementAsPng(report, `${nameParts.join(' - ')}.png`);
});

clearButton.addEventListener('click', () => {
    if (!confirm('Clear this form? This cannot be undone.')) return;

    siteNameInput.value = '';
    siteNumberInput.value = '';
    dateInput.value = todayIsoDate();
    partyInput.value = '';
    document.querySelectorAll('input[name="sv-weather"]').forEach(r => { r.checked = false; });
    weatherNotesInput.value = '';

    measurementsList.innerHTML = '';
    addMeasurementRow();

    notesInput.value = '';

    raingaugeToggle.checked = false;
    checkGaugeReadings = [];
    renderCheckGauge();
    checkGaugeInput.value = '';
    manualTipsInput.value = '0';
    tipsAtInput.value = currentNzTimeExact();
    raingaugeNotesInput.value = '';

    batteryToggle.checked = false;
    batteryNotesInput.value = '';

    syncRaingaugeToggle();
    syncBatteryToggle();

    clearDraft(DRAFT_KEY);
    draftNotice.style.display = 'none';
    shareLinkEl.style.display = 'none';
});

async function init() {
    dateInput.value = todayIsoDate();

    const loadedFromLink = await loadFromUrlIfPresent();
    if (loadedFromLink) return;

    const restored = restoreDraftIfPresent();
    if (restored) {
        draftNotice.style.display = '';
        return;
    }

    addMeasurementRow();
    tipsAtInput.value = currentNzTimeExact();
}

init();