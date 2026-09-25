import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createStore, sydneyDate, validateBooking } from './booking.js';
import { createApp } from './app.js';

const now = new Date('2026-09-25T00:00:00Z');
const valid = { name: 'Test Guest', email: 'guest@example.com', phone: '0412345678', date: '2026-09-26', time: '18:00', guests: 2, notes: '', consent: true };
test('valid requests are normalized', () => {
  const result = validateBooking({ ...valid, name: ' Test Guest ', email: 'GUEST@example.com' }, now);
  assert.deepEqual(result.errors, {}); assert.equal(result.value.name, 'Test Guest'); assert.equal(result.value.email, 'guest@example.com');
});
test('invalid contact, consent, party size and notes are rejected', () => {
  const { errors } = validateBooking({ ...valid, name: '', email: 'no', phone: 'x', consent: false, guests: 13, notes: 'a'.repeat(501) }, now);
  for (const field of ['name', 'email', 'phone', 'consent', 'guests', 'notes']) assert.ok(errors[field], field);
});
test('Wednesday, invalid dates and outside booking window are rejected', () => {
  for (const date of ['2026-09-30', '2026-02-30', '2026-09-24', '2027-01-01', 'bad']) assert.ok(validateBooking({ ...valid, date }, now).errors.date);
});
test('past Sydney times and invalid slots are rejected', () => {
  assert.ok(validateBooking({ ...valid, date: '2026-09-25', time: '09:00' }, now).errors.time);
  for (const time of ['19:30', '20:00', '08:30', '12:15']) assert.ok(validateBooking({ ...valid, time }, now).errors.time);
});
test('date is Sydney-local across midnight and daylight saving', () => {
  assert.equal(sydneyDate(new Date('2026-09-25T15:00:00Z')), '2026-09-26');
  assert.equal(sydneyDate(new Date('2026-12-01T13:30:00Z')), '2026-12-02');
});
test('store is idempotent and rejects changed details', () => {
  const store = createStore(':memory:');
  try { const id = randomUUID(); const first = store.save(id, valid); const second = store.save(id, valid);
    assert.equal(first.reference, second.reference); assert.equal(second.duplicate, true);
    assert.equal(store.save(id, { ...valid, guests: 4 }).conflict, true);
  } finally { store.close(); }
});
test('live mode cannot start without delivery configuration', () => {
  assert.throws(() => createApp({ store: null, bookingMode: 'live' }), /HTTPS booking webhook/);
});
async function withServer(fn) {
  const store = createStore(':memory:'); const app = createApp({ store });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { await new Promise(resolve => server.close(resolve)); store.close(); }
}
function futureBooking() {
  for (let i = 1; i < 7; i++) { const date = sydneyDate(new Date(Date.now() + i * 86400000)); if (new Date(`${date}T12:00:00Z`).getUTCDay() !== 3) return { ...valid, date }; }
}
test('HTTP booking persists, retries safely, and never claims confirmation', async () => withServer(async base => {
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(), Origin: base }, body: JSON.stringify(futureBooking()) };
  const first = await fetch(`${base}/api/bookings`, options); assert.equal(first.status, 201);
  const result = await first.json(); assert.equal(result.status, 'pending'); assert.equal(result.preview, true); assert.ok(result.reference.startsWith('VB-'));
  const second = await fetch(`${base}/api/bookings`, options); assert.equal(second.status, 200); assert.equal((await second.json()).reference, result.reference);
  const conflict = await fetch(`${base}/api/bookings`, { ...options, body: JSON.stringify({ ...futureBooking(), guests: 6 }) }); assert.equal(conflict.status, 409);
}));
test('HTTP rejects foreign origins, malformed bodies and validation failures', async () => withServer(async base => {
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }, body: JSON.stringify(futureBooking()) };
  assert.equal((await fetch(`${base}/api/bookings`, { ...options, headers: { ...options.headers, Origin: 'https://untrusted.example' } })).status, 403);
  assert.equal((await fetch(`${base}/api/bookings`, { ...options, body: '{broken' })).status, 400);
  const invalid = await fetch(`${base}/api/bookings`, { ...options, body: JSON.stringify({ ...futureBooking(), guests: 0 }) });
  assert.equal(invalid.status, 422); assert.ok((await invalid.json()).errors.guests);
  assert.equal((await fetch(`${base}/api/bookings`)).status, 404);
}));
test('HTTP rate limit bounds repeated attempts', async () => withServer(async base => {
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }, body: '{}' };
  for (let i = 0; i < 15; i++) await fetch(`${base}/api/bookings`, options);
  const response = await fetch(`${base}/api/bookings`, options); assert.equal(response.status, 429); assert.equal(response.headers.get('Retry-After'), '900');
}));
