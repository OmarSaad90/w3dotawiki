import { validateSession } from './_auth.js';

export default function handler(req, res) {
  if (validateSession(req.headers.cookie)) {
    return res.status(200).json({ ok: true });
  }
  return res.status(401).json({ error: 'Not authenticated' });
}
