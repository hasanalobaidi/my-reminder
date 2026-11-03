'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const buildOtaUpdateBundle = require('./build-ota-update-bundle');

function publishGithubOtaUpdate(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const rootDir = path.join(__dirname, '..');
  const bundle = buildOtaUpdateBundle({ writeToDisk: true });
  const githubOwner = String(opts.owner || process.env.MYREMINDER_GITHUB_OWNER || 'hasanalobaidi').trim();
  const githubRepo = String(opts.repo || process.env.MYREMINDER_GITHUB_REPO || 'my-reminder').trim();
  const githubBranch = String(opts.branch || process.env.MYREMINDER_GITHUB_BRANCH || 'main').trim();
  const fullRepo = `${githubOwner}/${githubRepo}`;

  if (process.env.MYREMINDER_HEADLESS_TEST === '1' || opts.dryRun === true) {
    return {
      ok: true,
      dryRun: true,
      version: bundle.version,
      bundleHash: bundle.bundleHash,
      fileCount: bundle.fileCount,
      repo: fullRepo,
      branch: githubBranch,
      rawBundleUrl: bundle.github.rawBundleUrl
    };
  }

  const env = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`
  };

  try {
    try {
      execFileSync('/opt/homebrew/bin/gh', ['auth', 'setup-git'], { cwd: rootDir, env, timeout: 6000, stdio: 'ignore' });
    } catch (_) {}

    let remoteUrl = '';
    try {
      remoteUrl = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: rootDir, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch (_) {
      remoteUrl = '';
    }

    if (!remoteUrl) {
      // Check if repo already exists on GitHub, otherwise create it
      let repoExists = false;
      try {
        execFileSync('/opt/homebrew/bin/gh', ['repo', 'view', fullRepo], { cwd: rootDir, env, timeout: 8000, stdio: 'ignore' });
        repoExists = true;
      } catch (_) {
        repoExists = false;
      }

      if (!repoExists) {
        execFileSync(
          '/opt/homebrew/bin/gh',
          ['repo', 'create', fullRepo, '--public', '--description', 'MyReminder — QNA Mac & Android Task, Schedule, Full-Screen Alert & OTA Auto-Update Suite'],
          { cwd: rootDir, env, timeout: 10000, stdio: 'ignore' }
        );
      }
      remoteUrl = `https://github.com/${fullRepo}.git`;
      execFileSync('git', ['remote', 'add', 'origin', remoteUrl], { cwd: rootDir, env, timeout: 5000, stdio: 'ignore' });
    }

    // Stage and commit updated public/ota-bundle.json if modified
    try {
      execFileSync('git', ['add', 'public/ota-bundle.json', 'version.json'], { cwd: rootDir, env, timeout: 5000, stdio: 'ignore' });
      const statusOut = execFileSync('git', ['status', '--porcelain', 'public/ota-bundle.json', 'version.json'], {
        cwd: rootDir,
        env,
        timeout: 5000,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
      if (statusOut) {
        execFileSync('git', ['commit', '-m', `OTA bundle update for v${bundle.version} (${bundle.bundleHash})`], {
          cwd: rootDir,
          env,
          timeout: 5000,
          stdio: 'ignore'
        });
      }
    } catch (_) {}

    execFileSync('git', ['push', '-u', 'origin', `HEAD:${githubBranch}`], { cwd: rootDir, env, timeout: 60000, stdio: 'ignore' });

    return {
      ok: true,
      publishedToGithub: true,
      version: bundle.version,
      bundleHash: bundle.bundleHash,
      fileCount: bundle.fileCount,
      repo: fullRepo,
      branch: githubBranch,
      remoteUrl,
      rawVersionUrl: bundle.github.rawVersionUrl,
      rawBundleUrl: bundle.github.rawBundleUrl
    };
  } catch (err) {
    return {
      ok: false,
      version: bundle.version,
      bundleHash: bundle.bundleHash,
      repo: fullRepo,
      error: err.message
    };
  }
}

module.exports = publishGithubOtaUpdate;
