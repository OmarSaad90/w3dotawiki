import { validateSession } from './_auth.js';

const OWNER  = process.env.GITHUB_OWNER;
const REPO   = process.env.GITHUB_REPO;
const TOKEN  = process.env.GITHUB_TOKEN;
const HOOK   = process.env.VERCEL_DEPLOY_HOOK;
const ORIGIN = 'https://w3dotawiki.vercel.app';

const HERO_RE    = /^[A-Za-z0-9 '\-\.]+$/;
const ABILITY_RE = /^[A-Za-z0-9 '\-\.\(\)!]+$/;
const SAFE_RE    = /^[^<>"\\]{1,100}$/;
const DESC_RE    = /^[^<>"\\]{1,600}$/;

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

function applyChanges(overrides, heroName, changes) {
  if (!overrides[heroName]) overrides[heroName] = {};
  for (const { abilityName, stats, desc } of changes) {
    if (!overrides[heroName][abilityName]) overrides[heroName][abilityName] = {};
    Object.assign(overrides[heroName][abilityName], stats);
    if (desc !== undefined) {
      if (desc) overrides[heroName][abilityName].desc = desc;
      else delete overrides[heroName][abilityName].desc;
    }
    for (const [k, v] of Object.entries(overrides[heroName][abilityName])) {
      if (k !== 'desc' && v === '') delete overrides[heroName][abilityName][k];
    }
    if (!Object.keys(overrides[heroName][abilityName]).length)
      delete overrides[heroName][abilityName];
  }
  if (!Object.keys(overrides[heroName]).length) delete overrides[heroName];
  return overrides;
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

  const { heroName, changes } = req.body || {};

  if (typeof heroName !== 'string' || heroName.length < 2 || heroName.length > 60 || !HERO_RE.test(heroName))
    return res.status(400).json({ error: 'Invalid heroName' });
  if (!Array.isArray(changes) || changes.length === 0 || changes.length > 10)
    return res.status(400).json({ error: 'changes must be a non-empty array (max 10)' });

  for (const c of changes) {
    if (typeof c.abilityName !== 'string' || c.abilityName.length < 1 || c.abilityName.length > 60 || !ABILITY_RE.test(c.abilityName))
      return res.status(400).json({ error: `Invalid abilityName: ${c.abilityName}` });
    if (typeof c.stats !== 'object' || c.stats === null || Array.isArray(c.stats))
      return res.status(400).json({ error: 'stats must be an object' });
    for (const [label, value] of Object.entries(c.stats)) {
      if (!SAFE_RE.test(label))
        return res.status(400).json({ error: `Invalid stat label: ${label}` });
      if (value !== '' && !SAFE_RE.test(value))
        return res.status(400).json({ error: `Invalid value for ${label}` });
    }
    if (c.desc !== undefined && c.desc !== '' && !DESC_RE.test(c.desc))
      return res.status(400).json({ error: `Invalid description for ${c.abilityName}` });
  }

  try {
    const { content, sha } = await ghGet('spell_overrides.json');
    const overrides = applyChanges(JSON.parse(content), heroName, changes);
    const newContent = JSON.stringify(overrides, null, 2);
    let status = await ghPut('spell_overrides.json', newContent, sha, `Admin: update spell values for ${heroName}`);

    if (status === 409) {
      const fresh = await ghGet('spell_overrides.json');
      const freshOverrides = applyChanges(JSON.parse(fresh.content), heroName, changes);
      status = await ghPut('spell_overrides.json', JSON.stringify(freshOverrides, null, 2), fresh.sha, `Admin: update spell values for ${heroName}`);
      if (status === 409) return res.status(409).json({ error: 'Someone else just saved — please try again.' });
    }

    if (status < 200 || status >= 300) return res.status(502).json({ error: `GitHub write failed (HTTP ${status})` });

    if (HOOK) fetch(HOOK, { method: 'POST' }).catch(() => {});
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: `Internal error: ${e.message}` });
  }
}
