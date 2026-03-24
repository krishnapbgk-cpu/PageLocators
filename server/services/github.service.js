const axios = require('axios');

const GITHUB_API = 'https://api.github.com';
const RELEVANT_EXTS = /\.(ts|js|tsx|jsx|json|yaml|yml|env|sql|md|config\.js|config\.ts)$/;

function parseRepoUrl(url) {
  const m = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!m) throw new Error('Invalid GitHub URL. Expected: https://github.com/owner/repo');
  return { owner: m[1], repo: m[2].replace(/\.git$/, '') };
}

function headers(pat) {
  const h = { Accept: 'application/vnd.github.v3+json' };
  if (pat) h.Authorization = `token ${pat}`;
  return h;
}

async function getFileTree(url, pat, branch = 'main') {
  const { owner, repo } = parseRepoUrl(url);
  const ref = branch || 'main';

  const { data } = await axios.get(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`,
    { headers: headers(pat), timeout: 10_000 }
  );

  return (data.tree || [])
    .filter(f => f.type === 'blob' && RELEVANT_EXTS.test(f.path))
    .map(f => ({ path: f.path, sha: f.sha, size: f.size, url: f.url }));
}

async function getFileContent(url, pat, filePath, branch = 'main') {
  const { owner, repo } = parseRepoUrl(url);
  const { data } = await axios.get(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
    { headers: headers(pat), timeout: 10_000 }
  );
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

async function getMultipleFiles(url, pat, paths, branch = 'main') {
  const results = await Promise.allSettled(
    paths.slice(0, 20).map(p => getFileContent(url, pat, p, branch))
  );
  return paths.reduce((acc, p, i) => {
    if (results[i].status === 'fulfilled') acc[p] = results[i].value;
    return acc;
  }, {});
}

module.exports = { getFileTree, getFileContent, getMultipleFiles, parseRepoUrl };
