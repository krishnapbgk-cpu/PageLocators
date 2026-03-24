/**
 * folderAccess.js
 *
 * Wraps the browser's File System Access API for:
 *  - Picking a local folder
 *  - Reading all relevant source files recursively
 *  - Writing generated test/page-object files back into the repo
 *
 * Falls back gracefully when the API is unavailable (Firefox < 111, Safari < 15.2).
 */

const READABLE_EXTS = /\.(ts|tsx|js|jsx|json|yaml|yml|env|sql|md|config\.ts|config\.js|spec\.ts|spec\.js|page\.ts|page\.js)$/i;
const SKIP_DIRS     = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.nyc_output', '__pycache__', '.venv']);

export const isFSASupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

/**
 * Open a native folder-picker dialog.
 * Returns { handle, name, files[] } or null if cancelled.
 *
 * Each entry in files[]:
 *   { path: 'relative/path/file.ts', content: '...', size: 123 }
 */
export async function pickFolder() {
  if (!isFSASupported()) throw new Error('File System Access API not supported in this browser. Use Chrome or Edge.');

  let dirHandle;
  try {
    dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch (err) {
    if (err.name === 'AbortError') return null; // user cancelled
    throw err;
  }

  const files = await readDirectory(dirHandle, '');
  return { handle: dirHandle, name: dirHandle.name, files };
}

/**
 * Recursively walk a FileSystemDirectoryHandle.
 * Returns flat array of { path, content, size }.
 */
async function readDirectory(dirHandle, prefix) {
  const results = [];
  for await (const [name, handle] of dirHandle) {
    const relPath = prefix ? `${prefix}/${name}` : name;

    if (handle.kind === 'directory') {
      if (!SKIP_DIRS.has(name)) {
        const nested = await readDirectory(handle, relPath);
        results.push(...nested);
      }
    } else if (handle.kind === 'file' && READABLE_EXTS.test(name)) {
      try {
        const file    = await handle.getFile();
        const content = await file.text();
        results.push({ path: relPath, name, content, size: file.size });
      } catch {
        // Skip files we can't read (binary, locked, etc.)
      }
    }
  }
  return results;
}

/**
 * Write a single generated file into the repo folder.
 *
 * @param {FileSystemDirectoryHandle} rootHandle  — from pickFolder()
 * @param {string}  filePath  — relative path e.g. "tests/e2e/login.spec.ts"
 * @param {string}  content   — file content
 */
export async function writeFileToRepo(rootHandle, filePath, content) {
  const parts = filePath.split('/').filter(Boolean);
  const fileName = parts.pop();

  // Traverse / create nested directories
  let current = rootHandle;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create: true });
  }

  const fileHandle = await current.getFileHandle(fileName, { create: true });
  const writable   = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

/**
 * Write multiple files at once.
 * Returns { written: string[], failed: { path, error }[] }
 */
export async function writeFilesToRepo(rootHandle, files) {
  const written = [], failed = [];
  for (const f of files) {
    try {
      await writeFileToRepo(rootHandle, f.path, f.content);
      written.push(f.path);
    } catch (err) {
      failed.push({ path: f.path, error: err.message });
    }
  }
  return { written, failed };
}

/**
 * Build a display tree from a flat file list (for the file tree UI).
 * Returns nested { name, type: 'dir'|'file', children?, path? }
 */
export function buildFileTree(files) {
  const root = { name: '', type: 'dir', children: {} };

  for (const f of files) {
    const parts = f.path.split('/');
    let node = root;
    parts.forEach((part, i) => {
      if (!node.children[part]) {
        node.children[part] = {
          name: part,
          type: i === parts.length - 1 ? 'file' : 'dir',
          path: parts.slice(0, i + 1).join('/'),
          children: {},
        };
      }
      node = node.children[part];
    });
  }

  return flattenTree(root.children);
}

function flattenTree(children) {
  return Object.values(children)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .map(n => ({ ...n, children: n.type === 'dir' ? flattenTree(n.children) : undefined }));
}
