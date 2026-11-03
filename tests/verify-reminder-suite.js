'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
require('./verify-natural-parser');
const startReminderServer = require('../src/start-reminder-server');

async function verifyReminderSuite() {
  process.env.MYREMINDER_HEADLESS_TEST = '1';
  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'myreminder-data-'));
  process.env.MYREMINDER_DATA_DIR = tempDataDir;

  const instance = startReminderServer(0);
  if (!instance.server.listening) {
    await new Promise((resolve) => instance.server.once('listening', resolve));
  }
  const port = instance.server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Verify status endpoint
    const statusRes = await fetch(`${baseUrl}/api/status`);
    assert.equal(statusRes.status, 200);
    const statusJson = await statusRes.json();
    assert.equal(statusJson.ok, true);
    assert.ok(statusJson.counts.total >= 1, 'Should seed default reminders including QNA weekly templates');

    // 2. Verify natural language parse endpoint
    const parseRes = await fetch(`${baseUrl}/api/reminders/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'set remonder, on tuesdsday, wednesday, to prepare the 3 weekly templates, to be ready on thursady on QNA post editor, remond me at 11 am, 3 pm'
      })
    });
    const parseJson = await parseRes.json();
    assert.equal(parseJson.ok, true);
    assert.deepEqual(parseJson.parsed.daysOfWeek, ['tuesday', 'wednesday']);
    assert.deepEqual(parseJson.parsed.times, ['11:00', '15:00']);
    assert.equal(parseJson.parsed.readyByDay, 'thursday');
    assert.equal(parseJson.parsed.project, 'QNA post editor');

    // 3. Verify creating a reminder via rawPrompt
    const createRes = await fetch(`${baseUrl}/api/reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawPrompt: 'set reminder on monday at 9 am to review QNA breaking news voices on QNA post editor'
      })
    });
    assert.equal(createRes.status, 201);
    const createdJson = await createRes.json();
    assert.equal(createdJson.ok, true);
    const createdId = createdJson.reminder.id;
    assert.ok(createdId);

    // 4. Verify uploading a voice note for that reminder (with ?v=<savedFilename> cache busting)
    const vnRes = await fetch(`${baseUrl}/api/voice-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reminderId: createdId,
        label: 'Template Prep Audio Memo',
        mimeType: 'audio/wav',
        base64Data: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
      })
    });
    assert.equal(vnRes.status, 201);
    const vnJson = await vnRes.json();
    assert.equal(vnJson.ok, true);
    assert.ok(vnJson.voiceNote.url.includes(`?v=${encodeURIComponent(vnJson.voiceNote.filename)}`));

    // 5. Verify triggering full-screen alert for a reminder
    const triggerRes = await fetch(`${baseUrl}/api/reminders/${encodeURIComponent(createdId)}/trigger`, {
      method: 'POST'
    });
    const triggerJson = await triggerRes.json();
    assert.equal(triggerJson.ok, true);
    assert.equal(triggerJson.alert.reminderId, createdId);

    // 6. Verify snoozing an active full-screen alert via /api/alerts/ack
    const snoozeRes = await fetch(`${baseUrl}/api/alerts/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'snooze', reminderId: createdId, snoozeMinutes: 10 })
    });
    const snoozeJson = await snoozeRes.json();
    assert.equal(snoozeJson.ok, true);
    assert.ok(snoozeJson.reminder.snoozedUntil);

    // 7. Verify static dashboard and fullscreen HTML delivery
    const htmlRes = await fetch(`${baseUrl}/`);
    assert.equal(htmlRes.status, 200);
    const htmlText = await htmlRes.text();
    assert.ok(htmlText.includes('MyReminder Control Center'));

    const fsRes = await fetch(`${baseUrl}/fullscreen.html`);
    assert.equal(fsRes.status, 200);

    // 8. Verify PWA manifest, service worker, and macOS system notification endpoint
    const manifestRes = await fetch(`${baseUrl}/manifest.webmanifest`);
    assert.equal(manifestRes.status, 200);
    assert.ok(String(manifestRes.headers.get('content-type') || '').includes('application/manifest+json'));
    const manifestJson = await manifestRes.json();
    assert.equal(manifestJson.display, 'standalone');
    assert.ok(Array.isArray(manifestJson.icons) && manifestJson.icons.length >= 2);

    const swRes = await fetch(`${baseUrl}/sw.js`);
    assert.equal(swRes.status, 200);

    const notifyRes = await fetch(`${baseUrl}/api/notifications/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Headless Test Notification' })
    });
    assert.equal(notifyRes.status, 200);
    const notifyJson = await notifyRes.json();
    assert.equal(notifyJson.ok, true);
    assert.equal(notifyJson.notification.skipped, true);

    assert.ok(fs.existsSync(path.join(__dirname, '..', 'bin', 'MyReminderDesktopApp')));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'bin', 'MyReminderFullscreenOverlay')));

    console.log('[PASS] verify-reminder-suite: All API, Voice Note (?v= cache-busted), Full-Screen Trigger, Snooze, PWA Manifest, and Native Mac Notification checks passed.');
  } finally {
    await instance.close();
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  }
}

verifyReminderSuite().catch((err) => {
  console.error('[FAIL] verify-reminder-suite:', err);
  process.exit(1);
});
