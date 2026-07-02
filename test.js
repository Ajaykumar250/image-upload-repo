// 1. IMPORT STATEMENTS
const express = require('express');
const { S3Client, PutObjectCommand, ListBucketsCommand } = require('@aws-sdk/client-s3');
const { Transformer } = require('@napi-rs/image');

// 2. INITIALIZE EXPRESS APPLICATION
const app = express();
app.use(express.json());

// 3. INITIALIZE S3 / DIGITALOCEAN SPACES CLIENT
const s3Client = new S3Client({
  endpoint: `https://${process.env.SPACES_REGION}.digitaloceanspaces.com`,
  region: process.env.SPACES_REGION,
  credentials: {
    accessKeyId: process.env.SPACES_KEY,
    secretAccessKey: process.env.SPACES_SECRET,
  },
});

// 4. HEALTH CHECK ROUTE (For App Platform deployment verification)
app.get('/', (req, res) => res.send('OK'));

// 5. NEW TEST ENDPOINT (The verification check route)
app.get('/test-spaces', async (req, res) => {
  try {
    console.log('[Spaces Test] Sending ListBucketsCommand...');
    
    // Attempt to pull bucket lists using the active client credentials
    const data = await s3Client.send(new ListBucketsCommand({}));
    
    console.log('[Spaces Test] Connection Successful!');
    
    res.json({
      success: true,
      message: 'Successfully authenticated and connected to DigitalOcean Spaces!',
      buckets: data.Buckets ? data.Buckets.map(b => b.Name) : []
    });
  } catch (error) {
    console.error('[Spaces Test Error]:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to authenticate with DigitalOcean Spaces.',
      error: error.message,
      code: error.$metadata?.httpStatusCode || 'Unknown'
    });
  }
});

// 6. MAIN WORKFLOW ENDPOINT (Download -> Process with Napi -> Upload)
app.post('/upload-and-optimize', async (req, res) => {
  const { imageUrl } = req.body;
  
  if (!imageUrl) {
    return res.status(400).json({ error: 'Missing imageUrl in request body' });
  }

  try {
    console.log(`[Start] Fetching image from: ${imageUrl}`);
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    console.log(`[Processing] Ingesting into @napi-rs/image...`);
    const transformer = new Transformer(inputBuffer);
    transformer.resize(1200); 
    const webpBuffer = await transformer.webp(80); 

    const fileKey = `processed/image_${Date.now()}.webp`;

    console.log(`[Spaces] Uploading to bucket: ${process.env.SPACES_BUCKET}`);
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.SPACES_BUCKET,
      Key: fileKey,
      Body: webpBuffer,
      ContentType: 'image/webp',
      ACL: 'public-read' 
    }));

    const finalCdnUrl = `https://${process.env.SPACES_BUCKET}.${process.env.SPACES_REGION}.digitaloceanspaces.com/${fileKey}`;
    console.log(`[Success] Saved to ${finalCdnUrl}`);

    res.json({ success: true, url: finalCdnUrl });
  } catch (error) {
    console.error('[Error Details]:', error);
    res.status(500).json({ error: error.message });
  }
});

// 7. LISTEN ON ENVIRONMENT SPECIFIED PORT
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Image pipeline app listening on port ${PORT}`);
});
