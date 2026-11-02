'use strict';

window.QNA = window.QNA || {};

window.QNA.renderFullscreenAlert = function renderFullscreenAlert(alertData, callbacks) {
  const cbs = callbacks && typeof callbacks === 'object' ? callbacks : {};
  const dialog = document.getElementById('fullscreen-alert-dialog');
  if (!dialog) {
    console.warn('[MyReminder] #fullscreen-alert-dialog missing');
    return;
  }

  const esc = window.QNA.escapeHtml || ((s) => String(s || ''));

  if (!alertData) {
    window.QNA.playAlarmChime('stop');
    window.QNA.speakBrowserTts('', { stop: true });
    if (dialog.open) {
      dialog.close();
    }
    return;
  }

  const titleEl = document.getElementById('fs-alert-title');
  const projectEl = document.getElementById('fs-alert-project');
  const readyEl = document.getElementById('fs-alert-ready');
  const scheduleEl = document.getElementById('fs-alert-schedule');
  const notesEl = document.getElementById('fs-alert-notes');
  const subtasksEl = document.getElementById('fs-alert-subtasks');
  const voiceNotesEl = document.getElementById('fs-alert-voice-notes');
  const clockEl = document.getElementById('fs-alert-clock');

  if (titleEl) titleEl.textContent = alertData.title || 'Scheduled Reminder';
  if (projectEl) projectEl.textContent = alertData.project || 'General';
  if (readyEl) {
    if (alertData.readyByDay) {
      const rCap = alertData.readyByDay.charAt(0).toUpperCase() + alertData.readyByDay.slice(1);
      readyEl.textContent = `Target Deadline: Ready on ${rCap}`;
      readyEl.hidden = false;
    } else {
      readyEl.hidden = true;
    }
  }

  if (scheduleEl && window.QNA.formatScheduleSummary) {
    const summary = window.QNA.formatScheduleSummary(alertData);
    scheduleEl.textContent = `${summary.daysLabel} · ${summary.timesLabel}`;
  }

  if (notesEl) {
    notesEl.textContent = alertData.notes || 'No extra notes attached.';
  }

  if (subtasksEl) {
    const subs = Array.isArray(alertData.subtasks) ? alertData.subtasks : [];
    if (!subs.length) {
      subtasksEl.innerHTML = '';
    } else {
      subtasksEl.innerHTML = subs
        .map((st) => `
          <div class="fs-subtask-item ${st.done ? 'is-done' : ''}">
            <span>${st.done ? '✅' : '⬜'}</span>
            <span>${esc(st.title)}</span>
          </div>
        `)
        .join('');
    }
  }

  if (voiceNotesEl) {
    const vns = Array.isArray(alertData.voiceNotes) ? alertData.voiceNotes : [];
    if (!vns.length) {
      voiceNotesEl.innerHTML = '';
    } else {
      voiceNotesEl.innerHTML = vns
        .map((vn) => {
          const wantSrc = `/api/voice-notes/${encodeURIComponent(vn.filename)}?v=${encodeURIComponent(vn.filename)}`;
          return `
            <div class="fs-voice-item">
              <span>🔊 ${esc(vn.label || vn.filename)}</span>
              <audio controls preload="metadata" src="${esc(wantSrc)}" data-filename="${esc(vn.filename)}"></audio>
            </div>
          `;
        })
        .join('');
    }
  }

  if (clockEl) {
    clockEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  dialog.dataset.reminderId = alertData.reminderId || '';
  dialog.dataset.ttsMessage = alertData.ttsMessage || `Reminder: ${alertData.title}`;

  if (!dialog.open) {
    dialog.showModal();
  }

  window.QNA.playAlarmChime('loop');
  if (alertData.ttsEnabled !== false) {
    window.QNA.speakBrowserTts(dialog.dataset.ttsMessage, { useBrowser: true });
  }

  if (typeof cbs.onShown === 'function') {
    cbs.onShown(alertData);
  }
};
