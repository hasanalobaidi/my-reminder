// Hook entry point for the single-function-file rule. Reads a PostToolUse payload on stdin and
// reports, in the hook's own JSON language, whether the file that was just written breaks it.
//
// The rule has two halves and this enforces both:
//   a NEW file may declare at most one top-level function;
//   an EXISTING file may not declare MORE than it did before.
//
// The second half is what makes this usable at all. server.js declares 84 functions and
// cloud-users.js 22 - they predate the rule and cannot be unpicked. Comparing against the
// committed version polices the thing the rule is actually about (do not park a new function
// in an old file) without reporting the same eleven legacy files on every single write.
//
// A file with NO top-level function is not a violation: the icon sets and other data modules
// legitimately export arrays, and flagging them would train the reader to ignore this hook.
function checkSingleFunctionFile(payload) {
  const { execFileSync } = require('child_process');
  const fs = require('fs');
  const path = require('path');
  const countTopLevelFunctions = require('./count-top-level-functions.js');

  const input = (payload && payload.tool_input) || {};
  const response = (payload && payload.tool_response) || {};
  const filePath = String(response.filePath || input.file_path || '');

  if (!/\.jsx?$/.test(filePath)) return null;
  if (/(node_modules|[/.]backup|\/scratch\/|\.min\.js$)/.test(filePath)) return null;
  if (!fs.existsSync(filePath)) return null;

  let root;
  try {
    root = execFileSync('git', ['-C', path.dirname(filePath), 'rev-parse', '--show-toplevel'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    return null; // not in a repository - nothing to compare against, so nothing to say
  }

  const relative = path.relative(root, filePath);
  const now = countTopLevelFunctions(fs.readFileSync(filePath, 'utf8'));
  if (now.length <= 1) return null;

  let before = null;
  try {
    const committed = execFileSync('git', ['-C', root, 'show', `HEAD:${relative}`],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    before = countTopLevelFunctions(committed);
  } catch (error) {
    before = null; // the file is new to the repository
  }

  if (before === null) {
    return `SINGLE-FUNCTION FILE RULE: ${relative} is a new file and declares ${now.length} `
      + `top-level functions (${now.join(', ')}). Every function needs its own file. `
      + `Split it before going any further.`;
  }
  if (now.length > before.length) {
    const added = now.filter((name) => !before.includes(name));
    return `SINGLE-FUNCTION FILE RULE: ${relative} went from ${before.length} to ${now.length} `
      + `top-level functions${added.length ? ` (added: ${added.join(', ')})` : ''}. `
      + `Do not add a new function to an existing file - give it its own file and wire it in.`;
  }
  return null;
}

module.exports = checkSingleFunctionFile;

if (require.main === module) {
  const path = require('path');
  const { execFileSync } = require('child_process');
  const cliArgs = process.argv.slice(2).filter(Boolean);
  const runCliCheck = (files) => {
    let targets = files;
    if (!targets.length) {
      try {
        const diffHead = execFileSync('git', ['diff', '--name-only', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        const diffStaged = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        targets = [...new Set(diffHead.split('\n').concat(diffStaged.split('\n')).map((s) => s.trim()).filter(Boolean))];
      } catch (_) {
        targets = [];
      }
    }
    const problems = targets
      .map((f) => checkSingleFunctionFile({ tool_input: { file_path: path.resolve(f) } }))
      .filter(Boolean);
    if (problems.length) {
      process.stderr.write(`${problems.join('\n')}\n`);
      process.exit(1);
    }
    process.exit(0);
  };

  if (cliArgs.length || process.stdin.isTTY) {
    runCliCheck(cliArgs);
  } else {
    let raw = '';
    let gotChunk = false;
    const stdinTimer = setTimeout(() => {
      if (!gotChunk) {
        process.stdin.pause();
        runCliCheck([]);
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
        runCliCheck([]);
        return;
      }
      let problem = null;
      try {
        problem = checkSingleFunctionFile(JSON.parse(raw || '{}'));
      } catch (error) {
        problem = null; // a broken hook must never be the thing that stops the work
      }
      if (problem) {
        process.stdout.write(JSON.stringify({
          decision: 'block',
          reason: problem,
          systemMessage: problem.split(':').slice(1).join(':').trim(),
        }));
      }
      process.exit(0);
    });
  }
}
