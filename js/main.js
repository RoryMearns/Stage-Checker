import {fetchStageData, fetchFlowData} from "./api.js";
import {loadRunInfo} from "./runInfo.js";
import {renderRuns} from "./render.js";
import {setupCollapseControls} from "./collapse.js";
import {runSectionId} from "./utils.js";

document.addEventListener('DOMContentLoaded', async () => {
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const runsContainer = document.getElementById('runs-container');
    const runsControls = document.getElementById('runs-controls');
    const collapseAllHeader = document.getElementById('collapse-all-header');
    const legendDiv = document.getElementById('legend');
    const errorMessage = document.getElementById('error-message');

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

        const sectionIds = ['legend', ...runInfo.runs.map(run => runSectionId(run.name))];
        setupCollapseControls(sectionIds, runsControls, collapseAllHeader);

        loadingDiv.style.display = 'none';
        runsControls.style.display = 'block';
        runsContainer.style.display = 'block';
        legendDiv.style.display = 'block';

    } catch (error) {
        errorMessage.textContent = `Failed to load data: ${error.message}`;
        loadingDiv.style.display = 'none';
        errorDiv.style.display = 'block';
    }
});