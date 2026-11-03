'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function buildOtaUpdateBundle(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const rootDir = path.join(__dirname, '..');
  const publicDir = path.join(rootDir, 'public');
  const versionPath = path.join(rootDir, 'version.json');

  let versionObj = { version: '1.00.03', updatedAt: new Date().toISOString() };
  try {
    versionObj = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
  } catch (_) {}

  const noteKey = `note${String(versionObj.version || '').replace(/\./g, '_')}`;
  const releaseNote = versionObj[noteKey] || 'Live OTA update bundle for MyReminder Android & Web.';

  const relativeFiles = [
    'index.html',
    'fullscreen.html',
    'manifest.webmanifest',
    'sw.js',
    'css/styles.css'
  ];

  const jsDir = path.join(publicDir, 'js');
  if (fs.existsSync(jsDir)) {
    const jsEntries = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js')).sort();
    for (const jsFile of jsEntries) {
      relativeFiles.push(`js/${jsFile}`);
    }
  }

  const filesMap = {};
  const hash = crypto.createHash('sha256');
  hash.update(String(versionObj.version || ''));

  for (const rel of relativeFiles) {
    const abs = path.join(publicDir, rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      const content = fs.readFileSync(abs, 'utf8');
      filesMap[rel] = content;
      hash.update(rel);
      hash.update(content);
    }
  }

  const bundleHash = hash.digest('hex').slice(0, 16);
  const githubOwner = process.env.MYREMINDER_GITHUB_OWNER || 'hasanalobaidi';
  const githubRepo = process.env.MYREMINDER_GITHUB_REPO || 'my-reminder';
  const githubBranch = process.env.MYREMINDER_GITHUB_BRANCH || 'main';

  const bundle = {
    ok: true,
    version: versionObj.version,
    updatedAt: versionObj.updatedAt,
    releaseNote,
    bundleHash,
    fileCount: Object.keys(filesMap).length,
    github: {
      owner: githubOwner,
      repo: githubRepo,
      branch: githubBranch,
      rawVersionUrl: `https://raw.githubusercontent.com/${githubOwner}/${githubRepo}/${githubBranch}/version.json`,
      rawBundleUrl: `https://raw.githubusercontent.com/${githubOwner}/${githubRepo}/${githubBranch}/public/ota-bundle.json`
    },
    files: filesMap
  };

  if (opts.writeToDisk !== false) {
    try {
      const outPath = path.join(publicDir, 'ota-bundle.json');
      fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2), 'utf8');
    } catch (err) {
      console.warn('[MyReminder] Failed to write public/ota-bundle.json:', err.message);
    }
  }

  return bundle;
}

module.exports = buildOtaUpdateBundle;
