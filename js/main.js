import {fetchStageData} from "./api.js";

document.addEventListener('DOMContentLoaded', async () => {
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const contentDiv = document.getElementById('table-container');
    const tableBody = document.getElementById('data-table-body');
    const errorMessage = document.getElementById('error-message');

    try {
        const response = await fetchStageData();

        const rows = (response.Data ?? []).sort((a, b) =>
            a.Location.localeCompare(b.Location)
        );

        populateTable(rows, tableBody);

        loadingDiv.style.display = 'none';
        contentDiv.style.display = 'block';

    } catch (error) {
        errorMessage.textContent = `Failed to load data: ${error.message}`;
        loadingDiv.style.display = 'none';
        errorDiv.style.display = 'block';
    }
});

function populateTable(rows, tableBody) {
    tableBody.innerHTML = '';

    rows.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.Location}</td>
            <td class="has-text-right is-hidden-mobile">${item.LocationIdentifier}</td>
            <td class="has-text-right">${item.ValueNumber.toFixed(3)}</td>
        `;
        tableBody.appendChild(row);
    });
}