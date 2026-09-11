import { todayIsoDate, formatDateForDisplay, sanitizeForFilename, downloadElementAsPng } from './form-utils.js';

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
            fieldRow('Rugged laptop used', withOther(radioValue('fn-laptop'), 'fn-laptop-other')),
            fieldRow('RS5 ADCP serial No', withOther(radioValue('fn-rs5'), 'fn-rs5-other')),
            fieldRow('M9 ADCP serial No', withOther(radioValue('fn-m9'), 'fn-m9-other')),
            fieldRow('Measurement Method', radioValue('fn-method')),
            fieldRow('Platform', withOther(radioValue('fn-platform'), 'fn-platform-other')),
            fieldRow('Traverse method', radioValue('fn-traverse')),
            fieldRow('Wind speed', radioValue('fn-wind-speed')),
            fieldRow('Wind direction', radioValue('fn-wind-direction')),
            fieldRow('External water temp', textValue('fn-water-temp') ? `${textValue('fn-water-temp')}&deg;C` : null),
            fieldRow('Water clarity', radioValue('fn-clarity')),
            fieldRow('System test completed', radioValue('fn-system-test')),
            fieldRow('Compass cal completed', radioValue('fn-compass-cal')),
            fieldRow('Loop test completed', radioValue('fn-loop-test')),
            fieldRow('Measurement time &gt;12min', radioValue('fn-time-12min')),
            fieldRow('Measured transducer depth', textValue('fn-transducer-depth') ? `${textValue('fn-transducer-depth')}m` : null),
            fieldRow('Screening distance used', textValue('fn-screening-distance') ? `${textValue('fn-screening-distance')}m` : null),
            fieldRow('Rangefinder channel width', textValue('fn-channel-width') ? `${textValue('fn-channel-width')}m` : null),
            fieldRow('% of x-section measured', textValue('fn-xsection-pct') ? `${textValue('fn-xsection-pct')}%` : null),
            fieldRow('Mean velocity', textValue('fn-mean-velocity') ? `${textValue('fn-mean-velocity')} m/s` : null),
            fieldRow('Distance to recorder', textValue('fn-distance-recorder') ? `${textValue('fn-distance-recorder')} m` : null)
        ];

        if (hasLag) {
            rows.push(fieldRowWithNote(
                'Lag time',
                `${lagMinutes} minutes`,
                'If upstream of site add lag time to gauging time, if downstream of site subtract lag time to gauging time'
            ));
        }

        rows.push(
            fieldRow('Number of usable transects', textValue('fn-transects')),
            fieldRow('Mean Q', textValue('fn-mean-q') ? `${textValue('fn-mean-q')} m&sup3;/s` : null),
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