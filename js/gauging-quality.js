import { formatDateForDisplay, sanitizeForFilename, downloadElementAsPng } from './form-utils.js';

const POINTS = { poor: 3, fair: 1, good: 0 };

const QUALITY_CODES = [
    { code: 600, label: 'Good', bg: '#006400', fg: '#F5F8F7' },
    { code: 500, label: 'Fair', bg: '#00BFFF', fg: '#1F3B3C' },
    { code: 400, label: 'Poor', bg: '#FFA500', fg: '#1F3B3C' }
];

function qualityCodeFor(code) {
    return QUALITY_CODES.find(q => q.code === code);
}

function getSelectedDescription(checkedInput) {
    const label = checkedInput.closest('label.gq-option');
    if (!label) return '';

    const textEl = label.querySelector('.gq-option-text');
    const clone = textEl.cloneNode(true);
    const labelWord = clone.querySelector('.gq-label-word');
    if (labelWord) labelWord.remove();

    return clone.textContent.trim();
}

// Site/Date live on the Field Notes card now - read them directly rather than duplicating the inputs
function sharedSiteValue() {
    return document.getElementById('fn-site-name')?.value.trim() || '';
}

function sharedDateValue() {
    return document.getElementById('fn-date')?.value || '';
}

const criteria = Array.from(document.querySelectorAll('.gq-criterion'));
const criteriaContainer = document.getElementById('gq-criteria');
const progressEl = document.getElementById('gq-progress');
const totalPoorEl = document.getElementById('gq-total-poor');
const totalFairEl = document.getElementById('gq-total-fair');
const totalGoodEl = document.getElementById('gq-total-good');
const totalGrandEl = document.getElementById('gq-total-grand');
const qualityCodeEl = document.getElementById('gq-quality-code');
const resetButton = document.getElementById('gq-reset');
const notesInput = document.getElementById('gq-notes');
const downloadButton = document.getElementById('gq-download');

function recalculate() {
    let poorTotal = 0;
    let fairTotal = 0;
    let goodTotal = 0;
    let poorCount = 0;
    let answered = 0;

    criteria.forEach(criterion => {
        const checked = criterion.querySelector('input[type="radio"]:checked');

        criterion.querySelectorAll('.gq-option').forEach(option => {
            const input = option.querySelector('input[type="radio"]');
            option.classList.toggle('is-selected', Boolean(input && input.checked));
        });

        if (!checked) return;

        answered += 1;
        const value = checked.value;
        const points = POINTS[value];

        if (value === 'poor') {
            poorTotal += points;
            poorCount += 1;
        } else if (value === 'fair') {
            fairTotal += points;
        } else if (value === 'good') {
            goodTotal += points;
        }
    });

    const grandTotal = poorTotal + fairTotal + goodTotal;

    totalPoorEl.textContent = poorTotal;
    totalFairEl.textContent = fairTotal;
    totalGoodEl.textContent = goodTotal;
    totalGrandEl.textContent = grandTotal;

    progressEl.textContent = `${answered} of ${criteria.length} criteria assessed`;

    let result;
    let overrideNote = '';

    if (poorCount >= 3) {
        result = qualityCodeFor(400);
        overrideNote = ` - ${poorCount} criteria marked Poor triggers automatic 400 Quality`;
    } else if (grandTotal > 12) {
        result = qualityCodeFor(400);
    } else if (grandTotal >= 4) {
        result = qualityCodeFor(500);
    } else {
        result = qualityCodeFor(600);
    }

    qualityCodeEl.style.backgroundColor = result.bg;
    qualityCodeEl.style.color = result.fg;
    qualityCodeEl.textContent = `Quality ${result.code}${overrideNote}`;
}

criteriaContainer.addEventListener('change', event => {
    if (event.target.matches('input[type="radio"]')) {
        recalculate();
    }
});

