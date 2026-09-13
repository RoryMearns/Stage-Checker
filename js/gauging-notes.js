import { todayIsoDate, formatDateForDisplay, sanitizeForFilename, downloadElementAsPng, saveDraft, loadDraft, clearDraft, debounce } from './form-utils.js';

function radioValue(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : null;
}

function fieldRow(label, value) {
    return `<li><span class="gq-report-name">${label}:</span> <span class="gq-report-value">${value ?? '—'}</span></li>`;
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

function withOther(value, otherInputId) {
    if (!value || !value.startsWith('Other')) return value;
    const otherValue = document.getElementById(otherInputId).value.trim();
    return otherValue ? `Other (${otherValue})` : 'Other';
}

const M9_VALUES = ['401', '5755', '2250', 'Other-M9'];

function adcpSerialRow() {
    const value = radioValue('fn-adcp-serial');
    if (!value) return fieldRow('ADCP Serial No', null);

    const isM9 = M9_VALUES.includes(value);
    const label = isM9 ? 'M9 ADCP Serial No' : 'RS5 ADCP Serial No';
    const otherInputId = isM9 ? 'fn-m9-other' : 'fn-rs5-other';
    return fieldRow(label, withOther(value, otherInputId));
}

function setupOtherToggle(radioName, otherInputId, otherValue = 'Other') {
    const otherInput = document.getElementById(otherInputId);
    const radios = document.querySelectorAll(`input[name="${radioName}"]`);

    function sync() {
        const checked = document.querySelector(`input[name="${radioName}"]:checked`);
        const isOther = Boolean(checked && checked.value === otherValue);
        otherInput.classList.toggle('is-hidden', !isOther);
    }

    radios.forEach(radio => radio.addEventListener('change', sync));
    return sync;
}

function setRadio(name, value) {
    if (value === undefined || value === null) return;
    const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (input) input.checked = true;
}

function setInputValue(id, value) {
    if (value === undefined || value === null) return;
    document.getElementById(id).value = value;
}

function textValue(id) {
    const value = document.getElementById(id).value.trim();
    return value || null;
}

const siteNameInput = document.getElementById('fn-site-name');
const dateInput = document.getElementById('fn-date');
const locationInput = document.getElementById('fn-location');
const form = siteNameInput.closest('.run-section');
const resetButton = document.getElementById('fn-reset');
const downloadButton = document.getElementById('fn-download');
const notesInput = document.getElementById('fn-notes');

dateInput.value = todayIsoDate();

const otherSyncs = [
    setupOtherToggle('fn-laptop', 'fn-laptop-other'),
    setupOtherToggle('fn-adcp-serial', 'fn-rs5-other', 'Other-RS5'),
    setupOtherToggle('fn-adcp-serial', 'fn-m9-other', 'Other-M9'),
    setupOtherToggle('fn-platform', 'fn-platform-other')
];

const NOTES_DRAFT_KEY = 'notes';

function saveNotesDraft() {
    saveDraft(NOTES_DRAFT_KEY, collectNotesState());
}

const debouncedSaveNotesDraft = debounce(saveNotesDraft, 400);
form.addEventListener('input', debouncedSaveNotesDraft);
form.addEventListener('change', debouncedSaveNotesDraft);

export function restoreNotesDraft() {
    const draft = loadDraft(NOTES_DRAFT_KEY);
    if (!draft) return false;
    applyNotesState(draft);
    return true;
}

export function clearNotesDraft() {
    clearDraft(NOTES_DRAFT_KEY);
}

resetButton.addEventListener('click', () => {
    form.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
        input.value = '';
    });
    form.querySelectorAll('input[type="radio"]').forEach(input => {
        input.checked = false;
    });
    notesInput.value = '';
    dateInput.value = todayIsoDate();
    otherSyncs.forEach(sync => sync());
    clearNotesDraft();
});

export function collectNotesState() {
    const state = {};
    const set = (key, value) => { if (value) state[key] = value; };

    set('s', textValue('fn-site-name'));
    set('d', dateInput.value);
    set('p', textValue('fn-party'));
    set('l', textValue('fn-location'));
    set('lt', radioValue('fn-laptop'));
    set('lto', textValue('fn-laptop-other'));
    set('as', radioValue('fn-adcp-serial'));
    set('r5o', textValue('fn-rs5-other'));
    set('m9o', textValue('fn-m9-other'));
    set('md', radioValue('fn-method'));
    set('pf', radioValue('fn-platform'));
    set('pfo', textValue('fn-platform-other'));
    set('tr', radioValue('fn-traverse'));
    set('ws', radioValue('fn-wind-speed'));
    set('wd', radioValue('fn-wind-direction'));
    set('wt', textValue('fn-water-temp'));
    set('wc', radioValue('fn-clarity'));
    set('st', radioValue('fn-system-test'));
    set('cc', radioValue('fn-compass-cal'));
    set('lp', radioValue('fn-loop-test'));
    set('td', textValue('fn-transducer-depth'));
    set('sd', textValue('fn-screening-distance'));
    set('cw', textValue('fn-channel-width'));
    set('xp', textValue('fn-xsection-pct'));
    set('t1', radioValue('fn-time-12min'));
    set('mv', textValue('fn-mean-velocity'));
    set('dr', textValue('fn-distance-recorder'));
    set('tx', textValue('fn-transects'));
    set('mq', textValue('fn-mean-q'));
    set('cv', textValue('fn-cov'));
    set('n', notesInput.value.trim());

    return state;
}

