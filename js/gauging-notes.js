import { todayIsoDate, formatDateForDisplay, sanitizeForFilename, downloadElementAsPng } from './form-utils.js';

function radioValue(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : null;
}

function fieldRow(label, value) {
    return `<li><span class="gq-report-name">${label}:</span> <span class="gq-report-value">${value ?? '—'}</span></li>`;
}

function withOther(value, otherInputId) {
    if (value !== 'Other') return value;
    const otherValue = document.getElementById(otherInputId).value.trim();
    return otherValue ? `Other (${otherValue})` : 'Other';
}

function setupOtherToggle(radioName, otherInputId) {
    const otherInput = document.getElementById(otherInputId);
    const radios = document.querySelectorAll(`input[name="${radioName}"]`);

    function sync() {
        const checked = document.querySelector(`input[name="${radioName}"]:checked`);
        const isOther = Boolean(checked && checked.value === 'Other');
        otherInput.classList.toggle('is-hidden', !isOther);
    }

    radios.forEach(radio => radio.addEventListener('change', sync));
    return sync;
}

document.addEventListener('DOMContentLoaded', () => {
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
        setupOtherToggle('fn-m9', 'fn-m9-other'),
        setupOtherToggle('fn-rs5', 'fn-rs5-other'),
        setupOtherToggle('fn-platform', 'fn-platform-other')
    ];

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
    });

    function textValue(id) {
        const value = document.getElementById(id).value.trim();
        return value || null;
    }

    function buildReport() {
        const report = document.createElement('div');
        report.className = 'gq-report';
        report.innerHTML = '<h2 class="gq-report-title">ADCP Field Measurement Notes</h2>';

        const siteName = textValue('fn-site-name');
        const party = textValue('fn-party');
        const dateValue = formatDateForDisplay(dateInput.value);

        const metaParts = [];
        if (siteName) metaParts.push(`<span><strong>Site:</strong> ${siteName}</span>`);
        if (party) metaParts.push(`<span><strong>Party:</strong> ${party}</span>`);
        if (dateValue) metaParts.push(`<span><strong>Date:</strong> ${dateValue}</span>`);

        if (metaParts.length) {
            const meta = document.createElement('div');
            meta.className = 'gq-report-meta';
            meta.innerHTML = metaParts.join('');
            report.appendChild(meta);
        }

        const list = document.createElement('ul');
        list.className = 'gq-report-list';
        list.innerHTML = [
            fieldRow('Measurement location', textValue('fn-location')),
            fieldRow('Rugged laptop used', withOther(radioValue('fn-laptop'), 'fn-laptop-other')),
            fieldRow('Measurement Method', radioValue('fn-method')),
            fieldRow('M9 ADCP serial No', withOther(radioValue('fn-m9'), 'fn-m9-other')),
            fieldRow('RS5 ADCP serial No', withOther(radioValue('fn-rs5'), 'fn-rs5-other')),
            fieldRow('Traverse method', radioValue('fn-traverse')),
            fieldRow('Platform', withOther(radioValue('fn-platform'), 'fn-platform-other')),
            fieldRow('Loop test completed', radioValue('fn-loop-test')),
            fieldRow('Wind speed', radioValue('fn-wind-speed')),
            fieldRow('Wind direction', radioValue('fn-wind-direction')),
            fieldRow('External water temp', textValue('fn-water-temp') ? `${textValue('fn-water-temp')}&deg;C` : null),
            fieldRow('Water clarity', radioValue('fn-clarity')),
            fieldRow('System test completed', radioValue('fn-system-test')),
            fieldRow('Compass cal completed', radioValue('fn-compass-cal')),
            fieldRow('Measured transducer depth', textValue('fn-transducer-depth') ? `${textValue('fn-transducer-depth')}m` : null),
            fieldRow('Rangefinder channel width', textValue('fn-channel-width') ? `${textValue('fn-channel-width')}m` : null),
            fieldRow('Screening distance used', textValue('fn-screening-distance') ? `${textValue('fn-screening-distance')}m` : null),
            fieldRow('% of x-section measured', textValue('fn-xsection-pct') ? `${textValue('fn-xsection-pct')}%` : null),
            fieldRow('Measurement time &gt;12min', radioValue('fn-time-12min')),
            fieldRow('Number of usable transects', textValue('fn-transects')),
            fieldRow('Mean Q', textValue('fn-mean-q') ? `${textValue('fn-mean-q')} m&sup3;/s` : null),
            fieldRow('CoV', textValue('fn-cov') ? `${textValue('fn-cov')}%` : null)
        ].join('');
        report.appendChild(list);

        const notesValue = notesInput.value.trim();
        if (notesValue) {
            const notes = document.createElement('div');
            notes.className = 'gq-report-notes';
            notes.innerHTML = `<strong>Notes</strong><p>${notesValue.replace(/\n/g, '<br>')}</p>`;
            report.appendChild(notes);
        }

        return report;
    }

    downloadButton.addEventListener('click', () => {
        const report = buildReport();
        const nameSource = siteNameInput.value.trim() || locationInput.value.trim();
        const siteValue = sanitizeForFilename(nameSource);
        const dateValue = dateInput.value || '';
        const nameParts = ['ADCP Field Measurement Notes', siteValue, dateValue].filter(Boolean);
        downloadElementAsPng(report, `${nameParts.join(' - ')}.png`);
    });
});