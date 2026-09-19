import {fetchStageData, fetchFlowData} from "./api.js";
import {loadRunInfo} from "./runInfo.js";
import {renderRuns} from "./render.js";
import {setupCollapseAllControl} from "./collapse.js";
import {makeCollapsible} from "./collapsible.js";
import {runSectionId} from "./utils.js";

document.addEventListener('DOMContentLoaded', () => {
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const runsContainer = document.getElementById('runs-container');
    const runsControls = document.getElementById('runs-controls');
    const collapseAllHeader = document.getElementById('collapse-all-header');
    const legendDiv = document.getElementById('legend');
    const errorMessage = document.getElementById('error-message');
    const reloadButton = document.getElementById('reload-data');

    const legendHeader = legendDiv.querySelector('.run-header');
    const legendBody = legendDiv.querySelector('.run-body');
    makeCollapsible(legendDiv, legendHeader, legendBody, 'legend');

    let collapseAllReady = false;

    async function loadData() {
        loadingDiv.style.display = 'block';
        errorDiv.style.display = 'none';

        try {
            const [runInfo, stageResponse, flowResponse] = await Promise.all([
                loadRunInfo(),
                fetchStageData(),
                fetchFlowData()
            ]);

            const siteMeta = runInfo.siteMeta ?? {};

            const stageBySite = new Map(
                (stageResponse.Data ?? []).map(item => [item.LocationIdentifier, item])
            );
            const flowBySite = new Map(
                (flowResponse.Data ?? []).map(item => [item.LocationIdentifier, item])
            );

            renderRuns(runInfo.runs, stageBySite, flowBySite, siteMeta, runsContainer);

            if (!collapseAllReady) {
                const sectionIds = ['legend', ...runInfo.runs.map(run => runSectionId(run.name))];
                setupCollapseAllControl(sectionIds, runsControls, collapseAllHeader);
                collapseAllReady = true;
            }

            loadingDiv.style.display = 'none';
            runsControls.style.display = 'block';
            runsContainer.style.display = 'block';
            legendDiv.style.display = 'block';

        } catch (error) {
            console.error('Failed to load data:', error);
            errorMessage.textContent = "Couldn't load data. Reload when you get internet.";
            loadingDiv.style.display = 'none';
            errorDiv.style.display = 'block';
        }
    }

    reloadButton.addEventListener('click', loadData);

    loadData();
});