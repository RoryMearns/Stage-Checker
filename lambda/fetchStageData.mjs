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

export const handler = async (event) => {
    if (event.requestContext?.http?.method === 'OPTIONS' || event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: CORS_HEADERS,
            body: ''
        };
    }

    const today = new Date().toISOString().split('T')[0];

    const body = `sort=Sequence-desc&page=1&pageSize=150&group=&filter=&dataFilters=Location-Type~eq~Environmental+Monitoring~~Dataset-EndOfRecord~gt~2025-09-22&spatialFilterRings=&spatialFilterWkid=&interval=Latest&date=${today}&endDate=&parameters%5B0%5D=21&value=17&type=Statistic&subValue=&subValueType=&refPeriod=&calendar=1&legend=53&legendFilter%5B0%5D=-1&utcOffset=-720&folder=`;

    return new Promise((resolve) => {
        const options = {
            hostname: 'envdata.orc.govt.nz',
            path: '/AQWebPortal/Data/Data_List',
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            ...CORS_HEADERS,
                            ...NO_CACHE_HEADERS
                        },
                        body: JSON.stringify(jsonData)
                    });
                } catch (error) {
                    resolve({
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            ...CORS_HEADERS,
                            ...NO_CACHE_HEADERS
                        },
                        body: data
                    });
                }
            });
        });

        req.on('error', (error) => {
            resolve({
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...CORS_HEADERS,
                    ...NO_CACHE_HEADERS
                },
                body: JSON.stringify({ error: error.message })
            });
        });

        req.write(body);
        req.end();
    });
};
