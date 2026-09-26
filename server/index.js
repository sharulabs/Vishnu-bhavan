import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

import { createStore } from './booking.js';
import { createApp } from './app.js';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

const dataDir =
  process.env.DATA_DIR || path.join(root, 'data');

mkdirSync(dataDir, { recursive: true });

const store = createStore(
  path.join(dataDir, 'bookings.sqlite')
);

const app = createApp({
  store,
  bookingMode: process.env.BOOKING_MODE || 'preview',
  webhookUrl: process.env.BOOKING_WEBHOOK_URL,
  webhookToken: process.env.BOOKING_WEBHOOK_TOKEN,
  publicOrigin: process.env.PUBLIC_ORIGIN
});

if (process.argv.includes('--production')) {
  app.use(express.static(path.join(root, 'dist')));

  app.get('/', (_req, res) => {
    res.sendFile(path.join(root, 'dist', 'index.html'));
  });
} else {
  const { createServer } = await import('vite');

  const vite = await createServer({
    root,
    server: {
      middlewareMode: true
    },
    appType: 'spa'
  });

  app.use(vite.middlewares);
}

const port = Number(process.env.PORT || 3000);

app.listen(port, '0.0.0.0', () => {
  console.log(`Vishnu Bhavan ready on port ${port}`);
});