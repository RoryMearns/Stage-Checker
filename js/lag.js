document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('lag-form');
    const velocityInput = document.getElementById('velocity');
    const distanceInput = document.getElementById('distance');
    const resultEl = document.getElementById('lag-result');
    const directionEl = document.getElementById('lag-direction');
    const stepsEl = document.getElementById('lag-steps');

    form.addEventListener('submit', event => {
        event.preventDefault();

        const velocity = parseFloat(velocityInput.value);
        const distance = parseFloat(distanceInput.value);

        if (!(velocity > 0) || !(distance >= 0)) {
            resultEl.textContent = 'Enter a velocity greater than 0 and a distance of 0 or more.';
            resultEl.classList.add('is-error');
            resultEl.style.display = '';
            directionEl.style.display = 'none';
            directionEl.textContent = '';
            stepsEl.style.display = 'none';
            stepsEl.textContent = '';
            return;
        }

        const seconds = distance / velocity;
        const exactMinutes = seconds / 60;
        const roundedMinutes = Math.round(exactMinutes);

        resultEl.classList.remove('is-error');
        resultEl.style.display = '';
        resultEl.textContent = `${roundedMinutes} minute lag time`;

        directionEl.style.display = '';
        directionEl.innerHTML = `
            <strong>Gauging upstream:</strong> <em>add</em> <strong>${roundedMinutes} minutes</strong> to your gauging time.<br>
            <strong>Gauging downstream:</strong> <em>subtract</em> <strong>${roundedMinutes} minutes</strong> from your gauging time.
        `;

        stepsEl.style.display = '';
        stepsEl.innerHTML = `
            Lag time = distance ÷ velocity<br>
            = ${distance}m ÷ ${velocity}m/s = ${seconds.toFixed(1)}s<br>
            = ${seconds.toFixed(1)}s ÷ 60 = ${exactMinutes.toFixed(2)} minutes
        `;
    });
});