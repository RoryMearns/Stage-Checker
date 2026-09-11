document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('declination-form');
    const degreesInput = document.getElementById('declination-degrees');
    const minutesInput = document.getElementById('declination-minutes');
    const resultEl = document.getElementById('declination-result');
    const stepsEl = document.getElementById('declination-steps');

    function showError(message) {
        resultEl.textContent = message;
        resultEl.classList.add('is-error');
        resultEl.style.display = '';
        stepsEl.style.display = 'none';
        stepsEl.textContent = '';
    }

    form.addEventListener('submit', event => {
        event.preventDefault();

        const degrees = parseFloat(degreesInput.value);
        const minutes = parseFloat(minutesInput.value);

        if (!(degrees >= 0)) {
            showError('Enter a degrees value of 0 or more.');
            return;
        }

        if (!(minutes >= 0)) {
            showError('Enter a minutes value of 0 or more.');
            return;
        }

        if (minutes >= 60) {
            showError("Minutes must be less than 60 - 60' would be a whole extra degree.");
            return;
        }

        const rawDecimal = (minutes / 60) * 100;
        let decimalPart = Math.round(rawDecimal);
        let wholeDegrees = degrees;

        // A rounded decimal part of 100 means it should carry over into the next whole degree
        if (decimalPart >= 100) {
            wholeDegrees += 1;
            decimalPart = 0;
        }

        const decimalDegrees = wholeDegrees + decimalPart / 100;

        resultEl.classList.remove('is-error');
        resultEl.style.display = '';
        resultEl.textContent = `${decimalDegrees.toFixed(2)}°`;

        stepsEl.style.display = '';
        stepsEl.innerHTML = `
            Decimal value = minutes ÷ 60 × 100<br>
            = ${minutes}' ÷ 60 × 100 = ${rawDecimal.toFixed(2)}<br>
            = ${degrees}° + 0.${String(decimalPart).padStart(2, '0')} = ${decimalDegrees.toFixed(2)}°
        `;
    });
});