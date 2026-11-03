'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function getNetworkSyncInfo(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const port = Number(opts.port || process.env.PORT || 5252);
  const interfaces = os.networkInterfaces();
  const lanIps = [];

  for (const name of Object.keys(interfaces)) {
    const list = interfaces[name] || [];
    for (const iface of list) {
      if (iface && iface.family === 'IPv4' && !iface.internal && iface.address) {
        lanIps.push({
          interface: name,
          address: iface.address,
          url: `http://${iface.address}:${port}`
        });
      }
    }
  }

  // Prefer en0 / en1 Wi-Fi IP first
  lanIps.sort((a, b) => {
    const aPreferred = a.interface === 'en0' || a.interface === 'en1' ? 0 : 1;
    const bPreferred = b.interface === 'en0' || b.interface === 'en1' ? 0 : 1;
    return aPreferred - bPreferred;
  });

  const primaryLanIp = lanIps.length ? lanIps[0].address : '127.0.0.1';
  const primaryLanUrl = `http://${primaryLanIp}:${port}`;
  const hostname = os.hostname() || 'MacBook.local';
  const mdnsUrl = `http://${hostname}:${port}`;

  const versionPath = path.join(__dirname, '..', 'version.json');
  let versionData = { version: '1.00.03', updatedAt: new Date().toISOString() };
  try {
    versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
  } catch (_) {}

  const apkPath = path.join(__dirname, '..', 'public', 'download', 'MyReminder.apk');
  const apkAvailable = fs.existsSync(apkPath);
  const apkSizeBytes = apkAvailable ? fs.statSync(apkPath).size : 0;

  const githubOwner = process.env.MYREMINDER_GITHUB_OWNER || 'hasanalobaidi';
  const githubRepo = process.env.MYREMINDER_GITHUB_REPO || 'my-reminder';
  const githubBranch = process.env.MYREMINDER_GITHUB_BRANCH || 'main';

  return {
    ok: true,
    version: versionData.version,
    updatedAt: versionData.updatedAt,
    hostname,
    port,
    primaryLanIp,
    primaryLanUrl,
    mdnsUrl,
    lanAddresses: lanIps,
    remoteTunnelUrl: opts.remoteTunnelUrl || null,
    remoteTunnelStatus: opts.remoteTunnelStatus || 'ready',
    apk: {
      available: apkAvailable,
      sizeBytes: apkSizeBytes,
      downloadPath: '/download/MyReminder.apk',
      lanDownloadUrl: `${primaryLanUrl}/download/MyReminder.apk`,
      remoteDownloadUrl: opts.remoteTunnelUrl ? `${opts.remoteTunnelUrl}/download/MyReminder.apk` : null
    },
    ota: {
      enabled: true,
      mode: 'github-and-mac-live-ota',
      githubOwner,
      githubRepo,
      githubBranch,
      githubRepoUrl: `https://github.com/${githubOwner}/${githubRepo}`,
      githubVersionUrl: `https://raw.githubusercontent.com/${githubOwner}/${githubRepo}/${githubBranch}/version.json`,
      githubBundleUrl: `https://raw.githubusercontent.com/${githubOwner}/${githubRepo}/${githubBranch}/public/ota-bundle.json`,
      githubApkReleaseUrl: `https://github.com/${githubOwner}/${githubRepo}/releases/latest/download/MyReminder.apk`,
      macBundleUrl: `${primaryLanUrl}/api/ota/bundle`
    }
  };
}

module.exports = getNetworkSyncInfo;
