const FETCH_STAGE_LAMBDA_URL = 'https://yop7qymjl5.execute-api.ap-southeast-2.amazonaws.com/default/fetchStageData';
const FETCH_FLOW_LAMBDA_URL = 'https://ct96qivjdd.execute-api.ap-southeast-2.amazonaws.com/default/fetchFlowData';

async function postJson(url) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        return await response.json();
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error;
    }
}

export function fetchStageData() {
    return postJson(FETCH_STAGE_LAMBDA_URL);
}

export function fetchFlowData() {
    return postJson(FETCH_FLOW_LAMBDA_URL);
}