resetButton.addEventListener('click', () => {
    criteria.forEach(criterion => {
        criterion.querySelectorAll('input[type="radio"]').forEach(input => {
            input.checked = false;
        });
    });
    notesInput.value = '';
    recalculate();
});

export function buildQualityReport() {
    const report = document.createElement('div');
    report.className = 'gq-report';

    report.innerHTML = '<h2 class="gq-report-title">ADCP Gauging Quality</h2>';

    const siteValue = sharedSiteValue();
    const dateValue = formatDateForDisplay(sharedDateValue());

    const list = document.createElement('ul');
    list.className = 'gq-report-list';

    if (siteValue) {
        list.innerHTML += `<li><span class="gq-report-name">Site:</span> <span class="gq-report-value">${siteValue}</span></li>`;
    }
    if (dateValue) {
        list.innerHTML += `<li><span class="gq-report-name">Date:</span> <span class="gq-report-value">${dateValue}</span></li>`;
    }

    criteria.forEach(criterion => {
        const number = criterion.dataset.name;
        const name = criterion.querySelector('.gq-name').childNodes[0].textContent.trim();
        const checked = criterion.querySelector('input[type="radio"]:checked');
        const li = document.createElement('li');

        if (checked) {
            const value = checked.value;
            const label = value.charAt(0).toUpperCase() + value.slice(1);
            const description = getSelectedDescription(checked);
            li.innerHTML = `
                <div class="gq-report-row"><span class="gq-report-num">${number}.</span> <span class="gq-report-name">${name}</span> <span class="gq-report-value gq-report-${value}">${label}</span></div>
                <div class="gq-report-desc">${description}</div>
            `;
        } else {
            li.innerHTML = `<div class="gq-report-row"><span class="gq-report-num">${number}.</span> <span class="gq-report-name">${name}</span> <span class="gq-report-value gq-report-none">Not selected</span></div>`;
        }
        list.appendChild(li);
    });

    report.appendChild(list);

    const totals = document.createElement('div');
    totals.className = 'gq-report-totals';
    totals.innerHTML = `
        <div class="gq-report-total-box gq-report-total-poor">
            <span class="gq-report-total-label">Poor</span>
            <span class="gq-report-total-value">${totalPoorEl.textContent}</span>
        </div>
        <div class="gq-report-total-box gq-report-total-fair">
            <span class="gq-report-total-label">Fair</span>
            <span class="gq-report-total-value">${totalFairEl.textContent}</span>
        </div>
        <div class="gq-report-total-box gq-report-total-good">
            <span class="gq-report-total-label">Good</span>
            <span class="gq-report-total-value">${totalGoodEl.textContent}</span>
        </div>
        <div class="gq-report-total-box gq-report-total-grand">
            <span class="gq-report-total-label">Grand Total</span>
            <span class="gq-report-total-value">${totalGrandEl.textContent}</span>
        </div>
    `;
    report.appendChild(totals);

    const quality = document.createElement('div');
    quality.className = 'gq-report-quality';
    quality.style.backgroundColor = qualityCodeEl.style.backgroundColor;
    quality.style.color = qualityCodeEl.style.color;
    quality.textContent = qualityCodeEl.textContent;
    report.appendChild(quality);

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
    const report = buildQualityReport();
    const siteValue = sanitizeForFilename(sharedSiteValue());
    const dateValue = sharedDateValue();
    const nameParts = ['ADCP Gauging Quality Card', siteValue, dateValue].filter(Boolean);
    downloadElementAsPng(report, `${nameParts.join(' - ')}.png`);
});

recalculate();

export function collectQualityState() {
    const state = {};
    criteria.forEach(criterion => {
        const number = criterion.dataset.name;
        const checked = criterion.querySelector('input[type="radio"]:checked');
        if (checked) state[number] = checked.value;
    });
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
        const input = document.querySelector(`.gq-criterion[data-name="${key}"] input[value="${value}"]`);
        if (input) input.checked = true;
    });
    recalculate();
}