export function applyNotesState(state) {
    if (!state) return;

    setInputValue('fn-site-name', state.s);
    if (state.d) dateInput.value = state.d;
    setInputValue('fn-party', state.p);
    setInputValue('fn-location', state.l);
    setRadio('fn-laptop', state.lt);
    setInputValue('fn-laptop-other', state.lto);
    setRadio('fn-adcp-serial', state.as);
    setInputValue('fn-rs5-other', state.r5o);
    setInputValue('fn-m9-other', state.m9o);
    setRadio('fn-method', state.md);
    setRadio('fn-platform', state.pf);
    setInputValue('fn-platform-other', state.pfo);
    setRadio('fn-traverse', state.tr);
    setRadio('fn-wind-speed', state.ws);
    setRadio('fn-wind-direction', state.wd);
    setInputValue('fn-water-temp', state.wt);
    setRadio('fn-clarity', state.wc);
    setRadio('fn-system-test', state.st);
    setRadio('fn-compass-cal', state.cc);
    setRadio('fn-loop-test', state.lp);
    setInputValue('fn-transducer-depth', state.td);
    setInputValue('fn-screening-distance', state.sd);
    setInputValue('fn-channel-width', state.cw);
    setInputValue('fn-xsection-pct', state.xp);
    setRadio('fn-time-12min', state.t1);
    setInputValue('fn-mean-velocity', state.mv);
    setInputValue('fn-distance-recorder', state.dr);
    setInputValue('fn-transects', state.tx);
    setInputValue('fn-mean-q', state.mq);
    setInputValue('fn-cov', state.cv);
    if (state.n) notesInput.value = state.n;

    otherSyncs.forEach(sync => sync());
}

export function buildNotesReport() {
    const report = document.createElement('div');
    report.className = 'gq-report';
    report.innerHTML = '<h2 class="gq-report-title">ADCP Field Measurement Notes</h2>';

    const siteName = textValue('fn-site-name');
    const party = textValue('fn-party');
    const dateValue = formatDateForDisplay(dateInput.value);

    const velocityRaw = document.getElementById('fn-mean-velocity').value;
    const distanceRaw = document.getElementById('fn-distance-recorder').value;
    const velocity = parseFloat(velocityRaw);
    const distance = parseFloat(distanceRaw);
    const hasLag = velocityRaw !== '' && distanceRaw !== '' && velocity > 0 && distance >= 0;
    const lagMinutes = hasLag ? Math.round((distance / velocity) / 60) : null;

    const rows = [
        fieldRow('Site', siteName),
        fieldRow('Date', dateValue),
        fieldRow('Party', party),
        fieldRow('Measurement location', textValue('fn-location')),
        divider(),
        fieldRow('Wind speed', radioValue('fn-wind-speed')),
        fieldRow('Wind direction', radioValue('fn-wind-direction')),
        fieldRow('Water clarity', radioValue('fn-clarity')),
        divider(),
        fieldRow('Rugged laptop used', withOther(radioValue('fn-laptop'), 'fn-laptop-other')),
        adcpSerialRow(),
        divider(),
        fieldRow('Measurement Method', radioValue('fn-method')),
        fieldRow('Platform', withOther(radioValue('fn-platform'), 'fn-platform-other')),
        fieldRow('Traverse method', radioValue('fn-traverse')),
        divider(),
        fieldRow('System test completed', radioValue('fn-system-test')),
        fieldRow('Compass cal completed', radioValue('fn-compass-cal')),
        fieldRow('Loop test completed', radioValue('fn-loop-test')),
        fieldRow('Measurement time &gt;12min', radioValue('fn-time-12min')),
        divider(),
        fieldRow('Measured transducer depth', textValue('fn-transducer-depth') ? `${textValue('fn-transducer-depth')}m` : null),
        fieldRow('Screening distance used', textValue('fn-screening-distance') ? `${textValue('fn-screening-distance')}m` : null),
        fieldRow('Rangefinder channel width', textValue('fn-channel-width') ? `${textValue('fn-channel-width')}m` : null),
        fieldRow('External water temp', textValue('fn-water-temp') ? `${textValue('fn-water-temp')}&deg;C` : null),
        fieldRow('Distance to recorder', textValue('fn-distance-recorder') ? `${textValue('fn-distance-recorder')} m` : null),
        fieldRow('Mean velocity', textValue('fn-mean-velocity') ? `${textValue('fn-mean-velocity')} m/s` : null)
    ];

    if (hasLag) {
        rows.push(fieldRowWithNote(
            'Lag time',
            `${lagMinutes} minutes`,
            'If upstream of site add lag time to gauging time, if downstream of site subtract lag time to gauging time'
        ));
    }

    rows.push(
        divider(),
        fieldRow('Number of usable transects', textValue('fn-transects')),
        fieldRow('% of x-section measured', textValue('fn-xsection-pct') ? `${textValue('fn-xsection-pct')}%` : null),
        fieldRow('CoV', textValue('fn-cov') ? `${textValue('fn-cov')}%` : null)
    );

    const list = document.createElement('ul');
    list.className = 'gq-report-list';
    list.innerHTML = rows.join('');
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
        highlight.innerHTML = `Mean Q: <strong>${meanQValue} m&sup3;/s</strong>`;
        report.appendChild(highlight);
    }

    return report;
}

downloadButton.addEventListener('click', () => {
    const report = buildNotesReport();
    const nameSource = siteNameInput.value.trim() || locationInput.value.trim();
    const siteValue = sanitizeForFilename(nameSource);
    const dateValue = dateInput.value || '';
    const nameParts = ['ADCP Field Measurement Notes', siteValue, dateValue].filter(Boolean);
    downloadElementAsPng(report, `${nameParts.join(' - ')}.png`);
});