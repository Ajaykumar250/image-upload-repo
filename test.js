const http = require('http');
const sharp = require('sharp');
const { Transformer } = require('@napi-rs/image');

const logMemory = (step) => {
  const memory = process.memoryUsage();
  console.log(`[${step}] RSS: ${(memory.rss / 1024 / 1024).toFixed(2)} MB | Heap Used: ${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
};

const WIDTH = 4000;
const HEIGHT = 3000;

function createMockRgbaBuffer() {
  return Buffer.alloc(WIDTH * HEIGHT * 4, 255);
}

async function runSharpTest(rgbaBuffer, iterations = 20) {
  console.log('\n--- Starting Sharp Processing Run ---');
  logMemory('Initial');
  for (let i = 0; i < iterations; i++) {
    await sharp(rgbaBuffer, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } })
      .resize(800)
      .webp({ quality: 80 })
      .toBuffer();
    if (i % 5 === 0) logMemory(`Loop ${i}`);
  }
  if (global.gc) global.gc();
  await new Promise(r => setTimeout(r, 2000));
  logMemory('Sharp Post-GC Idle');
}

async function runNapiTest(rgbaBuffer, iterations = 20) {
  console.log('\n--- Starting @napi-rs/image Processing Run ---');
  logMemory('Initial');
  for (let i = 0; i < iterations; i++) {
    const transformer = Transformer.fromRgbaPixels(rgbaBuffer, WIDTH, HEIGHT);
    transformer.resize(800);
    await transformer.webp(80);
    if (i % 5 === 0) logMemory(`Loop ${i}`);
  }
  if (global.gc) global.gc();
  await new Promise(r => setTimeout(r, 2000));
  logMemory('Napi Post-GC Idle');
}

// 1. Create a basic HTTP Server to satisfy DigitalOcean App Platform
const server = http.createServer(async (req, res) => {
  // Health check route for DigitalOcean Ingress
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('OK');
  }

  // Trigger the benchmark test manually by visiting /test
  if (req.url === '/test') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('Benchmark started! Check your DigitalOcean console logs...\n');
    
    try {
      const rgbaBuffer = createMockRgbaBuffer();
      await runSharpTest(rgbaBuffer);
      await runNapiTest(rgbaBuffer);
      res.write('Benchmark completed successfully.\n');
    } catch (err) {
      console.error(err);
      res.write(`Error: ${err.message}\n`);
    }
    return res.end();
  }

  res.writeHead(404);
  res.end();
});

// DigitalOcean App Platform defaults to port 8080
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}. Health checks passing.`);
});
