const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config();

const DATA_DIR = path.join(__dirname, '../src/assets/data');
const API_BASE = process.env.VIETLOTT_API_URL;

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const PRODUCTS = {
    '645': { id: 1, file: '645.json', days: [3, 5, 0] }, // Wed, Fri, Sun
    '655': { id: 2, file: '655.json', days: [2, 4, 6] }  // Tue, Thu, Sat
};

function fetchData(productId, fromId, toId) {
    return new Promise((resolve, reject) => {
        const url = `${API_BASE}?productid=${productId}&fromid=${fromId}&toid=${toId}`;
        console.log(`Fetching ${url}...`);

        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', (err) => reject(err));
    });
}

function loadExistingData(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } catch (e) {
            console.error(`Error reading ${filePath}:`, e);
        }
    }
    return [];
}

async function updateProduct(key, config, force = false) {
    const filePath = path.join(DATA_DIR, config.file);
    let currentData = loadExistingData(filePath);

    // Find latest ID
    let latestId = 0;
    if (currentData.length > 0) {
        latestId = Math.max(...currentData.map(item => Number(item.id)));
    }

    // Check if we need to update based on schedule
    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, ...

    if (!force) {
        // If it's Monday (1), skip everything
        if (today === 1) {
            console.log(`Monday - No updates for ${key}.`);
            return;
        }

        // Check if today is a draw day for this product
        if (!config.days.includes(today)) {
            console.log(`Today is not a draw day for ${key}. Skipping.`);
            // However, if we are way behind (e.g. missed a draw), we should probably check anyway?
            // For now, strictly follow "update on draw days" rule or maybe check if we are behind.
            // Let's allow checking if we suspect we are behind (e.g. latestId seems old), 
            // but the user requirement was specific about days. 
            // Let's stick to the schedule to be safe, but maybe allow a force check if needed.
            // Actually, if the script runs daily, it will catch up. 
            // If we missed a draw day, we might want to check on the next valid day.
            // Let's just check: if it IS a draw day, we look for new data.
            return;
        }
    } else {
        console.log(`Force update enabled for ${key}. Ignoring schedule.`);
    }

    console.log(`Checking updates for ${key} (Latest ID: ${latestId})...`);

    // Try to fetch next few IDs
    const fromId = latestId + 1;
    // We don't know the exact "toId", so let's try to fetch a batch, e.g., next 5
    const toId = fromId + 5;

    try {
        const data = await fetchData(config.id, fromId, toId);
        let newResults = [];

        if (data && Array.isArray(data)) {
            newResults = data;
        } else if (data && data.result) {
            newResults = data.result;
        }

        if (newResults.length > 0) {
            console.log(`Found ${newResults.length} new records for ${key}.`);
            // Filter out any potential duplicates just in case
            const existingIds = new Set(currentData.map(d => String(d.id)));
            const uniqueNew = newResults.filter(r => !existingIds.has(String(r.id)));

            if (uniqueNew.length > 0) {
                currentData = [...uniqueNew, ...currentData].sort((a, b) => Number(b.id) - Number(a.id));
                fs.writeFileSync(filePath, JSON.stringify(currentData, null, 2));
                console.log(`Updated ${key} with ${uniqueNew.length} new records.`);
            } else {
                console.log(`No unique new records for ${key}.`);
            }
        } else {
            console.log(`No new data found for ${key}.`);
        }
    } catch (err) {
        console.error(`Error updating ${key}:`, err);
    }
}

async function main() {
    const isWatch = process.argv.includes('--watch');
    const isForce = process.argv.includes('--force');

    const runUpdates = async () => {
        console.log(`[${new Date().toISOString()}] Running update check...`);
        for (const [key, config] of Object.entries(PRODUCTS)) {
            await updateProduct(key, config, isForce);
        }
    };

    await runUpdates();

    if (isWatch) {
        console.log('Starting watch mode (checking every 30 minutes)...');
        // Check every 30 minutes
        setInterval(runUpdates, 30 * 60 * 1000);
    }
}

main();
