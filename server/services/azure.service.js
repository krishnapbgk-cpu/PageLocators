const axios = require('axios');

const AZURE_API = 'https://dev.azure.com';
const RELEVANT_EXTS = /\.(ts|js|tsx|jsx|json|yaml|yml|sql|md)$/;

function parseAzureUrl(url) {
  // Parse: https://[PAT]@dev.azure.com/{org}/{project}/_git/{repo}
  // or: https://dev.azure.com/{org}/{project}/_git/{repo}
  let pat = null;
  let cleanUrl = url;

  // Extract PAT if embedded in URL
  const patMatch = url.match(/https:\/\/([^@]+)@dev\.azure\.com/);
  if (patMatch) {
    pat = patMatch[1];
    cleanUrl = url.replace(`${pat}@`, '');
  }

  // Extract org, project, repo
  const match = cleanUrl.match(/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/(.+?)(?:\/|$)/);
  if (!match) {
    throw new Error('Invalid Azure DevOps URL. Expected: https://dev.azure.com/{org}/{project}/_git/{repo}/src');
  }

  return {
    org: match[1],
    project: decodeURIComponent(match[2]),
    repo: match[3].replace(/\.git$/, ''),
    pat: pat,
  };
}

function headers(pat) {
  return {
    Authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

async function getFileTree(orgOrUrl, project, repo, pat) {
  try {
    // Handle both URL format and separate parameters
    let org, actualPat;
    if (project === undefined && repo === undefined) {
      // URL format: getFileTree(url, pat)
      const parsed = parseAzureUrl(orgOrUrl);
      org = parsed.org;
      project = parsed.project;
      repo = parsed.repo;
      actualPat = pat || parsed.pat;
    } else {
      // Old format: getFileTree(org, project, repo, pat)
      org = orgOrUrl;
      actualPat = pat;
    }

    if (!org || !project || !repo || !actualPat) {
      throw new Error('Missing required parameters: org, project, repo, pat');
    }

    const url = `${AZURE_API}/${org}/${project}/_apis/git/repositories/${repo}/items?recursionLevel=Full&api-version=7.0`;
    const response = await axios.get(url, { 
      headers: headers(actualPat), 
      timeout: 10_000,
      validateStatus: (status) => status < 500 
    });
    
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Azure authentication failed (${response.status}). Check your PAT token.`);
    }
    if (response.status === 404) {
      throw new Error(`Repository not found (${response.status}). Check org, project, and repo names.`);
    }
    if (response.status >= 400) {
      throw new Error(`Azure API error (${response.status}): ${response.data?.message || 'Unknown error'}`);
    }

    const data = response.data;
    if (!data.value || !Array.isArray(data.value)) {
      throw new Error('Invalid response format from Azure API');
    }

    return data.value
      .filter(f => !f.isFolder && RELEVANT_EXTS.test(f.path))
      .map(f => ({ path: f.path, url: f.url }));
  } catch (err) {
    throw new Error(`Azure getFileTree failed: ${err.message}`);
  }
}

async function getFileContent(orgOrUrl, projectOrPat, repoOrPath, patOrUndefined, filePathOrUndefined) {
  try {
    // Handle both URL format and separate parameters
    let org, project, repo, pat, filePath;

    if (projectOrPat && !repoOrPath) {
      // URL format: getFileContent(url, pat, filePath)
      const parsed = parseAzureUrl(orgOrUrl);
      org = parsed.org;
      project = parsed.project;
      repo = parsed.repo;
      pat = projectOrPat || parsed.pat;
      filePath = repoOrPath;
    } else {
      // Old format: getFileContent(org, project, repo, pat, filePath)
      org = orgOrUrl;
      project = projectOrPat;
      repo = repoOrPath;
      pat = patOrUndefined;
      filePath = filePathOrUndefined;
    }

    if (!org || !project || !repo || !pat || !filePath) {
      throw new Error('Missing required parameters: org, project, repo, pat, filePath');
    }

    const encoded = encodeURIComponent(filePath);
    const url = `${AZURE_API}/${org}/${project}/_apis/git/repositories/${repo}/items?path=${encoded}&api-version=7.0`;
    const response = await axios.get(url, { 
      headers: headers(pat), 
      timeout: 10_000,
      validateStatus: (status) => status < 500 
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error(`Azure authentication failed (${response.status}). Check your PAT token.`);
    }
    if (response.status === 404) {
      throw new Error(`File not found (${response.status}): ${filePath}`);
    }
    if (response.status >= 400) {
      throw new Error(`Azure API error (${response.status}): ${response.data?.message || 'Unknown error'}`);
    }

    const data = response.data;
    return typeof data === 'string' ? data : JSON.stringify(data);
  } catch (err) {
    throw new Error(`Azure getFileContent failed: ${err.message}`);
  }
}

module.exports = { getFileTree, getFileContent, parseAzureUrl };
