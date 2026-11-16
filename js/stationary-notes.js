import { todayIsoDate, formatDateForDisplay, saveDraft, loadDraft, clearDraft, debounce } from './form-utils.js';
import { setupSiteAutocomplete } from './site-lookup.js';
import { createResultsHydrograph } from './results-hydrograph.js';

const NOTES_DRAFT_KEY = 'stationary-notes';
const LOCATION_KEY_PREFIX = 'stationary-notes-location:';

const TEXT_FIELDS = [
    ['s', 'fn-site-name'],
    ['sn', 'fn-site-number'],
    ['p', 'fn-party'],
    ['l', 'fn-location'],
    ['wt', 'fn-water-temp'],
    ['io', 'fn-instrument-other'],
    ['r5o', 'fn-rs5-other'],
    ['m9o', 'fn-m9-other'],
    ['ac', 'fn-access-other'],
    ['nv', 'fn-verticals'],
    ['dr', 'fn-distance-recorder'],
    ['mv', 'fn-mean-velocity'],
    ['mq', 'fn-mean-q'],
    ['gs', 'fn-gauging-start'],
    ['ge', 'fn-gauging-end']
];

const RADIO_FIELDS = [
    ['wc', 'fn-clarity'],
    ['in', 'fn-instrument'],
    ['as', 'fn-adcp-serial'],
    ['ax', 'fn-access']
];

function byId(id) {
    return document.getElementById(id);
}

function radioValue(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : null;
}

function setRadio(name, value) {
    if (value === undefined || value === null) return;
    const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (input) input.checked = true;
}

function textValue(id) {
    return byId(id).value.trim() || null;
}

function setInputValue(id, value) {
    if (value === undefined || value === null) return;
    byId(id).value = value;
}

function withOther(value, otherInputId) {
    if (!value || !value.startsWith('Other')) return value;
    const otherValue = textValue(otherInputId);
    return otherValue ? `Other (${otherValue})` : 'Other';
}

function withUnit(value, unit) {
    return value ? `${value}${unit}` : null;
}

const DEVICE_SERIALS = {
    RS5: { blockId: 'fn-rs5-block', otherId: 'fn-rs5-other', otherValue: 'Other-RS5' },
    M9: { blockId: 'fn-m9-block', otherId: 'fn-m9-other', otherValue: 'Other-M9' }
};

function fieldRow(label, value) {
    return `<li><span class="gq-report-name">${label}:</span> <span class="gq-report-value">${value ?? '—'}</span></li>`;
}

function serialRow() {
    const instrument = radioValue('fn-instrument');
    const device = DEVICE_SERIALS[instrument];
    if (!device) return '';
    return fieldRow(`${instrument} serial number`, withOther(radioValue('fn-adcp-serial'), device.otherId));
}

function fieldRowWithNote(label, value, note) {
    return `
        <li>
            <div class="gq-report-row"><span class="gq-report-name">${label}:</span> <span class="gq-report-value">${value}</span></div>
            <div class="gq-report-desc">${note}</div>
        </li>
    `;
}

function divider() {
    return '<li class="gq-report-divider" aria-hidden="true"></li>';
}

const siteNameInput = byId('fn-site-name');
const siteNumberInput = byId('fn-site-number');
const dateInput = byId('fn-date');
const locationInput = byId('fn-location');
const notesInput = byId('fn-notes');
const form = siteNameInput.closest('.run-section');

const results = createResultsHydrograph({
    dateInput,
    startInput: byId('fn-gauging-start'),
    endInput: byId('fn-gauging-end'),
    meanQInput: byId('fn-mean-q'),
    statusEl: byId('fn-hydrograph-status'),
    wrapEl: byId('fn-hydrograph-wrap'),
    hydrographEl: byId('fn-hydrograph'),
    diffsEl: byId('fn-flow-diffs')
});

let selectedSiteCode = null;
let selectedDatasetId = null;

function setupOtherToggle(radioName, otherInputId, otherValue = 'Other') {
    const otherInput = byId(otherInputId);
    const radios = document.querySelectorAll(`input[name="${radioName}"]`);

    function sync() {
        const checked = document.querySelector(`input[name="${radioName}"]:checked`);
        otherInput.classList.toggle('is-hidden', !(checked && checked.value === otherValue));
    }

    radios.forEach(radio => radio.addEventListener('change', sync));
    return sync;
}

function setupDeviceSerials() {
    function sync() {
        const instrument = radioValue('fn-instrument');
        Object.entries(DEVICE_SERIALS).forEach(([device, { blockId }]) => {
            byId(blockId).classList.toggle('is-hidden', instrument !== device);
        });
    }

    function clearSerialChoice() {
        document.querySelectorAll('input[name="fn-adcp-serial"]').forEach(radio => {
            radio.checked = false;
        });
        Object.values(DEVICE_SERIALS).forEach(({ otherId }) => {
            byId(otherId).value = '';
        });
    }

    document.querySelectorAll('input[name="fn-instrument"]').forEach(radio => {
        radio.addEventListener('change', () => {
            clearSerialChoice();
            otherSyncs.forEach(otherSync => otherSync());
        });
    });

    return sync;
}

const otherSyncs = [
    setupOtherToggle('fn-instrument', 'fn-instrument-other'),
    setupOtherToggle('fn-adcp-serial', 'fn-rs5-other', DEVICE_SERIALS.RS5.otherValue),
    setupOtherToggle('fn-adcp-serial', 'fn-m9-other', DEVICE_SERIALS.M9.otherValue),
    setupOtherToggle('fn-access', 'fn-access-other'),
    setupDeviceSerials()
];

