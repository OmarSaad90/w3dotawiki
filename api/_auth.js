// Shared auth helpers — prefixed _ so Vercel does not expose this as a route
import crypto from 'crypto';

const SECRET  = process.env.SESSION_SECRET;
const TTL_SEC = 8 * 3600; // 8-hour sessions

export function makeToken() {
  if (!SECRET) throw new Error('SESSION_SECRET not set');
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TTL_SEC * 1000 })).toString('base64url');
  const sig     = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function validateSession(cookieHeader) {
  if (!SECRET || !cookieHeader) return false;
  const match = cookieHeader.match(/(?:^|;\s*)w3admin=([A-Za-z0-9_\-\.]+)/);
  if (!match) return false;
  const token = match[1];
  const dot   = token.lastIndexOf('.');
  if (dot < 1) return false;
  const payload  = token.slice(0, dot);
  const sig      = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  // Timing-safe signature comparison
  const eb = Buffer.from(expected), sb = Buffer.from(sig);
  if (eb.length !== sb.length) { crypto.timingSafeEqual(eb, Buffer.alloc(eb.length)); return false; }
  if (!crypto.timingSafeEqual(eb, sb)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && Date.now() < exp;
  } catch { return false; }
}

export function safeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a), bb = Buffer.from(b);
  if (ba.length !== bb.length) { crypto.timingSafeEqual(ba, Buffer.alloc(ba.length)); return false; }
  return crypto.timingSafeEqual(ba, bb);
}

export const setCookie  = (token) => `w3admin=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TTL_SEC}`;
export const clearCookie = ()      => `w3admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
