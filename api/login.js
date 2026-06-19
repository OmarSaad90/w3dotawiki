import { makeToken, safeEq, setCookie } from './_auth.js';

const PASS = process.env.ADMIN_PASSWORD;

// In-memory rate limiter — best-effort per serverless instance
// Limits rapid burst attacks; strong password is the main defence
const attempts = new Map();
const MAX_ATTEMPTS  = 5;
const WINDOW_MS     = 15 * 60 * 1000;

function isLocked(ip) {
  const e = attempts.get(ip);
  if (!e) return false;
  if (Date.now() > e.resetAt) { attempts.delete(ip); return false; }
  return e.count >= MAX_ATTEMPTS;
}

function record(ip) {
  const now = Date.now();
  let e = attempts.get(ip);
  if (!e || now > e.resetAt) e = { count: 0, resetAt: now + WINDOW_MS };
  e.count++;
  attempts.set(ip, e);
  return e.count;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

  if (isLocked(ip)) {
    await sleep(1000); // don't respond instantly even when locked
    return res.status(429).json({ error: 'Too many failed attempts — wait 15 minutes and try again.' });
  }

  const { password } = req.body || {};

  // Baseline delay on every attempt — raises cost of automated guessing
  await sleep(300);

  if (!safeEq(password, PASS)) {
    const count = record(ip);
    // Escalating delay: 300ms, 600ms, 900ms … up to 2s
    await sleep(Math.min(300 * count, 2000));
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  const token = makeToken();
  res.setHeader('Set-Cookie', setCookie(token));
  return res.status(200).json({ ok: true });
}
