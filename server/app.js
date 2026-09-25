import express from 'express';
import { validateBooking } from './booking.js';

export function createApp({ store, bookingMode = 'preview', webhookUrl, webhookToken, publicOrigin }) {
  if (bookingMode === 'live' && (!webhookUrl || !webhookUrl.startsWith('https://') || !publicOrigin)) throw new Error('Live booking requires an HTTPS booking webhook and PUBLIC_ORIGIN.');
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY' });
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '8kb' }));
  app.get('/api/config', (_req, res) => res.json({ bookingMode }));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  const attempts = new Map();
  const inFlight = new Set();
  app.post('/api/bookings', async (req, res) => {
    const expectedOrigin = publicOrigin || `http://${req.get('host')}`;
    if (req.get('origin') && req.get('origin') !== expectedOrigin) return res.status(403).json({ message: 'Please submit from this website.' });
    if (!req.is('application/json')) return res.status(415).json({ message: 'Please send JSON.' });
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ message: 'Invalid request.' });
    const now = Date.now();
    for (const [key, entry] of attempts) if (now > entry.expires) attempts.delete(key);
    const entry = attempts.get(req.ip) || { count: 0, expires: now + 15 * 60000 };
    entry.count++; attempts.set(req.ip, entry);
    if (entry.count > 15) { res.set('Retry-After', '900'); return res.status(429).json({ message: 'Too many requests. Please try again later or call us.' }); }
    const requestId = req.get('Idempotency-Key');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId || '')) return res.status(400).json({ message: 'Invalid request reference. Refresh and try again.' });
    const { errors, value } = validateBooking(req.body);
    if (Object.keys(errors).length) return res.status(422).json({ message: 'Please check the highlighted details.', errors });
    if (inFlight.has(requestId)) return res.status(409).json({ message: 'This request is still being processed. Please try again shortly.' });
    inFlight.add(requestId);
    try {
      const result = store.save(requestId, value);
      if (result.conflict) return res.status(409).json({ message: 'This reference has different details. Start a new request.' });
      if (bookingMode === 'live' && !result.delivered) {
        const response = await fetch(webhookUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': result.reference, ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {}) },
          body: JSON.stringify({ reference: result.reference, status: 'pending', ...value }), signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error('Delivery failed');
        store.markDelivered(result.reference);
      }
      return res.status(result.duplicate ? 200 : 201).json({ reference: result.reference, status: 'pending', preview: bookingMode !== 'live' });
    } catch {
      return res.status(503).json({ message: 'We could not complete your request. Retry with the same details, or call (02) 9682 6926.' });
    } finally { inFlight.delete(requestId); }
  });
  app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found.' }));
  app.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400).json({ message: 'The request could not be read. Check your details and try again.' }));
  return app;
}
