'use strict';

const { spawn } = require('child_process');
const readReminderConfig = require('./read-reminder-config');

function speakReminderTts(options) {
  const opts = options && typeof options === 'object' ? options : {};
  if (process.env.MYREMINDER_HEADLESS_TEST === '1') {
    return { spoken: false, reason: 'headless-test-mode' };
  }

  if (opts.stop) {
    try {
      const killer = spawn('/usr/bin/killall', ['say'], { stdio: 'ignore' });
      if (killer && typeof killer.unref === 'function') killer.unref();
    } catch (_) {}
    return { spoken: false, stopped: true };
  }

  const cfg = readReminderConfig();
  if (cfg.ttsEnabled === false && !opts.force) {
    return { spoken: false, reason: 'tts-disabled' };
  }

  const rawText = String(opts.text || '').trim();
  if (!rawText) {
    return { spoken: false, reason: 'empty-text' };
  }

  try {
    const rate = String(Number(opts.rate || cfg.ttsRate || 185));
    const args = ['-r', rate, rawText];
    const child = spawn('/usr/bin/say', args, {
      stdio: 'ignore',
      detached: true
    });
    if (child && typeof child.unref === 'function') child.unref();
    return { spoken: true, text: rawText };
  } catch (err) {
    console.warn('[MyReminder] macOS say TTS error:', err.message);
    return { spoken: false, error: err.message };
  }
}

module.exports = speakReminderTts;
