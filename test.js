const sharp = require('sharp');
const { Transformer } = require('@napi-rs/image');

const logMemory = (step) => {
  const memory = process.memoryUsage();
  console.log(`[${step}] RSS: ${(memory.rss / 1024 / 1024).toFixed(2)} MB | Heap Used: ${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
};

const WIDTH = 4000;
const HEIGHT = 3000;

// Create a raw RGBA pixel buffer (4 bytes per pixel: R, G, B, A)
function createMockRgbaBuffer() {
  return Buffer.alloc(WIDTH * HEIGHT * 4, 255); // Plain white canvas with 100% alpha
}

async function runSharpTest(rgbaBuffer, iterations = 20) {
  console.log('\n--- Starting Sharp Processing Run ---');
  logMemory('Initial');
  
  for (let i = 0; i < iterations; i++) {
    await sharp(rgbaBuffer, {
      raw: {
        width: WIDTH,
        height: HEIGHT,
        channels: 4 // Using 4 channels for RGBA matching
      }
    })
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
    // Correct API call for napi-rs/image
    const transformer = Transformer.fromRgbaPixels(rgbaBuffer, WIDTH, HEIGHT);
    transformer.resize(800);
    await transformer.webp(80);
    
    if (i % 5 === 0) logMemory(`Loop ${i}`);
  }

  if (global.gc) global.gc();
  await new Promise(r => setTimeout(r, 2000));
  logMemory('Napi Post-GC Idle');
}

async function main() {
  const rgbaBuffer = createMockRgbaBuffer();
  
  // Test 1: Sharp
  await runSharpTest(rgbaBuffer);
  
  // Test 2: NAPI-rs
  await runNapiTest(rgbaBuffer);
}

main().catch(console.error);
