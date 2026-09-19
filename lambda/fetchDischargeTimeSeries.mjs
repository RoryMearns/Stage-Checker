import https from 'https';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

const NO_CACHE_HEADERS = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache'
};

function jsonResponse(statusCode, payload) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
            ...NO_CACHE_HEADERS
        },
        body: JSON.stringify(payload)
    };
}

export const handler = async (event) => {
    if (event.requestContext?.http?.method === 'OPTIONS' || event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: CORS_HEADERS,
            body: ''
        };
    }

    let params;
    try {
        params = JSON.parse(event.body || '{}');
    } catch (error) {
        return jsonResponse(400, { error: 'Invalid request body - expected JSON' });
    }

    const { datasetId, siteCode, date } = params;

    if (!datasetId) {
        return jsonResponse(400, { error: 'datasetId is required' });
    }
    if (!date) {
        return jsonResponse(400, { error: 'date is required (YYYY-MM-DD)' });
    }

    const bodyParams = new URLSearchParams({
        alldata: 'false',
        dataset: String(datasetId),
        interval: 'Latest',
        date: date,
        timezone: '720',
        endDate: '',
        viewStartDate: '',
        calendar: '1'
    });
    const body = bodyParams.toString();

    const refererCode = siteCode || 'Master';
    const referer = `https://envdata.orc.govt.nz/AQWebPortal/Data/DataSet/Chart/Location/${refererCode}/DataSet/Discharge/Master/Interval/Latest`;

    return new Promise((resolve) => {
        const options = {
            hostname: 'envdata.orc.govt.nz',
            path: '/AQWebPortal/Data/Dataset_Chart',
            method: 'POST',
            headers: {
                'Accept': '*/*',
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Content-Length': Buffer.byteLength(body),
                'Referer': referer
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonResponse(200, jsonData));
                } catch (error) {
                    resolve(jsonResponse(200, { raw: data }));
                }
            });
        });

        req.on('error', (error) => {
            resolve(jsonResponse(500, { error: error.message }));
        });

        req.write(body);
        req.end();
    });
};
