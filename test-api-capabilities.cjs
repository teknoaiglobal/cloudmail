
const https = require('https');
// const fetch = require('node-fetch'); // Removed

const firestoreUrl = 'https://firestore.googleapis.com/v1/projects/tekno-335f8/databases/(default)/documents/artifacts/default-app-id/public/data/public_files/cloudmail?key=AIzaSyCirtabCZOy3XMnNLUc-iKIYGegZJbPqhw';

async function run() {
    try {
        // 1. Get credentials
        console.log('Fetching credentials...');
        const credsRes = await fetch(firestoreUrl);
        const credsData = await credsRes.json();
        const content = credsData?.fields?.content?.stringValue;
        
        if (!content) throw new Error('No content in Firestore');
        
        const emailMatch = content.match(/Email\s*:\s*([^\s]+)/);
        const apiKeyMatch = content.match(/Global API Key \/ Token\s*:\s*([a-zA-Z0-9]+)/);
        const zoneIdMatch = content.match(/Zone ID\s*:\s*([a-zA-Z0-9]+)/);
        
        if (!apiKeyMatch || !zoneIdMatch) throw new Error('Could not parse credentials');
        
        const creds = {
            email: emailMatch ? emailMatch[1] : '',
            apiKey: apiKeyMatch[1],
            zoneId: zoneIdMatch[1]
        };
        
        console.log('Credentials obtained.');
        console.log(`Zone ID: ${creds.zoneId}`);

        // 1.5 Get Zone Details to find domain name
        const zoneRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${creds.zoneId}`, {
             headers: {
                'Content-Type': 'application/json',
                'X-Auth-Email': creds.email,
                'X-Auth-Key': creds.apiKey
            }
        });
        const zoneData = await zoneRes.json();
        const domainName = zoneData.result.name;
        console.log(`Domain Name: ${domainName}`);

        // 2. Test GET /email/routing/dns WITHOUT subdomain (Root)
        console.log('\n--- Testing Root DNS Requirements ---');
        const rootRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${creds.zoneId}/email/routing/dns`, {
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Email': creds.email,
                'X-Auth-Key': creds.apiKey
            }
        });
        const rootData = await rootRes.json();
        if (rootData.success) {
            console.log(`Root records count: ${rootData.result.length}`);
            rootData.result.forEach(r => console.log(`- ${r.type} ${r.name}`));
        } else {
            console.error('Failed to fetch root DNS:', rootData.errors);
        }

        // 3. Test GET /email/routing/dns WITH subdomain
        const testSubdomain = `test-check-api.${domainName}`; 
        console.log(`\n--- Testing Subdomain DNS Requirements for: ${testSubdomain} ---`);
        
        const subRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${creds.zoneId}/email/routing/dns?subdomain=${testSubdomain}`, {
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Email': creds.email,
                'X-Auth-Key': creds.apiKey
            }
        });
        const subData = await subRes.json();
        
        if (subData.success) {
             console.log('Subdomain Data Result:', JSON.stringify(subData.result, null, 2));
             if (Array.isArray(subData.result)) {
                 console.log(`Subdomain records count: ${subData.result.length}`);
                 subData.result.forEach(r => {
                     console.log(`- ${r.type} ${r.name} -> ${r.content} (Priority: ${r.priority})`);
                 });
             } else {
                 console.log('Result is not an array.');
             }
        } else {
            console.error('Failed to fetch subdomain DNS:', subData.errors);
            console.log('API Response:', JSON.stringify(subData, null, 2));
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

// Simple fetch polyfill if node-fetch isn't installed
if (typeof fetch === 'undefined') {
    global.fetch = function(url, options = {}) {
        return new Promise((resolve, reject) => {
            const req = https.request(url, {
                method: options.method || 'GET',
                headers: options.headers || {}
            }, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        json: () => Promise.resolve(JSON.parse(data)),
                        text: () => Promise.resolve(data)
                    });
                });
            });
            req.on('error', reject);
            if (options.body) req.write(options.body);
            req.end();
        });
    };
}

run();
