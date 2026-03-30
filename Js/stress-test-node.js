const http = require('http');
const https = require('https');

// Configuratie
const TARGET_URL = 'https://future-site-production.up.railway.app/';
const CONCURRENT_REQUESTS = 10;
const TOTAL_REQUESTS = 50;
const REQUEST_DELAY = 100; // ms tussen requests

// Counter voor statistieken
let completedRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
let startTime = Date.now();

// Functie om HTTP request te doen
function makeRequest() {
  return new Promise((resolve) => {
    const protocol = TARGET_URL.startsWith('https') ? https : http;
    
    const req = protocol.get(TARGET_URL, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        completedRequests++;
        if (res.statusCode >= 200 && res.statusCode < 300) {
          successfulRequests++;
        } else {
          failedRequests++;
        }
        
        console.log(`Request ${completedRequests}: Status ${res.statusCode}, Size: ${data.length} bytes`);
        resolve({ statusCode: res.statusCode, size: data.length });
      });
    });
    
    req.on('error', (err) => {
      completedRequests++;
      failedRequests++;
      console.error(`Request ${completedRequests}: Error - ${err.message}`);
      resolve({ error: err.message });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      completedRequests++;
      failedRequests++;
      console.log(`Request ${completedRequests}: Timeout`);
      resolve({ error: 'Timeout' });
    });
  });
}

// Functie om concurrent requests te beheren
async function runStressTest() {
  console.log(`🚀 Starting stress test on ${TARGET_URL}`);
  console.log(`📊 Target: ${TOTAL_REQUESTS} total requests, ${CONCURRENT_REQUESTS} concurrent`);
  console.log('----------------------------------------');
  
  const promises = [];
  
  for (let i = 0; i < TOTAL_REQUESTS; i++) {
    promises.push(makeRequest());
    
    // Delay tussen requests om server niet te overbelasten
    if (i < TOTAL_REQUESTS - 1) {
      await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
    }
    
    // Wacht op slots als we max concurrent bereiken
    if (promises.length >= CONCURRENT_REQUESTS) {
      await Promise.race(promises);
      // Verwijder voltooide promises
      for (let j = promises.length - 1; j >= 0; j--) {
        if (promises[j] && promises[j].statusCode) {
          promises.splice(j, 1);
        }
      }
    }
  }
  
  // Wacht op alle remaining requests
  await Promise.all(promises);
  
  // Toon resultaten
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  const requestsPerSecond = (successfulRequests / duration).toFixed(2);
  
  console.log('----------------------------------------');
  console.log('📈 STRESS TEST RESULTS:');
  console.log(`✅ Successful: ${successfulRequests}`);
  console.log(`❌ Failed: ${failedRequests}`);
  console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
  console.log(`🚀 Requests/sec: ${requestsPerSecond}`);
  console.log(`📊 Success rate: ${((successfulRequests / TOTAL_REQUESTS) * 100).toFixed(1)}%`);
}

// Start de stress test
runStressTest().catch(console.error);
