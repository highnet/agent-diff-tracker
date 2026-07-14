const HARD_EXCLUDE_SEGMENTS = new Set([
  '.git',
  'node_modules',
  '.next',
  '.nuxt',
  '.impeccable',
  'dist',
  'out',
  'build',
  '__pycache__',
  '.venv',
  'venv',
  '.mypy_cache',
  '.pytest_cache',
  '.ruff_cache',
  'target',
  '.gradle',
  'vendor',
  '.bundle',
  'Pods',
  'DerivedData',
  '.terraform',
  '.idea',
  'graphify-out',
]);
const HARD_EXCLUDE_SUFFIXES = ['.tsbuildinfo', '.log', '.pyc', '.class', '.o', '.obj'];

const REGEX_SPECIALS = new Set(['.', '+', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\']);

// Single-pass glob compiler. Deliberately not placeholder/replace-based: an earlier
// implementation substituted marker strings and re-replaced them, which corrupted any
// pattern whose literal text happened to contain a marker.
const globToRegex = (pattern: string): RegExp => {
  let out = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        if (pattern[i + 2] === '/') {
          // `**/` — any number of leading directories, including none.
          out += '(?:.*/)?';
          i += 3;
        } else {
          out += '.*';
          i += 2;
        }
      } else {
        out += '[^/]*';
        i += 1;
      }
    } else if (ch === '?') {
      out += '.';
      i += 1;
    } else if (ch === '/' && pattern.startsWith('/**', i) && (i + 3 === pattern.length || pattern[i + 3] === '/')) {
      // `/**` as a full segment — this directory itself or anything inside it.
      out += '(?:/.*)?';
      i += 3;
    } else {
      out += REGEX_SPECIALS.has(ch) ? `\\${ch}` : ch;
      i += 1;
    }
  }
  return new RegExp(`^${out}$`);
};

/** relativePath must use forward slashes, no leading slash (e.g. `vscode.workspace.asRelativePath` output). */
const shouldIgnorePath = (relativePath: string, patterns: string[]): boolean => {
  const segments = relativePath.split('/');
  if (segments.some((segment) => HARD_EXCLUDE_SEGMENTS.has(segment))) return true;
  if (HARD_EXCLUDE_SUFFIXES.some((suffix) => relativePath.endsWith(suffix))) return true;
  return patterns.some((pattern) => globToRegex(pattern).test(relativePath));
};

export { globToRegex, shouldIgnorePath, HARD_EXCLUDE_SEGMENTS, HARD_EXCLUDE_SUFFIXES };
