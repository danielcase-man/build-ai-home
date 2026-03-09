/**
 * Workaround for npm bug with optional platform-specific dependencies.
 * See: https://github.com/npm/cli/issues/4828
 *
 * On Windows, npm sometimes fails to extract @rollup/rollup-win32-x64-msvc
 * even though it's listed in optionalDependencies. This script detects the
 * missing binary and manually extracts it from the npm registry.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

if (process.platform !== 'win32') {
  process.exit(0);
}

const pkg = '@rollup/rollup-win32-x64-msvc';

try {
  require.resolve(pkg);
  // Already installed correctly
  process.exit(0);
} catch {
  // Package missing — fix it
}

console.log(`Fixing missing ${pkg} (npm optional dependency bug)...`);

const targetDir = path.join(__dirname, '..', 'node_modules', '@rollup', 'rollup-win32-x64-msvc');
fs.mkdirSync(targetDir, { recursive: true });

try {
  execSync(`npm pack ${pkg}`, { cwd: path.join(__dirname, '..'), stdio: 'pipe' });

  // Find the tarball (name varies by version)
  const files = fs.readdirSync(path.join(__dirname, '..'));
  const tarball = files.find(f => f.startsWith('rollup-rollup-win32-x64-msvc-') && f.endsWith('.tgz'));

  if (!tarball) {
    console.error('Could not find downloaded tarball');
    process.exit(0); // Non-fatal — tests just won't work
  }

  const tarballPath = path.join(__dirname, '..', tarball);
  execSync(`tar -xzf "${tarballPath}" -C "${targetDir}" --strip-components=1`, { stdio: 'pipe' });
  fs.unlinkSync(tarballPath);

  console.log(`Fixed: ${pkg} installed successfully.`);
} catch (err) {
  console.warn(`Warning: Could not fix ${pkg}: ${err.message}`);
  // Non-fatal — build still works, only vitest/vite affected
}
