'use strict';

const fs = require('fs');
const path = require('path');
const readReminderConfig = require('./read-reminder-config');
const saveReminderConfig = require('./save-reminder-config');
const readRemindersStore = require('./read-reminders-store');
const saveRemindersStore = require('./save-reminders-store');
const parseNaturalReminderText = require('./parse-natural-reminder-text');
const computeNextTriggerAt = require('./compute-next-trigger-at');
const speakReminderTts = require('./speak-reminder-tts');
const launchNativeFullscreenAlert = require('./launch-native-fullscreen-alert');
const sendMacosSystemNotification = require('./send-macos-system-notification');

function handleReminderHttpRequest(req, res, state) {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = parsedUrl.pathname;
  const method = (req.method || 'GET').toUpperCase();

  const sendJson = (statusCode, data) => {
    const body = JSON.stringify(data);
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(body);
  };

  const readJsonBody = () => new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > 25 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });

  const broadcastSse = (eventObj) => {
    if (!state || !Array.isArray(state.sseClients)) return;
    const msg = `data: ${JSON.stringify(eventObj)}\n\n`;
    for (const clientRes of state.sseClients) {
      try {
        clientRes.write(msg);
      } catch (_) {}
    }
  };

  // 1. Version endpoint
  if (method === 'GET' && pathname === '/api/version') {
    const versionPath = path.join(__dirname, '..', 'version.json');
    try {
      const ver = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
      sendJson(200, ver);
    } catch (err) {
      sendJson(200, { version: '1.00.00', error: err.message });
    }
    return;
  }

  // 2. Status endpoint
  if (method === 'GET' && pathname === '/api/status') {
    const store = readRemindersStore();
    const cfg = readReminderConfig();
    const verPath = path.join(__dirname, '..', 'version.json');
    let ver = { version: '1.00.00' };
    try {
      ver = JSON.parse(fs.readFileSync(verPath, 'utf8'));
    } catch (_) {}

    const activeCount = store.reminders.filter((r) => r.status !== 'trashed' && r.status !== 'completed' && r.enabled !== false).length;
    const completedCount = store.reminders.filter((r) => r.status === 'completed').length;
    const trashedCount = store.reminders.filter((r) => r.status === 'trashed').length;

    sendJson(200, {
      ok: true,
      version: ver.version,
      updatedAt: ver.updatedAt,
      serverTimeIso: new Date().toISOString(),
      activeAlert: state.activeAlert || null,
      config: cfg,
      counts: {
        total: store.reminders.length,
        active: activeCount,
        completed: completedCount,
        trashed: trashedCount
      }
    });
    return;
  }

  // 3. Server-Sent Events stream for real-time full-screen notifications
  if (method === 'GET' && pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', activeAlert: state.activeAlert || null })}\n\n`);
    if (state && Array.isArray(state.sseClients)) {
      state.sseClients.push(res);
    }
    req.on('close', () => {
      if (state && Array.isArray(state.sseClients)) {
        const idx = state.sseClients.indexOf(res);
        if (idx !== -1) state.sseClients.splice(idx, 1);
      }
    });
    return;
  }

  // 4. Config endpoints
  if (method === 'GET' && pathname === '/api/config') {
    sendJson(200, { ok: true, config: readReminderConfig() });
    return;
  }
  if (method === 'POST' && pathname === '/api/config') {
    readJsonBody()
      .then((body) => {
        const updated = saveReminderConfig(body);
        sendJson(200, { ok: true, config: updated });
      })
      .catch((err) => sendJson(400, { ok: false, error: err.message }));
    return;
  }

  // 5. Natural language parser endpoint
  if (method === 'POST' && pathname === '/api/reminders/parse') {
    readJsonBody()
      .then((body) => {
        const parsed = parseNaturalReminderText(body.text || '');
        sendJson(200, { ok: true, parsed });
      })
      .catch((err) => sendJson(400, { ok: false, error: err.message }));
    return;
  }

  // 6. List reminders
  if (method === 'GET' && pathname === '/api/reminders') {
    const store = readRemindersStore();
    sendJson(200, {
      ok: true,
      reminders: store.reminders,
      alertHistory: store.alertHistory || [],
      activeAlert: state.activeAlert || null
    });
    return;
  }

  // 7. Create reminder
  if (method === 'POST' && pathname === '/api/reminders') {
    readJsonBody()
      .then((body) => {
        const store = readRemindersStore();
        const nowIso = new Date().toISOString();
        const base = body.rawPrompt ? parseNaturalReminderText(body.rawPrompt) : {};
        const title = String(body.title || base.title || '').trim();
        if (!title) {
          sendJson(400, { ok: false, error: 'Reminder title is required' });
          return;
        }

        const newTask = {
          id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title,
          project: String(body.project || base.project || 'General').trim(),
          scheduleType: body.scheduleType || base.scheduleType || 'weekly',
          daysOfWeek: Array.isArray(body.daysOfWeek) && body.daysOfWeek.length
            ? body.daysOfWeek.map((d) => String(d).toLowerCase())
            : (Array.isArray(base.daysOfWeek) && base.daysOfWeek.length ? base.daysOfWeek : ['tuesday', 'wednesday']),
          times: Array.isArray(body.times) && body.times.length
            ? body.times
            : (Array.isArray(base.times) && base.times.length ? base.times : ['11:00']),
          readyByDay: String(body.readyByDay !== undefined ? body.readyByDay : (base.readyByDay || '')).toLowerCase(),
          oneTimeAt: String(body.oneTimeAt || ''),
          priority: body.priority || base.priority || 'high',
          status: body.status || 'pending',
          enabled: body.enabled !== false,
          ttsEnabled: body.ttsEnabled !== false,
          fullscreenEnabled: body.fullscreenEnabled !== false,
          notes: String(body.notes !== undefined ? body.notes : (base.notes || '')),
          subtasks: Array.isArray(body.subtasks) ? body.subtasks : (base.subtasks || []),
          voiceNotes: Array.isArray(body.voiceNotes) ? body.voiceNotes : [],
          snoozedUntil: null,
          lastTriggeredAt: null,
          lastTriggeredSlotKey: null,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        newTask.nextTriggerAt = computeNextTriggerAt(newTask);

        store.reminders.unshift(newTask);
        saveRemindersStore(store);
        broadcastSse({ type: 'reminders-updated' });
        sendJson(201, { ok: true, reminder: newTask });
      })
      .catch((err) => sendJson(400, { ok: false, error: err.message }));
    return;
  }

  // 8. Trigger full-screen alert for a reminder (manual test or immediate alert)
  const triggerMatch = pathname.match(/^\/api\/reminders\/([^/]+)\/trigger$/);
  if (method === 'POST' && triggerMatch) {
    const reminderId = decodeURIComponent(triggerMatch[1]);
    const store = readRemindersStore();
    const task = store.reminders.find((r) => r.id === reminderId);
    if (!task) {
      sendJson(404, { ok: false, error: 'Reminder not found' });
      return;
    }

    const nowIso = new Date().toISOString();
    task.lastTriggeredAt = nowIso;
    const readyPhrase = task.readyByDay
      ? ` To be ready on ${task.readyByDay.charAt(0).toUpperCase() + task.readyByDay.slice(1)}.`
      : '';
    const projectPhrase = task.project && task.project !== 'General'
      ? ` on ${task.project}.`
      : '.';
    const ttsMessage = `Reminder: ${task.title}${projectPhrase}${readyPhrase}`;

    const alertRecord = {
      alertId: `alert-${task.id}-${Date.now()}`,
      reminderId: task.id,
      title: task.title,
      project: task.project || 'General',
      readyByDay: task.readyByDay || '',
      scheduleType: task.scheduleType || 'weekly',
      daysOfWeek: task.daysOfWeek || [],
      times: task.times || [],
      notes: task.notes || '',
      subtasks: task.subtasks || [],
      voiceNotes: task.voiceNotes || [],
      ttsEnabled: task.ttsEnabled !== false,
      ttsMessage,
      triggeredAt: nowIso,
      triggerSource: 'manual'
    };

    state.activeAlert = alertRecord;
    store.alertHistory.unshift(alertRecord);
    saveRemindersStore(store);

    broadcastSse({ type: 'fullscreen-alert', alert: alertRecord });
    sendMacosSystemNotification({
      title: `⏰ ${task.title}`,
      subtitle: `${task.project || 'General'}${task.readyByDay ? ` · Ready on ${task.readyByDay.charAt(0).toUpperCase() + task.readyByDay.slice(1)}` : ''}`,
      message: task.notes || ttsMessage
    });
    if (task.ttsEnabled !== false) {
      speakReminderTts({ text: ttsMessage });
    }
    if (task.fullscreenEnabled !== false) {
      launchNativeFullscreenAlert({ reminderId: task.id, port: state.port });
    }

    sendJson(200, { ok: true, alert: alertRecord });
    return;
  }

  // 9. Restore trashed reminder
  const restoreMatch = pathname.match(/^\/api\/reminders\/([^/]+)\/restore$/);
  if (method === 'POST' && restoreMatch) {
    const reminderId = decodeURIComponent(restoreMatch[1]);
    const store = readRemindersStore();
    const task = store.reminders.find((r) => r.id === reminderId);
    if (!task) {
      sendJson(404, { ok: false, error: 'Reminder not found' });
      return;
    }
    task.status = 'pending';
    delete task.trashedAt;
    task.updatedAt = new Date().toISOString();
    saveRemindersStore(store);
    broadcastSse({ type: 'reminders-updated' });
    sendJson(200, { ok: true, reminder: task });
    return;
  }

  // 10. Update or Delete single reminder
  const singleReminderMatch = pathname.match(/^\/api\/reminders\/([^/]+)$/);
  if (singleReminderMatch) {
    const reminderId = decodeURIComponent(singleReminderMatch[1]);
    if (method === 'PUT') {
      readJsonBody()
        .then((body) => {
          const store = readRemindersStore();
          const idx = store.reminders.findIndex((r) => r.id === reminderId);
          if (idx === -1) {
            sendJson(404, { ok: false, error: 'Reminder not found' });
            return;
          }
          const existing = store.reminders[idx];
          const updated = {
            ...existing,
            ...(body && typeof body === 'object' ? body : {}),
            id: existing.id,
            updatedAt: new Date().toISOString()
          };
          updated.nextTriggerAt = computeNextTriggerAt(updated);
          store.reminders[idx] = updated;
          saveRemindersStore(store);
          broadcastSse({ type: 'reminders-updated' });
          sendJson(200, { ok: true, reminder: updated });
        })
        .catch((err) => sendJson(400, { ok: false, error: err.message }));
      return;
    }

    if (method === 'DELETE') {
      const permanent = parsedUrl.searchParams.get('permanent') === '1';
      const store = readRemindersStore();
      const idx = store.reminders.findIndex((r) => r.id === reminderId);
      if (idx === -1) {
        sendJson(404, { ok: false, error: 'Reminder not found' });
        return;
      }
      if (permanent) {
        const removed = store.reminders.splice(idx, 1)[0];
        saveRemindersStore(store);
        broadcastSse({ type: 'reminders-updated' });
        sendJson(200, { ok: true, deletedPermanently: true, reminder: removed });
      } else {
        store.reminders[idx].status = 'trashed';
        store.reminders[idx].trashedAt = new Date().toISOString();
        store.reminders[idx].updatedAt = new Date().toISOString();
        saveRemindersStore(store);
        broadcastSse({ type: 'reminders-updated' });
        sendJson(200, { ok: true, trashed: true, reminder: store.reminders[idx] });
      }
      return;
    }
  }

  // 11. Acknowledge / Snooze / Dismiss / Complete full-screen alert
  if (method === 'POST' && pathname === '/api/alerts/ack') {
    readJsonBody()
      .then((body) => {
        const action = String(body.action || 'dismiss');
        const reminderId = String(body.reminderId || (state.activeAlert && state.activeAlert.reminderId) || '');
        const snoozeMinutes = Number(body.snoozeMinutes || 15);

        speakReminderTts({ stop: true });
        launchNativeFullscreenAlert({ close: true });

        const store = readRemindersStore();
        const task = store.reminders.find((r) => r.id === reminderId);
        if (task) {
          if (action === 'snooze') {
            const until = new Date(Date.now() + snoozeMinutes * 60 * 1000);
            task.snoozedUntil = until.toISOString();
          } else if (action === 'complete') {
            task.status = 'completed';
            task.snoozedUntil = null;
          } else {
            task.snoozedUntil = null;
          }
          task.updatedAt = new Date().toISOString();
          saveRemindersStore(store);
        }

        state.activeAlert = null;
        broadcastSse({
          type: 'alert-closed',
          action,
          reminderId,
          snoozeMinutes: action === 'snooze' ? snoozeMinutes : null
        });

        sendJson(200, { ok: true, action, reminderId, reminder: task || null });
      })
      .catch((err) => sendJson(400, { ok: false, error: err.message }));
    return;
  }

  // 12. Voice Notes upload & serving (with ?v=<savedFilename> cache-busting per Rule C6)
  if (method === 'POST' && pathname === '/api/voice-notes') {
    readJsonBody()
      .then((body) => {
        const base64Data = String(body.base64Data || '').replace(/^data:[^;]+;base64,/, '');
        if (!base64Data) {
          sendJson(400, { ok: false, error: 'Missing base64Data for voice note' });
          return;
        }
        const mimeType = String(body.mimeType || 'audio/webm');
        const ext = mimeType.includes('mp4') || mimeType.includes('m4a')
          ? 'm4a'
          : (mimeType.includes('wav') ? 'wav' : (mimeType.includes('ogg') ? 'ogg' : 'webm'));
        const safeFilename = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const dataDir = process.env.MYREMINDER_DATA_DIR || path.join(__dirname, '..', 'data');
        const voiceDir = path.join(dataDir, 'voice-notes');
        fs.mkdirSync(voiceDir, { recursive: true });
        const filePath = path.join(voiceDir, safeFilename);
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

        const voiceNote = {
          id: `vn-${Date.now()}`,
          filename: safeFilename,
          label: String(body.label || `Voice Note (${new Date().toLocaleTimeString()})`),
          transcript: String(body.transcript || ''),
          mimeType,
          durationSec: Number(body.durationSec || 0),
          createdAt: new Date().toISOString(),
          url: `/api/voice-notes/${encodeURIComponent(safeFilename)}?v=${encodeURIComponent(safeFilename)}`
        };

        if (body.reminderId) {
          const store = readRemindersStore();
          const task = store.reminders.find((r) => r.id === String(body.reminderId));
          if (task) {
            if (!Array.isArray(task.voiceNotes)) task.voiceNotes = [];
            task.voiceNotes.push(voiceNote);
            task.updatedAt = new Date().toISOString();
            saveRemindersStore(store);
            broadcastSse({ type: 'reminders-updated' });
          }
        }

        sendJson(201, { ok: true, voiceNote });
      })
      .catch((err) => sendJson(400, { ok: false, error: err.message }));
    return;
  }

  const voiceNoteMatch = pathname.match(/^\/api\/voice-notes\/([^/]+)$/);
  if (voiceNoteMatch) {
    const filename = path.basename(decodeURIComponent(voiceNoteMatch[1]));
    const dataDir = process.env.MYREMINDER_DATA_DIR || path.join(__dirname, '..', 'data');
    const filePath = path.join(dataDir, 'voice-notes', filename);

    if (method === 'GET') {
      if (!fs.existsSync(filePath)) {
        sendJson(404, { ok: false, error: 'Voice note file not found' });
        return;
      }
      const ext = path.extname(filename).toLowerCase();
      const mime = ext === '.wav' ? 'audio/wav' : (ext === '.m4a' ? 'audio/mp4' : (ext === '.ogg' ? 'audio/ogg' : 'audio/webm'));
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable'
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    if (method === 'DELETE') {
      const reminderId = parsedUrl.searchParams.get('reminderId');
      if (reminderId) {
        const store = readRemindersStore();
        const task = store.reminders.find((r) => r.id === reminderId);
        if (task && Array.isArray(task.voiceNotes)) {
          task.voiceNotes = task.voiceNotes.filter((vn) => vn.filename !== filename);
          task.updatedAt = new Date().toISOString();
          saveRemindersStore(store);
          broadcastSse({ type: 'reminders-updated' });
        }
      }
      sendJson(200, { ok: true, deletedFilename: filename });
      return;
    }
  }

  // 13. TTS endpoints
  if (method === 'POST' && pathname === '/api/tts/speak') {
    readJsonBody()
      .then((body) => {
        const result = speakReminderTts({ text: body.text || '', rate: body.rate, force: true });
        sendJson(200, { ok: true, ...result });
      })
      .catch((err) => sendJson(400, { ok: false, error: err.message }));
    return;
  }
  if (method === 'POST' && pathname === '/api/tts/stop') {
    const result = speakReminderTts({ stop: true });
    sendJson(200, { ok: true, ...result });
    return;
  }

  // 13b. Real macOS System Notification test/dispatch endpoint
  if (method === 'POST' && pathname === '/api/notifications/test') {
    readJsonBody()
      .then((body) => {
        const result = sendMacosSystemNotification({
          title: body.title || '⏰ MyReminder Mac Notification Active',
          subtitle: body.subtitle || 'QNA Post Editor · Ready on Thursday',
          message: body.message || 'Prepare the 3 weekly templates (Tuesday & Wednesday at 11:00 AM & 3:00 PM).'
        });
        sendJson(200, { ok: true, notification: result });
      })
      .catch((err) => sendJson(400, { ok: false, error: err.message }));
    return;
  }

  // 14. Static files from public/
  const publicDir = path.join(__dirname, '..', 'public');
  const relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const resolvedPath = path.resolve(publicDir, relPath);
  if (!resolvedPath.startsWith(publicDir) || !fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).isDirectory()) {
    sendJson(404, { ok: false, error: `Not found: ${pathname}` });
    return;
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };
  res.writeHead(200, {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Cache-Control': 'no-cache'
  });
  fs.createReadStream(resolvedPath).pipe(res);
}

module.exports = handleReminderHttpRequest;
