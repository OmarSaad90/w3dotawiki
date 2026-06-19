const OWNER = process.env.GITHUB_OWNER;
const REPO  = process.env.GITHUB_REPO;
const TOKEN = process.env.GITHUB_TOKEN;
const PASS  = process.env.ADMIN_PASSWORD;
const HOOK  = process.env.VERCEL_DEPLOY_HOOK;

async function ghGet(path) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    headers: { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github.v3+json' },
  });
  if (!res.ok) throw new Error(`GitHub GET ${res.status}`);
  const d = await res.json();
  return { content: Buffer.from(d.content, 'base64').toString('utf8'), sha: d.sha };
}

async function ghPut(path, content, sha, message) {
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

function parseSkillBuilds(js) {
  return new Function(js + '\nreturn SKILL_BUILDS;')();
}

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

async function trySave(heroName, builds, sha) {
  const { content } = await ghGet('skill_builds.js');
  const existing = parseSkillBuilds(content);
  // Use the sha we already have, but if caller passes null fetch fresh
  let useSha = sha;
  if (!useSha) {
    const f = await ghGet('skill_builds.js');
    useSha = f.sha;
  }
  existing[heroName] = builds;
  const newContent = serialize(existing);
  return ghPut('skill_builds.js', newContent, useSha, `Admin: update ${heroName} skill build`);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!PASS || req.headers['x-admin-password'] !== PASS)
    return res.status(401).json({ error: 'Wrong password' });

  const { heroName, builds } = req.body || {};
  if (!heroName || !builds) return res.status(400).json({ error: 'Missing heroName or builds' });

  try {
    // First attempt
    const { sha } = await ghGet('skill_builds.js');
    const existing = parseSkillBuilds((await ghGet('skill_builds.js')).content);
    existing[heroName] = builds;
    let status = await ghPut('skill_builds.js', serialize(existing), sha, `Admin: update ${heroName} skill build`);

    // Conflict — retry once with fresh SHA
    if (status === 409) {
      const fresh = await ghGet('skill_builds.js');
      const freshBuilds = parseSkillBuilds(fresh.content);
      freshBuilds[heroName] = builds;
      status = await ghPut('skill_builds.js', serialize(freshBuilds), fresh.sha, `Admin: update ${heroName} skill build`);
      if (status === 409) return res.status(409).json({ error: 'Someone else just saved — please try again.' });
    }

    if (status < 200 || status >= 300) return res.status(500).json({ error: `GitHub error ${status}` });

    if (HOOK) fetch(HOOK, { method: 'POST' }).catch(() => {});
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
