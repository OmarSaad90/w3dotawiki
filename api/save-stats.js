import { validateSession } from './_auth.js';

const OWNER  = process.env.GITHUB_OWNER;
const REPO   = process.env.GITHUB_REPO;
const TOKEN  = process.env.GITHUB_TOKEN;
const HOOK   = process.env.VERCEL_DEPLOY_HOOK;
const ORIGIN = 'https://w3dotawiki.vercel.app';

const HERO_RE = /^[A-Za-z0-9 '\-\.]+$/;
const STAT_RE = /^[0-9+\-\.\/]+$/;

const STAT_KEYS = ['str','agi','int','hpPerLvl','mpPerLvl','range','as','ms','dmg','armor','hp','mp'];

function validateStats(stats) {
  if (typeof stats !== 'object' || stats === null || Array.isArray(stats))
    return 'stats must be an object';
  for (const key of Object.keys(stats)) {
    if (!STAT_KEYS.includes(key)) return `Unknown stat field: ${key}`;
    const val = stats[key];
    if (typeof val !== 'string') return `${key} must be a string`;
    if (val.length === 0 || val.length > 30) return `${key} value invalid length`;
    if (!STAT_RE.test(val)) return `${key} contains invalid characters`;
  }
  return null;
}

async function ghGet(path) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    headers: { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github.v3+json' },
  });
  if (!res.ok) throw new Error(`GitHub read failed (${res.status})`);
  const d = await res.json();
  return { content: Buffer.from(d.content, 'base64').toString('utf8'), sha: d.sha };
}

async function ghPut(path, content, sha, msg) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: msg, content: Buffer.from(content).toString('base64'), sha }),
  });
  return res.status;
}

function parseStats(js) {
  return new Function(js + '\nreturn HERO_STATS;')();
}

function serializeStats(heroStats) {
  const lines = [
    `// Last edited: ${new Date().toISOString()}`,
    '',
    'const HERO_STATS = {',
  ];
  for (const [hero, s] of Object.entries(heroStats)) {
    const fields = STAT_KEYS
      .filter(k => s[k] !== undefined)
      .map(k => `${k}:"${s[k]}"`)
      .join(', ');
    lines.push(`  "${hero}": {${fields}},`);
  }
  lines.push('};');
  return lines.join('\n');
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin === ORIGIN) res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!validateSession(req.headers.cookie))
    return res.status(401).json({ error: 'Not authenticated' });

  const { heroName, stats } = req.body || {};

  if (typeof heroName !== 'string' || heroName.length < 2 || heroName.length > 60 || !HERO_RE.test(heroName))
    return res.status(400).json({ error: 'Invalid heroName' });

  const validationError = validateStats(stats);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const { content, sha } = await ghGet('hero_stats.js');
    const existing = parseStats(content);

    existing[heroName] = { ...existing[heroName], ...stats };

    let status = await ghPut('hero_stats.js', serializeStats(existing), sha, `Admin: update base stats for ${heroName}`);

    if (status === 409) {
      const fresh = await ghGet('hero_stats.js');
      const freshStats = parseStats(fresh.content);
      freshStats[heroName] = { ...freshStats[heroName], ...stats };
      status = await ghPut('hero_stats.js', serializeStats(freshStats), fresh.sha, `Admin: update base stats for ${heroName}`);
      if (status === 409) return res.status(409).json({ error: 'Someone else just saved — please try again.' });
    }

    if (status < 200 || status >= 300) return res.status(502).json({ error: `GitHub write failed (HTTP ${status})` });

    if (HOOK) fetch(HOOK, { method: 'POST' }).catch(() => {});
    return res.status(200).json({ ok: true });

  } catch (e) {
    return res.status(500).json({ error: `Internal error: ${e.message}` });
  }
}
