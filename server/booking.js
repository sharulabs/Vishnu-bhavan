import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export function sydneyDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function validateBooking(input, now = new Date()) {
  const errors = {};
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
  if (name.length < 2 || name.length > 80) errors.name = 'Please enter your name (2–80 characters).';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid email address.';
  if (!/^[+\d ()-]{8,24}$/.test(phone) || phone.replace(/\D/g, '').length < 8) errors.phone = 'Please enter a valid phone number.';
  const today = sydneyDate(now);
  const latest = sydneyDate(new Date(now.getTime() + 90 * 86400000));
  const date = typeof input.date === 'string' ? input.date : '';
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date < today || date > latest) errors.date = 'Choose a date within the next 90 days.';
  else if (parsed.getUTCDay() === 3) errors.date = 'Wednesday is listed as closed. Please choose another day.';
  const time = typeof input.time === 'string' ? input.time : '';
  if (!/^(09|1[0-8]):(00|30)$/.test(time) && time !== '19:00') errors.time = 'Choose a time between 9:00 am and 7:00 pm.';
  if (date === today) {
    const localTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
    if (time <= localTime) errors.time = 'Please choose a future time (Sydney time).';
  }
  if (!Number.isInteger(input.guests) || input.guests < 1 || input.guests > 12) errors.guests = 'Choose between 1 and 12 guests. Call us for larger groups.';
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  if (notes.length > 500) errors.notes = 'Please keep your message under 500 characters.';
  if (input.consent !== true) errors.consent = 'Please allow us to use your details to respond to your request.';
  return { errors, value: { name, email, phone, date, time, guests: input.guests, notes } };
}

export function createStore(path) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS booking_requests (
    request_id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, payload TEXT NOT NULL,
    created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', delivered INTEGER NOT NULL DEFAULT 0
  )`);
  return {
    save(requestId, value) {
      const payload = JSON.stringify(value);
      const previous = db.prepare('SELECT reference, payload, delivered FROM booking_requests WHERE request_id = ?').get(requestId);
      if (previous) {
        if (previous.payload !== payload) return { conflict: true };
        return { reference: previous.reference, duplicate: true, delivered: Boolean(previous.delivered) };
      }
      const reference = `VB-${randomUUID().slice(0, 8).toUpperCase()}`;
      db.prepare('INSERT INTO booking_requests(request_id, reference, payload, created_at) VALUES (?, ?, ?, ?)').run(requestId, reference, payload, new Date().toISOString());
      return { reference, duplicate: false, delivered: false };
    },
    markDelivered(reference) { db.prepare('UPDATE booking_requests SET delivered = 1 WHERE reference = ?').run(reference); },
    close() { db.close(); }
  };
}
