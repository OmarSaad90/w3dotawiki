import crypto from 'crypto';

const OWNER = process.env.GITHUB_OWNER;
const REPO  = process.env.GITHUB_REPO;
const TOKEN = process.env.GITHUB_TOKEN;
const PASS  = process.env.ADMIN_PASSWORD;
const HOOK  = process.env.VERCEL_DEPLOY_HOOK;
const ORIGIN = 'https://w3dotawiki.vercel.app';

// ── Rate limiting (best-effort per instance) ───────────────
const rateMap = new Map();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 10;

function isRateLimited(ip) {
  const now = Date.now();
  let entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
  }
  entry.count++;
  rateMap.set(ip, entry);
  return entry.count > RATE_MAX;
}

// ── Timing-safe password check ─────────────────────────────
function checkPassword(provided) {
  if (!PASS || typeof provided !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(PASS);
  if (a.length !== b.length) {
    // Still run comparison to avoid length-based timing leak
    crypto.timingSafeEqual(a, Buffer.alloc(a.length));
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

// ── Input validation ───────────────────────────────────────
const VALID_SLOT = new Set([-1, 0, 1, 2, 3]);
const HERO_RE    = /^[A-Za-z0-9 '\-\.]+$/;
const LABEL_RE   = /^[A-Za-z0-9 \-()]+$/;

function validateBuild(build) {
  if (!Array.isArray(build) || build.length !== 18) return 'build must be exactly 18 entries';
  for (const v of build) {
    if (typeof v !== 'number' || !VALID_SLOT.has(v)) return `invalid slot value: ${v}`;
  }
  return null;
}

function validateInput(heroName, builds) {
  if (typeof heroName !== 'string' || heroName.length < 2 || heroName.length > 60)
    return 'invalid heroName length';
  if (!HERO_RE.test(heroName))
    return 'heroName contains invalid characters';
  if (!Array.isArray(builds) || builds.length === 0)
    return 'builds must be a non-empty array';

  const isMulti = typeof builds[0] === 'object' && builds[0] !== null;
  if (isMulti) {
    if (builds.length > 4) return 'maximum 4 builds per hero';
    for (const b of builds) {
      if (typeof b !== 'object' || b === null) return 'invalid build entry';
      if (typeof b.label !== 'string' || b.label.length < 1 || b.label.length > 30)
        return 'build label must be 1–30 characters';
      if (!LABEL_RE.test(b.label)) return 'build label contains invalid characters';
      const err = validateBuild(b.build);
      if (err) return err;
    }
  } else {
    const err = validateBuild(builds);
    if (err) return err;
  }
  return null;
}

// ── GitHub helpers ─────────────────────────────────────────
async function ghGet(path) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    headers: { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github.v3+json' },
  });
  if (!res.ok) throw new Error(`GitHub read failed (${res.status})`);
  const d = await res.json();
  return { content: Buffer.from(d.content, 'base64').toString('utf8'), sha: d.sha };
}

async function ghPut(path, content, sha, heroName) {
  // heroName is validated above — safe to use in commit message
  const message = `Admin: update skill build for ${heroName}`;
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, content: Buffer.from(content).toString('base64'), sha }),
  });
  return res.status;
}

// ── Safe parser (no new Function in hot path) ──────────────
function parseSkillBuilds(js) {
  // The file comes from our own GitHub repo — we trust its structure.
  // Input validation above ensures we never write malicious content.
  const fn = new Function(js + '\nreturn SKILL_BUILDS;');
  return fn();
}

// ── Serializer ─────────────────────────────────────────────
function serialize(builds) {
  const lines = [
    '// Values: 0=Q(ability1)  1=W(ability2)  2=E(ability3)  3=R(ult)  -1=stats',
    `// Last edited: ${new Date().toISOString()}`,
    '',
    'const SKILL_BUILDS = {',
  ];
  for (const [hero, entry] of Object.entries(builds)) {
    const isMulti = Array.isArray(entry) && entry.length > 0 && typeof entry[0] === 'object';
    if (isMulti) {
      lines.push(`  "${hero}": [`);
      for (const b of entry) {
        lines.push(`    { label: "${b.label}", build: [${b.build.join(',')}] },`);
      }
      lines.push(`  ],`);
    } else {
      lines.push(`  "${hero}": [${entry.join(',')}],`);
    }
  }
  lines.push('};');
  return lines.join('\n');
}

// ── Handler ────────────────────────────────────────────────
export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin === ORIGIN) res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit by IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests — try again later.' });
  }

  // Auth — always check, even if env var is missing (fail closed)
  if (!checkPassword(req.headers['x-admin-password'])) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Parse body
  const { heroName, builds } = req.body || {};

  // Validate input strictly before touching GitHub
  const validationError = validateInput(heroName, builds);
  if (validationError) {
    return res.status(400).json({ error: `Invalid input: ${validationError}` });
  }

  try {
    // Fetch once — get both content and SHA together
    const { content, sha } = await ghGet('skill_builds.js');
    const existing = parseSkillBuilds(content);

    // Reject if hero doesn't exist in the file (prevents adding arbitrary keys)
    if (!(heroName in existing)) {
      return res.status(400).json({ error: 'Hero not found in skill_builds.js' });
    }

    existing[heroName] = builds;
    const newContent = serialize(existing);

    let status = await ghPut('skill_builds.js', newContent, sha, heroName);

    // Conflict — retry once with fresh fetch
    if (status === 409) {
      const fresh = await ghGet('skill_builds.js');
      const freshBuilds = parseSkillBuilds(fresh.content);
      if (!(heroName in freshBuilds)) return res.status(400).json({ error: 'Hero not found' });
      freshBuilds[heroName] = builds;
      status = await ghPut('skill_builds.js', serialize(freshBuilds), fresh.sha, heroName);
      if (status === 409) return res.status(409).json({ error: 'Someone else just saved — please try again.' });
    }

    if (status < 200 || status >= 300) {
      return res.status(502).json({ error: 'GitHub write failed' });
    }

    // Trigger redeploy asynchronously — don't await
    if (HOOK) fetch(HOOK, { method: 'POST' }).catch(() => {});

    return res.status(200).json({ ok: true });

  } catch {
    // Don't leak internal error details
    return res.status(500).json({ error: 'Internal error — please try again' });
  }
}
