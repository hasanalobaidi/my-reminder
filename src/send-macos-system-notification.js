'use strict';

const { spawn } = require('child_process');

function sendMacosSystemNotification(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const rawTitle = String(opts.title || 'MyReminder Alert').trim();
  const rawSubtitle = String(opts.subtitle || 'QNA Schedule & Alarm Suite').trim();
  const rawMessage = String(opts.message || 'Scheduled reminder is due now.').trim();
  const rawSound = String(opts.soundName || 'Crystal').trim();

  if (process.env.MYREMINDER_HEADLESS_TEST === '1' || process.platform !== 'darwin') {
    return {
      ok: true,
      skipped: true,
      reason: process.env.MYREMINDER_HEADLESS_TEST === '1' ? 'headless-test' : 'non-darwin',
      title: rawTitle,
      subtitle: rawSubtitle,
      message: rawMessage
    };
  }

  const escapeAppleScript = (val) => String(val || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ');

  const script = `display notification "${escapeAppleScript(rawMessage)}" with title "${escapeAppleScript(rawTitle)}" subtitle "${escapeAppleScript(rawSubtitle)}" sound name "${escapeAppleScript(rawSound)}"`;

  try {
    const child = spawn('/usr/bin/osascript', ['-e', script], {
      detached: true,
      stdio: 'ignore'
    });
    child.on('error', (err) => {
      console.warn('[MyReminder] System notification error:', err.message);
    });
    child.unref();
    return {
      ok: true,
      dispatched: true,
      title: rawTitle,
      subtitle: rawSubtitle,
      message: rawMessage
    };
  } catch (err) {
    console.warn('[MyReminder] Failed to send macOS system notification:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = sendMacosSystemNotification;
