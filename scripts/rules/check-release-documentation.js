// Hook entry point for the documentation-and-backups rule. Reads a PreToolUse payload on stdin
// and, when the command about to run is a git commit that touches code, refuses it unless the
// release paperwork is in the same commit.
//
// Commit time is the only honest moment to check this. Earlier is guesswork - a doc file that
// is "about to" be written proves nothing - and later is too late, because the commit is the
// thing that gets pushed to beta and then to stable. What must be present:
//
//   CHANGELOG.md, CLAUDE.md, GEMINI.md, Codex.md   staged alongside the code
//   version.json                                    staged, and carrying a note for its version
//   backups/<something>-v<version>-<slug>/          a real folder for that version on disk
//
// Doc-only and backup-only commits pass untouched: the rule exists to stop code shipping
// undocumented, not to demand a version bump for fixing a typo in a markdown file.
function checkReleaseDocumentation(payload) {
  const { execFileSync } = require('child_process');
  const fs = require('fs');
  const path = require('path');

  const command = String(((payload && payload.tool_input) || {}).command || '');
  if (!/\bgit\s+(?:-[^\s]+\s+|--[^\s]+(?:=[^\s]+)?\s+)*commit\b/.test(command)) return null;
  // --amend rewrites a commit whose paperwork was already checked when it was first made.
  if (/--amend\b/.test(command)) return null;

  const cwd = String(payload.cwd || process.cwd());
  let root;
  try {
    root = execFileSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    return null;
  }

  const git = (args) => execFileSync('git', ['-C', root, ...args],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });

  // `git commit -a` sweeps in every tracked modification, so the staged list alone would miss
  // exactly the files the commit is really about.
  const commitsEverything = /\s-[a-zA-Z]*a|--all\b/.test(command);
  let changed = [];
  try {
    changed = git(['diff', '--cached', '--name-only']).split('\n').filter(Boolean);
    if (commitsEverything) {
      changed = changed.concat(git(['diff', 'HEAD', '--name-only']).split('\n').filter(Boolean));
    }
  } catch (error) {
    return null;
  }
  changed = [...new Set(changed)];
  if (!changed.length) return null;

  const isCode = (file) => /\.(jsx?|html|css|json)$/.test(file)
    && !/^backups\//.test(file)
    && !/node_modules/.test(file)
    && !/[/.]backup/.test(file)
    && path.basename(file) !== 'version.json';
  const code = changed.filter(isCode);
  if (!code.length) return null;

  const missing = ['CHANGELOG.md', 'CLAUDE.md', 'GEMINI.md', 'Codex.md', 'version.json']
    .filter((doc) => !changed.includes(doc));

  let version = null;
  let noteMissing = false;
  let backupMissing = false;
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
    version = String(manifest.version || '');
    if (version) {
      noteMissing = !Object.keys(manifest).some((key) => key.startsWith('note')
        && key.slice(4).replace(/_/g, '.') === version);
      const folders = fs.existsSync(path.join(root, 'backups'))
        ? fs.readdirSync(path.join(root, 'backups')) : [];
      backupMissing = !folders.some((name) => name.includes(`v${version}`));
    }
  } catch (error) {
    version = null;
  }

  if (!missing.length && !noteMissing && !backupMissing) return null;

  const lines = [`DOCUMENTATION & BACKUPS MANDATE: this commit changes ${code.length} code `
    + `file(s) (${code.slice(0, 4).join(', ')}${code.length > 4 ? ', ...' : ''}) but the `
    + `release paperwork is incomplete.`];
  if (missing.length) lines.push(`  - not staged: ${missing.join(', ')}`);
  if (version && noteMissing) lines.push(`  - version.json has no note key for v${version} `
    + `(expected note${version.replace(/\./g, '_')})`);
  if (version && backupMissing) lines.push(`  - no backups/ folder for v${version} `
    + `(expected backups/<date>-v${version}-<slug>/)`);
  lines.push('Complete these, then commit again.');
  return lines.join('\n');
}

module.exports = checkReleaseDocumentation;

if (require.main === module) {
  const cliArgs = process.argv.slice(2).filter(Boolean);
  const runDirectCliCheck = () => {
    const problem = checkReleaseDocumentation({
      cwd: process.cwd(),
      tool_input: { command: cliArgs.join(' ') || 'git commit' },
    });
    if (problem) {
      process.stderr.write(`${problem}\n`);
      process.exit(1);
    }
    process.exit(0);
  };

  if (cliArgs.length || process.stdin.isTTY) {
    runDirectCliCheck();
  } else {
    let raw = '';
    let gotChunk = false;
    const stdinTimer = setTimeout(() => {
      if (!gotChunk) {
        process.stdin.pause();
        runDirectCliCheck();
      }
    }, 150);
    if (typeof stdinTimer.unref === 'function') stdinTimer.unref();
    process.stdin.on('data', (chunk) => {
      gotChunk = true;
      clearTimeout(stdinTimer);
      raw += chunk;
    });
    process.stdin.on('end', () => {
      clearTimeout(stdinTimer);
      if (!raw.trim()) {
        runDirectCliCheck();
        return;
      }
      let problem = null;
      try {
        problem = checkReleaseDocumentation(JSON.parse(raw || '{}'));
      } catch (error) {
        problem = null; // a broken hook must never be the thing that stops the work
      }
      if (problem) {
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: problem,
          },
        }));
      }
      process.exit(0);
    });
  }
}
