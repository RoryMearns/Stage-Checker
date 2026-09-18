import { updateFlowDifferenceDisplay } from './form-utils.js';

const ratedInput = document.getElementById('rating-rated-flow');
const gaugedInput = document.getElementById('rating-gauged-flow');
const diffEl = document.getElementById('rating-flow-diff');

function update() {
    updateFlowDifferenceDisplay(diffEl, ratedInput.value, gaugedInput.value);
}

ratedInput.addEventListener('input', update);
gaugedInput.addEventListener('input', update);