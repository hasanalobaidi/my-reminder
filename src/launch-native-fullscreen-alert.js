'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readReminderConfig = require('./read-reminder-config');

function launchNativeFullscreenAlert(options) {
  const opts = options && typeof options === 'object' ? options : {};
  if (process.env.MYREMINDER_HEADLESS_TEST === '1') {
    return { launched: false, reason: 'headless-test-mode' };
  }

  if (opts.close) {
    try {
      const killer = spawn('/usr/bin/killall', ['MyReminderFullscreenOverlay'], { stdio: 'ignore' });
      if (killer && typeof killer.unref === 'function') killer.unref();
    } catch (_) {}
    return { launched: false, closed: true };
  }

  const cfg = readReminderConfig();
  if (cfg.nativeFullscreenEnabled === false && !opts.force) {
    return { launched: false, reason: 'native-fullscreen-disabled' };
  }

  const port = Number(opts.port || cfg.port || 5252);
  const reminderId = encodeURIComponent(String(opts.reminderId || ''));
  const alertUrl = `http://127.0.0.1:${port}/fullscreen.html?reminderId=${reminderId}&native=1`;
  const binaryPath = path.join(__dirname, '..', 'bin', 'MyReminderFullscreenOverlay');

  if (fs.existsSync(binaryPath)) {
    try {
      const killPrev = spawn('/usr/bin/killall', ['MyReminderFullscreenOverlay'], { stdio: 'ignore' });
      killPrev.on('close', () => {
        try {
          const child = spawn(binaryPath, [alertUrl], {
            stdio: 'ignore',
            detached: true
          });
          if (child && typeof child.unref === 'function') child.unref();
        } catch (_) {}
      });
      return { launched: true, mode: 'native-overlay', url: alertUrl };
    } catch (err) {
      console.warn('[MyReminder] Native fullscreen overlay launch error:', err.message);
    }
  }

  return { launched: false, reason: 'binary-not-built', url: alertUrl };
}

module.exports = launchNativeFullscreenAlert;
