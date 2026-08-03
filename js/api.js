const LAMBDA_URL = 'https://yop7qymjl5.execute-api.ap-southeast-2.amazonaws.com/default/fetchStageData';

export async function fetchStageData() {
    try {
        const response = await fetch(LAMBDA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        return await response.json();
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error;
    }
}
