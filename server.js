const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json());

let latestQrImage = null;
let isConnected = false;

// Initialize WhatsApp client with Puppeteer flags for cloud hosting
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  }
});

// Capture QR code and turn it into an image link
client.on('qr', async (qr) => {
  isConnected = false;
  try {
    latestQrImage = await QRCode.toDataURL(qr);
    console.log('New QR code generated. Visit /qr in your browser to scan.');
  } catch (err) {
    console.error('Failed to generate QR image:', err);
  }
});

client.on('ready', () => {
  isConnected = true;
  latestQrImage = null;
  console.log('✅ Eddy WhatsApp Server is connected and ready!');
});

client.on('disconnected', () => {
  isConnected = false;
  console.log('❌ WhatsApp disconnected. Re-initializing...');
});

// Route to view QR Code directly in the browser
app.get('/qr', (req, res) => {
  if (isConnected) {
    return res.send(`
      <div style="text-align: center; font-family: sans-serif; padding: 50px;">
        <h1 style="color: #008000;">✅ Connected!</h1>
        <p>Eddy is logged in and ready to send WhatsApp messages.</p>
      </div>
    `);
  }

  if (!latestQrImage) {
    return res.send(`
      <div style="text-align: center; font-family: sans-serif; padding: 50px;">
        <h1>Generating QR Code...</h1>
        <p>Please refresh the page in a few seconds.</p>
        <script>setTimeout(() => location.reload(), 3000);</script>
      </div>
    `);
  }

  res.send(`
    <div style="text-align: center; font-family: sans-serif; padding: 40px;">
      <h1>Scan with WhatsApp</h1>
      <p>Open WhatsApp on your phone > <b>Settings</b> > <b>Linked Devices</b> > <b>Link a Device</b></p>
      <img src="${latestQrImage}" style="width: 300px; height: 300px; border: 4px solid #000; border-radius: 12px; margin: 20px 0;" />
      <p><i>This page will reload automatically once connected.</i></p>
      <script>
        setInterval(async () => {
          const res = await fetch('/status');
          const data = await res.json();
          if (data.connected) location.reload();
        }, 3000);
      </script>
    </div>
  `);
});

// Status check route
app.get('/status', (req, res) => {
  res.json({ connected: isConnected });
});

// Send WhatsApp Message Route
app.post('/send-whatsapp', async (req, res) => {
  const { number, message } = req.body;

  if (!number || !message) {
    return res.status(400).json({ error: 'Number and message are required.' });
  }

  if (!isConnected) {
    return res.status(503).json({ error: 'WhatsApp client is not connected. Scan the QR code at /qr first.' });
  }

  const cleanNumber = number.replace(/[^0-9]/g, '');
  const formattedNumber = `${cleanNumber}@c.us`;

  try {
    await client.sendMessage(formattedNumber, message);
    res.json({ success: true, status: `Message sent to ${cleanNumber}` });
  } catch (error) {
    console.error('WhatsApp Send Error:', error);
    res.status(500).json({ error: 'Failed to send WhatsApp message.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Eddy Backend running on port ${PORT}`);
});

client.initialize();