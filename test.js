const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Transformer } = require('@napi-rs/image');
const http = require('http');

const app = express();
app.use(express.json());

// Initialize S3/Spaces Client using environment variables
const s3Client = new S3Client({
  endpoint: `https://${process.env.SPACES_REGION}.digitaloceanspaces.com`,
  region: process.env.SPACES_REGION,
  credentials: {
    accessKeyId: process.env.SPACES_KEY,
    secretAccessKey: process.env.SPACES_SECRET,
  },
});

// Health check endpoint for DigitalOcean App Platform
app.get('/', (req, res) => res.send('OK'));

// The main optimization endpoint
app.post('/upload-and-optimize', async (req, res) => {
  const { imageUrl } = req.body; // Pass any image URL to test with
  
  if (!imageUrl) {
    return res.status(400).json({ error: 'Missing imageUrl in request body' });
  }

  try {
    console.log(`[Start] Fetching image from: ${imageUrl}`);
    
    // 1. Download the image into memory buffer
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    console.log(`[Processing] Ingesting into @napi-rs/image...`);
    // 2. Convert to WebP via Napi
    const transformer = new Transformer(inputBuffer);
    transformer.resize(1200); // Scale down width cleanly
    const webpBuffer = await transformer.webp(80); // Encode to 80% quality webp

    // 3. Define unique storage key path
    const fileKey = `processed/image_${Date.now()}.webp`;

    console.log(`[Spaces] Uploading to bucket: ${process.env.SPACES_BUCKET}`);
    // 4. Send to DigitalOcean Spaces
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.SPACES_BUCKET,
      Key: fileKey,
      Body: webpBuffer,
      ContentType: 'image/webp',
      ACL: 'public-read' // Makes it accessible via CDN URL
    }));

    const finalCdnUrl = `https://${process.env.SPACES_BUCKET}.${process.env.SPACES_REGION}.digitaloceanspaces.com/${fileKey}`;
    console.log(`[Success] Saved to ${finalCdnUrl}`);

    res.json({ success: true, url: finalCdnUrl });
  } catch (error) {
    console.error('[Error Details]:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Image pipeline app listening on port ${PORT}`);
});
