const http = require('http');
const https = require('https');

// Simple basic test
function runBasicTest() {
  return new Promise((resolve) => {
    let completedRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    let startTime = Date.now();
    const responseTimes = [];

    console.log(`\n🚀 Starting Basic Test`);
    console.log('----------------------------------------');

    function makeRequest() {
      return new Promise((requestResolve) => {
        const requestStart = Date.now();
        const url = 'https://future-site-production.up.railway.app/';
        const protocol = url.startsWith('https') ? https : http;
        
        const req = protocol.get(url, (res) => {
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
      const totalRequests = 10;
      const promises = [];
      
      for (let i = 0; i < totalRequests; i++) {
        promises.push(makeRequest());
        await new Promise(delayResolve => setTimeout(delayResolve, 100));
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
      console.log(`📈 Basic Test RESULTS:`);
      console.log(`✅ Successful: ${successfulRequests}`);
      console.log(`❌ Failed: ${failedRequests}`);
      console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
      console.log(`🚀 Requests/sec: ${requestsPerSecond}`);
      console.log(`📊 Success rate: ${((successfulRequests / totalRequests) * 100).toFixed(1)}%`);
      console.log(`⚡ Avg response time: ${avgResponseTime}ms`);
      console.log(`🔺 Max response time: ${maxResponseTime}ms`);
      console.log(`🔻 Min response time: ${minResponseTime}ms`);
      
      resolve({
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

// Run basic test
runBasicTest().then(() => {
  console.log('\n✅ Basic testing complete!');
}).catch(console.error);