function saveNotesDraft() {
    saveDraft(NOTES_DRAFT_KEY, collectNotesState());
}

const debouncedSaveNotesDraft = debounce(saveNotesDraft, 400);
form.addEventListener('input', debouncedSaveNotesDraft);
form.addEventListener('change', debouncedSaveNotesDraft);

setupSiteAutocomplete({
    inputEl: siteNameInput,
    listEl: byId('fn-site-name-list'),
    onSelect: site => {
        selectedSiteCode = site.code;
        selectedDatasetId = site.datasetId;
        siteNumberInput.value = site.code;
        locationInput.value = loadDraft(LOCATION_KEY_PREFIX + site.code) || '';
        debouncedSaveNotesDraft();
        results.fetchFor(site.code, site.datasetId);
    }
});

locationInput.addEventListener('input', () => {
    if (selectedSiteCode) {
        saveDraft(LOCATION_KEY_PREFIX + selectedSiteCode, locationInput.value.trim());
    }
});

dateInput.value = todayIsoDate();

export function collectNotesState() {
    const state = {};
    const set = (key, value) => { if (value) state[key] = value; };

    TEXT_FIELDS.forEach(([key, id]) => set(key, textValue(id)));
    RADIO_FIELDS.forEach(([key, name]) => set(key, radioValue(name)));
    set('dsid', selectedDatasetId);
    set('d', dateInput.value);
    set('n', notesInput.value.trim());

    return state;
}

export function applyNotesState(state) {
    if (!state) return;

    TEXT_FIELDS.forEach(([key, id]) => setInputValue(id, state[key]));
    RADIO_FIELDS.forEach(([key, name]) => setRadio(name, state[key]));
    if (state.d) dateInput.value = state.d;
    if (state.n) notesInput.value = state.n;

    selectedSiteCode = state.sn || null;
    selectedDatasetId = state.dsid || null;
    if (state.sn && state.dsid) {
        results.fetchFor(state.sn, state.dsid);
    }

    otherSyncs.forEach(sync => sync());
}

export function restoreNotesDraft() {
    const draft = loadDraft(NOTES_DRAFT_KEY);
    if (!draft) return false;
    applyNotesState(draft);
    return true;
}

export function clearNotesDraft() {
    clearDraft(NOTES_DRAFT_KEY);
}

export function resetFieldNotes() {
    form.querySelectorAll('input[type="text"], input[type="number"], input[type="time"]').forEach(input => {
        input.value = '';
    });
    form.querySelectorAll('input[type="radio"]').forEach(input => {
        input.checked = false;
    });
    notesInput.value = '';
    dateInput.value = todayIsoDate();
    selectedSiteCode = null;
    selectedDatasetId = null;
    results.reset();
    otherSyncs.forEach(sync => sync());
    clearNotesDraft();
}

export function buildNotesReport() {
    const report = document.createElement('div');
    report.className = 'gq-report';
    report.innerHTML = '<h2 class="gq-report-title">Stationary Field Measurement Notes</h2>';

    const velocityRaw = byId('fn-mean-velocity').value;
    const distanceRaw = byId('fn-distance-recorder').value;
    const velocity = parseFloat(velocityRaw);
    const distance = parseFloat(distanceRaw);
    const hasLag = velocityRaw !== '' && distanceRaw !== '' && velocity > 0 && distance >= 0;
    const lagMinutes = hasLag ? Math.round((distance / velocity) / 60) : null;

    const rows = [
        fieldRow('Site', textValue('fn-site-name')),
        fieldRow('Site number', textValue('fn-site-number')),
        fieldRow('Date', formatDateForDisplay(dateInput.value)),
        fieldRow('Party', textValue('fn-party')),
        fieldRow('Measurement location', textValue('fn-location')),
        divider(),
        fieldRow('Water clarity', radioValue('fn-clarity')),
        fieldRow('External water temp', withUnit(textValue('fn-water-temp'), '&deg;C')),
        divider(),
        fieldRow('Instrument', withOther(radioValue('fn-instrument'), 'fn-instrument-other')),
        serialRow(),
        fieldRow('Access', withOther(radioValue('fn-access'), 'fn-access-other')),
        fieldRow('Number of verticals', textValue('fn-verticals')),
        divider(),
        fieldRow('Distance to recorder', withUnit(textValue('fn-distance-recorder'), ' m')),
        fieldRow('Mean velocity', withUnit(textValue('fn-mean-velocity'), ' m/s'))
    ];

    if (hasLag) {
        rows.push(fieldRowWithNote(
            'Lag time',
            `${lagMinutes} minutes`,
            'If upstream of site add lag time to gauging time, if downstream of site subtract lag time to gauging time'
        ));
    }

    const list = document.createElement('ul');
    list.className = 'gq-report-list';
    list.innerHTML = rows.filter(Boolean).join('');
    report.appendChild(list);

    const notesValue = notesInput.value.trim();
    if (notesValue) {
        const notes = document.createElement('div');
        notes.className = 'gq-report-notes';
        notes.innerHTML = `<strong>Notes</strong><p>${notesValue.replace(/\n/g, '<br>')}</p>`;
        report.appendChild(notes);
    }

    const meanQValue = textValue('fn-mean-q');
    if (meanQValue) {
        const highlight = document.createElement('div');
        highlight.className = 'gq-report-highlight';
        highlight.innerHTML = `Mean Q: <strong>${parseFloat(meanQValue).toFixed(3)} m&sup3;/s</strong>`;
        report.appendChild(highlight);
    }

    results.appendToReport(report, meanQValue);

    return report;
}