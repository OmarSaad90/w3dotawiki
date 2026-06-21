import { validateSession } from './_auth.js';

const OWNER  = process.env.GITHUB_OWNER;
const REPO   = process.env.GITHUB_REPO;
const TOKEN  = process.env.GITHUB_TOKEN;
const HOOK   = process.env.VERCEL_DEPLOY_HOOK;
const ORIGIN = 'https://w3dotawiki.vercel.app';

const HERO_RE = /^[A-Za-z0-9 '\-\.]+$/;

function validateMatchup(matchup) {
  if (typeof matchup !== 'object' || matchup === null || Array.isArray(matchup))
    return 'matchup must be an object';
  for (const key of ['countered_by', 'counters', 'good_with']) {
    const arr = matchup[key];
    if (!Array.isArray(arr)) return `${key} must be an array`;
    if (arr.length > 8) return `${key} has too many entries (max 8)`;
    for (const name of arr) {
      if (typeof name !== 'string' || name.length < 2 || name.length > 60 || !HERO_RE.test(name))
        return `Invalid hero name in ${key}: ${name}`;
    }
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

function parseMatchups(js) {
  return new Function(js + '\nreturn HERO_MATCHUPS;')();
}

function serialize(matchups) {
  const lines = [
    `// Last edited: ${new Date().toISOString()}`,
    '',
    'const HERO_MATCHUPS = {',
  ];
  for (const [hero, m] of Object.entries(matchups)) {
    const cb = JSON.stringify(m.countered_by);
    const co = JSON.stringify(m.counters);
    const gw = JSON.stringify(m.good_with);
    lines.push(`  "${hero}": { countered_by:${cb}, counters:${co}, good_with:${gw} },`);
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

  const { heroName, matchup } = req.body || {};

  if (typeof heroName !== 'string' || heroName.length < 2 || heroName.length > 60 || !HERO_RE.test(heroName))
    return res.status(400).json({ error: 'Invalid heroName' });

  const validationError = validateMatchup(matchup);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const { content, sha } = await ghGet('matchups.js');
    const existing = parseMatchups(content);

    existing[heroName] = {
      countered_by: matchup.countered_by,
      counters: matchup.counters,
      good_with: matchup.good_with,
    };

    let status = await ghPut('matchups.js', serialize(existing), sha, `Admin: update matchups for ${heroName}`);

    if (status === 409) {
      const fresh = await ghGet('matchups.js');
      const freshMatchups = parseMatchups(fresh.content);
      freshMatchups[heroName] = { countered_by: matchup.countered_by, counters: matchup.counters, good_with: matchup.good_with };
      status = await ghPut('matchups.js', serialize(freshMatchups), fresh.sha, `Admin: update matchups for ${heroName}`);
      if (status === 409) return res.status(409).json({ error: 'Someone else just saved — please try again.' });
    }

    if (status < 200 || status >= 300) return res.status(502).json({ error: `GitHub write failed (HTTP ${status})` });

    if (HOOK) fetch(HOOK, { method: 'POST' }).catch(() => {});
    return res.status(200).json({ ok: true });

  } catch (e) {
    return res.status(500).json({ error: `Internal error: ${e.message}` });
  }
}
