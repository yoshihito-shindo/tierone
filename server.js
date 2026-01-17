
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// 1. 基本設定
app.use(cors());
app.use(express.json());

// ログ出力設定
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_4eC39HqLyjWDarjtT1zdp7dc';
const stripe = require('stripe')(STRIPE_KEY);

// 2. APIエンドポイント (最優先で定義)
// 注意: /api/health へのリクエストが index.html に奪われないよう、静的ファイル配信より「上」に書きます

app.get('/api/health', (req, res) => {
  console.log('>>> API Health Check Called');
  res.setHeader('X-Luxe-API', 'true');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    status: 'online',
    identity: 'Luxe-Rose-System-v2',
    stripe_mode: STRIPE_KEY.startsWith('sk_live') ? 'live' : 'test',
    server_time: new Date().toISOString()
  });
});

app.post('/api/create-payment-intent', async (req, res) => {
  console.log('>>> Create Payment Intent Called');
  res.setHeader('X-Luxe-API', 'true');
  const { planId, amount } = req.body;
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency: 'jpy',
      metadata: { planId },
      automatic_payment_methods: { enabled: true },
    });
    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('[STRIPE ERROR]:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 3. 静的ファイル配信 (API以外のリクエストを処理)
// Renderのカレントディレクトリ (__dirname) を基準にします
app.use(express.static(__dirname));

// 4. SPAキャッチオール (重要)
// /api 以外への全てのアクセス（ブラウザのリロード等）に対して index.html を返します
app.get('*', (req, res) => {
  // もし /api へのアクセスがここまで漏れてきたら、それは 404 API です
  if (req.url.startsWith('/api/')) {
    console.warn(`[API 404 fallback] ${req.url}`);
    res.setHeader('X-Luxe-API', 'true');
    return res.status(404).json({ error: 'API not found', path: req.url });
  }

  const indexPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('System Error: Web assets missing.');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`
  ==========================================
  LUXE & ROSE SERVER IS LIVE
  Port: ${PORT}
  Environment: ${process.env.NODE_ENV || 'development'}
  ==========================================
  `);
});
