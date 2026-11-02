'use strict';

window.QNA = window.QNA || {};

window.QNA.initStandaloneFullscreen = function initStandaloneFullscreen() {
  const params = new URLSearchParams(window.location.search);
  const reminderIdParam = params.get('reminderId') || '';
  const esc = window.QNA.escapeHtml || ((s) => String(s || ''));

  const updateClock = () => {
    const el = document.getElementById('standalone-fs-clock');
    if (el) {
      el.textContent = new Date().toLocaleTimeString('en-US', {
        timeZone: 'Asia/Qatar',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
  };
  updateClock();
  setInterval(updateClock, 1000);

  let currentReminder = null;

  const renderTask = (task) => {
    if (!task) return;
    currentReminder = task;

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setTxt('standalone-fs-title', task.title || 'Scheduled Reminder');
    setTxt('standalone-fs-project', task.project || 'General');

    const readyEl = document.getElementById('standalone-fs-ready');
    if (readyEl) {
      if (task.readyByDay) {
        const cap = task.readyByDay.charAt(0).toUpperCase() + task.readyByDay.slice(1);
        readyEl.textContent = `🎯 Target Deadline: Ready on ${cap}`;
        readyEl.hidden = false;
      } else {
        readyEl.hidden = true;
      }
    }

    if (window.QNA.formatScheduleSummary) {
      const summary = window.QNA.formatScheduleSummary(task);
      setTxt('standalone-fs-schedule', `📅 ${summary.daysLabel} · ⏰ ${summary.timesLabel}`);
    }

    setTxt('standalone-fs-notes', task.notes || '');

    const subsEl = document.getElementById('standalone-fs-subtasks');
    if (subsEl) {
      const subs = Array.isArray(task.subtasks) ? task.subtasks : [];
      subsEl.innerHTML = subs
        .map((s) => `<div class="fs-subtask-item ${s.done ? 'is-done' : ''}">${s.done ? '✅' : '⬜'} ${esc(s.title)}</div>`)
        .join('');
    }

    const vnEl = document.getElementById('standalone-fs-voicenotes');
    if (vnEl) {
      const vns = Array.isArray(task.voiceNotes) ? task.voiceNotes : [];
      vnEl.innerHTML = vns
        .map((vn) => {
          const wantSrc = `/api/voice-notes/${encodeURIComponent(vn.filename)}?v=${encodeURIComponent(vn.filename)}`;
          return `
            <div class="fs-voice-item">
              <span>🎙️ ${esc(vn.label || vn.filename)}</span>
              <audio controls preload="metadata" src="${esc(wantSrc)}"></audio>
            </div>
          `;
        })
        .join('');
    }

    window.QNA.playAlarmChime('loop');
  };

  const loadTargetReminder = async () => {
    try {
      const resp = await fetch('/api/reminders');
      const data = await resp.json();
      if (!data || !data.ok) return;
      if (data.activeAlert) {
        renderTask(data.activeAlert);
        return;
      }
      const list = data.reminders || [];
      const found = list.find((r) => r.id === reminderIdParam) || list[0];
      if (found) renderTask(found);
    } catch (err) {
      console.warn('[MyReminder] Standalone fullscreen load error:', err);
    }
  };

  document.querySelectorAll('[data-standalone-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.getAttribute('data-standalone-action');
      const rId = (currentReminder && (currentReminder.reminderId || currentReminder.id)) || reminderIdParam;

      if (action === 'speak') {
        const msg = currentReminder
          ? `Reminder: ${currentReminder.title}. Project: ${currentReminder.project || 'General'}. ${currentReminder.notes || ''}`
          : 'Reminder alert';
        window.QNA.speakBrowserTts(msg, { useBrowser: true, useServerMacSay: true });
        return;
      }

      if (action === 'mute') {
        window.QNA.playAlarmChime('stop');
        window.QNA.speakBrowserTts('', { stop: true });
        return;
      }

      const snoozeMinutes = Number(btn.getAttribute('data-snooze-min') || 15);
      await fetch('/api/alerts/ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reminderId: rId, snoozeMinutes })
      });
      window.QNA.playAlarmChime('stop');
      document.title = 'MYREMINDER_CLOSE_OVERLAY';
      if (window.opener) {
        window.close();
      }
    });
  });

  const es = new EventSource('/api/events');
  es.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'alert-closed') {
        window.QNA.playAlarmChime('stop');
        document.title = 'MYREMINDER_CLOSE_OVERLAY';
      } else if (msg.type === 'fullscreen-alert' && msg.alert) {
        renderTask(msg.alert);
      }
    } catch (_) {}
  };

  loadTargetReminder();
};
