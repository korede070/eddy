const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json());

let latestQrImage = null;
let isConnected = false;

// Initialize WhatsApp client using LocalAuth
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: '/tmp/.wwebjs_auth'
  }),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
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

client.on('qr', async (qr) => {
  isConnected = false;
  try {
    latestQrImage = await QRCode.toDataURL(qr);
    console.log('New QR code generated.');
  } catch (err) {
    console.error('Failed to generate QR image:', err);
  }
});

client.on('ready', () => {
  isConnected = true;
  latestQrImage = null;
  console.log('✅ Eddy WhatsApp Server is connected!');
});

client.on('authenticated', () => {
  console.log(' Authenticated successfully.');
});

client.on('auth_failure', (msg) => {
  isConnected = false;
  console.error(' Authentication failure:', msg);
});

client.on('disconnected', (reason) => {
  isConnected = false;
  latestQrImage = null;
  console.log('❌ WhatsApp disconnected:', reason);
  client.initialize();
});

// Endpoint 1: QR Code View
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
        <p>Please wait 5 seconds and refresh the page.</p>
        <script>setTimeout(() => location.reload(), 5000);</script>
      </div>
    `);
  }

  res.send(`
    <div style="text-align: center; font-family: sans-serif; padding: 40px;">
      <h1>Scan with WhatsApp</h1>
      <p>Open WhatsApp > <b>Settings</b> > <b>Linked Devices</b> > <b>Link a Device</b></p>
      <img src="${latestQrImage}" style="width: 300px; height: 300px; border: 4px solid #000; border-radius: 12px; margin: 20px 0;" />
      <p><i>Page refreshes automatically when connected.</i></p>
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

// Endpoint 2: Connection Status Check
app.get('/status', (req, res) => {
  res.json({ connected: isConnected });
});

// Endpoint 3: Send WhatsApp Message
app.post('/send-whatsapp', async (req, res) => {
  const { number, message } = req.body;

  if (!number || !message) {
    return res.status(400).json({ error: 'Number and message required.' });
  }

  if (!isConnected) {
    return res.status(503).json({ error: 'WhatsApp client is not connected. Scan /qr first.' });
  }

  const cleanNumber = number.replace(/[^0-9]/g, '');
  const formattedNumber = `${cleanNumber}@c.us`;

  try {
    await client.sendMessage(formattedNumber, message);
    res.json({ success: true, status: `Message sent to ${cleanNumber}` });
  } catch (error) {
    console.error('WhatsApp Error:', error);
    res.status(500).json({ error: 'Failed to send WhatsApp message.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Eddy Backend running on port ${PORT}`);
});

client.initialize();
