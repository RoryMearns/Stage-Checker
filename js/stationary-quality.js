import { formatDateForDisplay, saveDraft, loadDraft, clearDraft, debounce } from './form-utils.js';
import {
    QC_ORDER,
    QC_LABELS,
    SITE_CRITERIA,
    METHOD_CRITERIA,
    optionValue,
    findOption,
    channelTotalQc,
    channelCounts,
    siteQuality,
    methodQuality,
    assessedCount
} from './stationary-matrix.js';

const QUALITY_DRAFT_KEY = 'stationary-quality';

const QC_COLOURS = {
    600: { bg: '#006400', fg: '#F5F8F7' },
    500: { bg: '#00BFFF', fg: '#1F3B3C' },
    400: { bg: '#FFA500', fg: '#1F3B3C' },
    200: { bg: '#8B5A00', fg: '#F5F8F7' }
};

const UNASSESSED_COLOURS = { bg: '#EDF3F1', fg: '#1F3B3C' };

const TIER_CLASSES = {
    200: 'gq-unverified',
    400: 'gq-poor',
    500: 'gq-fair',
    600: 'gq-good'
};

const siteContainer = document.getElementById('sq-site-criteria');
const methodContainer = document.getElementById('sq-method-criteria');
const siteCodeEl = document.getElementById('sq-site-code');
const methodCodeEl = document.getElementById('sq-method-code');
const progressEl = document.getElementById('sq-progress');
const notesInput = document.getElementById('sq-notes');

const TOTAL_CRITERIA = SITE_CRITERIA.length + METHOD_CRITERIA.length;

function sharedSiteValue() {
    return document.getElementById('fn-site-name')?.value.trim() || '';
}

function sharedDateValue() {
    return document.getElementById('fn-date')?.value || '';
}

function buildOptionLabel(criterion, group, opt) {
    const label = document.createElement('label');
    label.className = `gq-option ${TIER_CLASSES[opt.qc]}`;

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = `sq-${criterion.id}`;
    input.value = optionValue(group, opt);

    const text = document.createElement('span');
    text.className = 'gq-option-text';
    const marker = opt.derived ? '<span class="sq-derived-mark" title="Not printed in the standard - derived from the Annex A rule">&dagger;</span>' : '';
    text.innerHTML = `<span class="gq-label-word">${opt.qc}:</span> ${opt.text}${marker}`;

    label.append(input, text);
    return label;
}

function buildOptionsRow(criterion, group) {
    const row = document.createElement('div');
    row.className = 'gq-options';

    QC_ORDER.forEach(qc => {
        const opt = group.options.find(o => o.qc === qc);
        if (opt) {
            row.appendChild(buildOptionLabel(criterion, group, opt));
            return;
        }
        const empty = document.createElement('div');
        empty.className = 'gq-option gq-option-empty';
        empty.setAttribute('aria-hidden', 'true');
        row.appendChild(empty);
    });

    return row;
}

function buildHeader(number, criterion) {
    const header = document.createElement('div');
    header.className = 'gq-criterion-header';
    const ref = criterion.ref ? ` <em>(${criterion.ref})</em>` : '';
    const hint = criterion.hint ? ` <em>${criterion.hint}</em>` : '';
    header.innerHTML = `<span class="gq-number">${number}</span><span class="gq-name">${criterion.name}${hint}${ref}</span>`;
    return header;
}

function buildCriterion(number, criterion) {
    const el = document.createElement('div');
    el.className = 'gq-criterion';
    el.dataset.id = criterion.id;
    el.appendChild(buildHeader(number, criterion));

    if (criterion.groups.length === 1) {
        el.appendChild(buildOptionsRow(criterion, criterion.groups[0]));
        return el;
    }

    const groups = document.createElement('div');
    groups.className = 'sq-groups';
    criterion.groups.forEach(group => {
        const wrap = document.createElement('div');
        wrap.className = 'sq-group';
        wrap.innerHTML = `<div class="sq-group-label">${group.label}</div>`;
        wrap.appendChild(buildOptionsRow(criterion, group));
        groups.appendChild(wrap);
    });
    el.appendChild(groups);
    return el;
}

function buildDerived(number, name, derivedId) {
    const el = document.createElement('div');
    el.className = 'gq-criterion sq-derived';
    el.innerHTML = `
        <div class="gq-criterion-header"><span class="gq-number">${number}</span><span class="gq-name">${name}</span></div>
        <div class="sq-derived-result" data-derived="${derivedId}"></div>
    `;
    return el;
}

