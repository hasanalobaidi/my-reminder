'use strict';

const { spawn } = require('child_process');

let tunnelChild = null;
let currentTunnelUrl = null;
let currentTunnelStatus = 'stopped';

function manageRemoteTunnel(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const action = String(opts.action || 'status');
  const port = Number(opts.port || process.env.PORT || 5252);

  if (action === 'stop') {
    if (tunnelChild) {
      try {
        tunnelChild.kill('SIGTERM');
      } catch (_) {}
      tunnelChild = null;
    }
    currentTunnelUrl = null;
    currentTunnelStatus = 'stopped';
    return { ok: true, status: currentTunnelStatus, url: null };
  }

  if (action === 'status') {
    return {
      ok: true,
      status: currentTunnelStatus,
      url: currentTunnelUrl
    };
  }

  if (process.env.MYREMINDER_HEADLESS_TEST === '1') {
    currentTunnelStatus = 'headless-simulated';
    currentTunnelUrl = `https://myreminder-qna.lhr.life`;
    return {
      ok: true,
      status: currentTunnelStatus,
      url: currentTunnelUrl
    };
  }

  if (action === 'start') {
    if (tunnelChild && currentTunnelUrl) {
      return { ok: true, status: currentTunnelStatus, url: currentTunnelUrl };
    }

    currentTunnelStatus = 'connecting';
    try {
      const child = spawn(
        '/usr/bin/ssh',
        [
          '-o', 'StrictHostKeyChecking=no',
          '-o', 'ServerAliveInterval=30',
          '-o', 'ExitOnForwardFailure=yes',
          '-R', `80:127.0.0.1:${port}`,
          'nokey@localhost.run'
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      );
      tunnelChild = child;

      const parseChunk = (chunk) => {
        const text = String(chunk || '');
        const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.lhr\.life/);
        if (match && match[0]) {
          currentTunnelUrl = match[0];
          currentTunnelStatus = 'online';
          if (typeof opts.onUrl === 'function') {
            opts.onUrl(currentTunnelUrl);
          }
        }
      };

      child.stdout.on('data', parseChunk);
      child.stderr.on('data', parseChunk);
      child.on('exit', () => {
        if (tunnelChild === child) {
          tunnelChild = null;
          currentTunnelStatus = 'disconnected';
        }
      });
      child.on('error', () => {
        currentTunnelStatus = 'error';
      });
      child.unref();
    } catch (err) {
      currentTunnelStatus = 'error';
      return { ok: false, status: currentTunnelStatus, error: err.message };
    }

    return {
      ok: true,
      status: currentTunnelStatus,
      url: currentTunnelUrl
    };
  }

  return { ok: true, status: currentTunnelStatus, url: currentTunnelUrl };
}

module.exports = manageRemoteTunnel;
