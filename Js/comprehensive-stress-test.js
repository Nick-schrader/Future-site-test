const http = require('http');
const https = require('https');

// Configuratie voor verschillende tests
const TESTS = [
  {
    name: "Light Load",
    url: 'https://future-site-production.up.railway.app/',
    concurrent: 5,
    total: 20,
    delay: 200
  },
  {
    name: "Medium Load", 
    url: 'https://future-site-production.up.railway.app/',
    concurrent: 10,
    total: 50,
    delay: 100
  },
  {
    name: "Heavy Load",
    url: 'https://future-site-production.up.railway.app/',
    concurrent: 20,
    total: 100,
    delay: 50
  },
  {
    name: "100 Active Users",
    url: 'https://future-site-production.up.railway.app/',
    concurrent: 100,
    total: 200,
    delay: 25
  }
];

// Queue test - test de queue endpoints
const QUEUE_TEST = {
  name: "Queue System Test",
  url: 'https://future-site-production.up.railway.app/api/queue-status',
  concurrent: 5,
  total: 15,
  delay: 100
};

// Counter voor statistieken
function runTest(config) {
  return new Promise((resolve) => {
    let completedRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    let startTime = Date.now();
    const responseTimes = [];

    console.log(`\n🚀 Starting ${config.name} on ${config.url}`);
    console.log(`📊 Target: ${config.total} total requests, ${config.concurrent} concurrent`);
    console.log('----------------------------------------');

    function makeRequest() {
      return new Promise((requestResolve) => {
        const requestStart = Date.now();
        const protocol = config.url.startsWith('https') ? https : http;
        
        const req = protocol.get(config.url, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            const requestTime = Date.now() - requestStart;
            responseTimes.push(requestTime);
            completedRequests++;
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              successfulRequests++;
              console.log(`✅ Request ${completedRequests}: Status ${res.statusCode}, Time: ${requestTime}ms, Size: ${data.length} bytes`);
            } else {
              failedRequests++;
              console.log(`❌ Request ${completedRequests}: Status ${res.statusCode}, Time: ${requestTime}ms`);
            }
            
            requestResolve({ statusCode: res.statusCode, time: requestTime, size: data.length });
          });
        });
        
        req.on('error', (err) => {
          completedRequests++;
          failedRequests++;
          console.error(`💥 Request ${completedRequests}: Error - ${err.message}`);
          requestResolve({ error: err.message });
        });
        
        req.setTimeout(10000, () => {
          req.destroy();
          completedRequests++;
          failedRequests++;
          console.log(`⏰ Request ${completedRequests}: Timeout`);
          requestResolve({ error: 'Timeout' });
        });
      });
    }

    async function executeTest() {
      const promises = [];
      
      for (let i = 0; i < config.total; i++) {
        promises.push(makeRequest());
        
        if (i < config.total - 1) {
          await new Promise(delayResolve => setTimeout(delayResolve, config.delay));
        }
        
        if (promises.length >= config.concurrent) {
          await Promise.race(promises);
          for (let j = promises.length - 1; j >= 0; j--) {
            if (promises[j] && (promises[j].statusCode || promises[j].error)) {
              promises.splice(j, 1);
            }
          }
        }
      }
      
      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      const requestsPerSecond = (successfulRequests / duration).toFixed(2);
      const avgResponseTime = responseTimes.length > 0 
        ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(2)
        : 0;
      const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
      const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
      
      console.log('----------------------------------------');
      console.log(`📈 ${config.name} RESULTS:`);
      console.log(`✅ Successful: ${successfulRequests}`);
      console.log(`❌ Failed: ${failedRequests}`);
      console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
      console.log(`🚀 Requests/sec: ${requestsPerSecond}`);
      console.log(`📊 Success rate: ${((successfulRequests / config.total) * 100).toFixed(1)}%`);
      console.log(`⚡ Avg response time: ${avgResponseTime}ms`);
      console.log(`🔺 Max response time: ${maxResponseTime}ms`);
      console.log(`🔻 Min response time: ${minResponseTime}ms`);
      
      resolve({
        name: config.name,
        successful: successfulRequests,
        failed: failedRequests,
        duration,
        requestsPerSecond,
        avgResponseTime,
        maxResponseTime,
        minResponseTime
      });
    }
    
    executeTest();
  });
}

// Run alle tests
async function runAllTests() {
  console.log('🧪 STARTING COMPREHENSIVE STRESS TESTS\n');
  
  const results = [];
  
  // Run standard load tests
  for (const test of TESTS) {
    const result = await runTest(test);
    results.push(result);
    
    // Wacht tussen tests
    if (test !== TESTS[TESTS.length - 1]) {
      console.log('\n⏳ Waiting 3 seconds before next test...\n');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // Run queue test
  console.log('\n🔄 Testing queue system...\n');
  const queueResult = await runTest(QUEUE_TEST);
  results.push(queueResult);
  
  // Summary
  console.log('\n🏁 ALL TESTS COMPLETED');
  console.log('========================================');
  results.forEach(result => {
    console.log(`${result.name}: ${result.successful}/${result.total || 'N/A'} successful, ${result.requestsPerSecond} req/s`);
  });
  
  console.log('\n✅ Stress testing complete!');
}

// Start de tests
runAllTests().catch(console.error);