function buildSubheading(text) {
    const el = document.createElement('div');
    el.className = 'fn-section-title sq-subheading';
    el.textContent = text;
    return el;
}

function buildSiteMatrix() {
    let number = 1;
    let currentSection = null;

    SITE_CRITERIA.forEach(criterion => {
        if (criterion.section !== currentSection) {
            if (currentSection === 'Channel characteristics') {
                siteContainer.appendChild(buildDerived(number++, 'Total number of channel characteristics not achieving 600', 'channel-total'));
            }
            currentSection = criterion.section;
            siteContainer.appendChild(buildSubheading(currentSection));
        }
        siteContainer.appendChild(buildCriterion(number++, criterion));
    });
}

function buildMethodMatrix() {
    let number = 1;
    METHOD_CRITERIA.forEach(criterion => {
        if (criterion.id === 'm10') {
            methodContainer.appendChild(buildDerived(number++, 'QC derived from the Site Quality Matrix <em>(Annex B)</em>', 'site-quality'));
        }
        methodContainer.appendChild(buildCriterion(number++, criterion));
    });
}

buildSiteMatrix();
buildMethodMatrix();

const allCriteria = [...SITE_CRITERIA, ...METHOD_CRITERIA];

function readSelections() {
    const selections = {};
    document.querySelectorAll('.gq-criterion input[type="radio"]:checked').forEach(input => {
        selections[input.name.replace(/^sq-/, '')] = input.value;
    });
    return selections;
}

function qcText(qc) {
    return `${qc} (${QC_LABELS[qc]})`;
}

function applyBox(el, qc, prefix) {
    const colours = qc === null ? UNASSESSED_COLOURS : QC_COLOURS[qc];
    el.style.backgroundColor = colours.bg;
    el.style.color = colours.fg;
    el.textContent = qc === null ? `${prefix}: not yet assessed` : `${prefix}: ${qcText(qc)}`;
}

function applyDerived(derivedId, text, qc) {
    const el = document.querySelector(`[data-derived="${derivedId}"]`);
    const colours = qc === null ? UNASSESSED_COLOURS : QC_COLOURS[qc];
    el.style.backgroundColor = colours.bg;
    el.style.color = colours.fg;
    el.textContent = text;
}

function recalculate() {
    const selections = readSelections();

    document.querySelectorAll('.gq-criterion .gq-option').forEach(option => {
        const input = option.querySelector('input[type="radio"]');
        option.classList.toggle('is-selected', Boolean(input && input.checked));
    });

    const channelQc = channelTotalQc(selections);
    const counts = channelCounts(selections);
    applyDerived(
        'channel-total',
        channelQc === null ? 'Not yet assessed' : `${channelQc} - ${counts.below600} of ${counts.answered} assessed below 600`,
        channelQc
    );

    const siteQc = siteQuality(selections);
    applyDerived(
        'site-quality',
        siteQc === null ? 'Not yet assessed' : `${siteQc} - from the Site Quality Matrix above`,
        siteQc
    );

    applyBox(siteCodeEl, siteQc, 'Site quality');
    applyBox(methodCodeEl, methodQuality(selections, siteQc), 'Stationary gauging quality');

    const answered = assessedCount(allCriteria, selections);
    progressEl.textContent = `${answered} of ${TOTAL_CRITERIA} criteria assessed`;
}

function saveQualityDraft() {
    saveDraft(QUALITY_DRAFT_KEY, collectQualityState());
}

const debouncedSaveQualityDraft = debounce(saveQualityDraft, 400);

[siteContainer, methodContainer].forEach(container => {
    container.addEventListener('change', event => {
        if (event.target.matches('input[type="radio"]')) {
            recalculate();
            debouncedSaveQualityDraft();
        }
    });
});

notesInput.addEventListener('input', debouncedSaveQualityDraft);

export function collectQualityState() {
    const state = readSelections();
    const notes = notesInput.value.trim();
    if (notes) state.notes = notes;
    return state;
}

export function applyQualityState(state) {
    if (!state) return;
    Object.entries(state).forEach(([key, value]) => {
        if (key === 'notes') {
            notesInput.value = value;
            return;
        }
        const input = document.querySelector(`input[name="sq-${key}"][value="${value}"]`);
        if (input) input.checked = true;
    });
    recalculate();
}

export function restoreQualityDraft() {
    const draft = loadDraft(QUALITY_DRAFT_KEY);
    if (!draft) return false;
    applyQualityState(draft);
    return true;
}

export function clearQualityDraft() {
    clearDraft(QUALITY_DRAFT_KEY);
}

export function resetQuality() {
    document.querySelectorAll('.gq-criterion input[type="radio"]').forEach(input => {
        input.checked = false;
    });
    notesInput.value = '';
    recalculate();
    clearQualityDraft();
}

function reportRow(number, name, valueText, description) {
    const li = document.createElement('li');
    const value = valueText === null
        ? '<span class="gq-report-value gq-report-none">Not selected</span>'
        : `<span class="gq-report-value">${valueText}</span>`;
    const desc = description ? `<div class="gq-report-desc">${description}</div>` : '';
    li.innerHTML = `<div class="gq-report-row"><span class="gq-report-num">${number}.</span> <span class="gq-report-name">${name}</span> ${value}</div>${desc}`;
    return li;
}

function reportHeading(text) {
    const li = document.createElement('li');
    li.className = 'gq-report-section-heading';
    li.textContent = text;
    return li;
}

function reportSelectionRow(number, criterion, selections) {
    const found = findOption(criterion, selections[criterion.id]);
    if (!found) return reportRow(number, criterion.name, null, null);

    const groupPrefix = found.group.label && criterion.groups.length > 1 ? `${found.group.label}: ` : '';
    return reportRow(number, criterion.name, String(found.option.qc), `${groupPrefix}${found.option.text}`);
}

function appendSiteRows(list, selections) {
    let number = 1;
    let currentSection = null;
    list.appendChild(reportHeading('Annex B - Site Quality Matrix'));

    SITE_CRITERIA.forEach(criterion => {
        if (criterion.section !== currentSection) {
            if (currentSection === 'Channel characteristics') {
                const channelQc = channelTotalQc(selections);
                list.appendChild(reportRow(number++, 'Total channel characteristics below 600', channelQc === null ? null : String(channelQc), null));
            }
            currentSection = criterion.section;
        }
        list.appendChild(reportSelectionRow(number++, criterion, selections));
    });
}

function appendMethodRows(list, selections, siteQc) {
    let number = 1;
    list.appendChild(reportHeading('Annex C - Stationary Meter Method Matrix'));

    METHOD_CRITERIA.forEach(criterion => {
        if (criterion.id === 'm10') {
            list.appendChild(reportRow(number++, 'QC derived from Site Quality Matrix', siteQc === null ? null : String(siteQc), null));
        }
        list.appendChild(reportSelectionRow(number++, criterion, selections));
    });
}

function reportQualityBox(text, qc) {
    const colours = qc === null ? UNASSESSED_COLOURS : QC_COLOURS[qc];
    const box = document.createElement('div');
    box.className = 'gq-report-quality';
    box.style.backgroundColor = colours.bg;
    box.style.color = colours.fg;
    box.textContent = text;
    return box;
}

export function buildQualityReport() {
    const selections = readSelections();
    const siteQc = siteQuality(selections);
    const methodQc = methodQuality(selections, siteQc);

    const report = document.createElement('div');
    report.className = 'gq-report';
    report.innerHTML = '<h2 class="gq-report-title">Stationary Gauging Quality</h2>';

    const list = document.createElement('ul');
    list.className = 'gq-report-list';

    const siteValue = sharedSiteValue();
    const dateValue = formatDateForDisplay(sharedDateValue());
    if (siteValue) {
        list.innerHTML += `<li><span class="gq-report-name">Site:</span> <span class="gq-report-value">${siteValue}</span></li>`;
    }
    if (dateValue) {
        list.innerHTML += `<li><span class="gq-report-name">Date:</span> <span class="gq-report-value">${dateValue}</span></li>`;
    }

    appendSiteRows(list, selections);
    appendMethodRows(list, selections, siteQc);
    report.appendChild(list);

    report.appendChild(reportQualityBox(siteQc === null ? 'Site quality: not yet assessed' : `Site quality: ${qcText(siteQc)}`, siteQc));
    report.appendChild(reportQualityBox(
        methodQc === null ? 'Stationary gauging quality: not yet assessed' : `Stationary gauging quality: ${qcText(methodQc)}`,
        methodQc
    ));

    const notesValue = notesInput.value.trim();
    if (notesValue) {
        const notes = document.createElement('div');
        notes.className = 'gq-report-notes';
        notes.innerHTML = `<strong>Notes</strong><p>${notesValue.replace(/\n/g, '<br>')}</p>`;
        report.appendChild(notes);
    }

    return report;
}

recalculate();