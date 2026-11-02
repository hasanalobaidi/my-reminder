'use strict';

window.QNA = window.QNA || {};

window.QNA.renderReminderCards = function renderReminderCards(tasks, filterState, callbacks) {
  const container = document.getElementById('reminders-grid');
  if (!container) {
    console.warn('[MyReminder] #reminders-grid missing');
    return;
  }

  const esc = window.QNA.escapeHtml || ((s) => String(s || ''));
  const filter = filterState && typeof filterState === 'object' ? filterState : {};
  const cbs = callbacks && typeof callbacks === 'object' ? callbacks : {};

  const statusTab = filter.statusTab || 'active';
  const projectFilter = filter.project || 'all';
  const searchQuery = String(filter.search || '').trim().toLowerCase();

  const filtered = (Array.isArray(tasks) ? tasks : []).filter((task) => {
    if (!task) return false;
    if (statusTab === 'active' && (task.status === 'completed' || task.status === 'trashed')) return false;
    if (statusTab === 'completed' && task.status !== 'completed') return false;
    if (statusTab === 'trashed' && task.status !== 'trashed') return false;

    if (projectFilter !== 'all' && String(task.project || '').toLowerCase() !== projectFilter.toLowerCase()) {
      return false;
    }

    if (searchQuery) {
      const hay = `${task.title || ''} ${task.project || ''} ${task.notes || ''} ${(task.daysOfWeek || []).join(' ')}`.toLowerCase();
      if (!hay.includes(searchQuery)) return false;
    }
    return true;
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">No ${esc(statusTab)} reminders matching your filter.</p>
        <p class="empty-sub">Use the Smart Command Bar above or click "+ New Reminder / Job" to schedule one.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((task) => {
      const summary = window.QNA.formatScheduleSummary
        ? window.QNA.formatScheduleSummary(task)
        : { daysLabel: '', timesLabel: '', readyLabel: '', nextLabel: '' };

      const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
      const doneCount = subtasks.filter((s) => s.done).length;
      const subtasksHtml = subtasks.length
        ? `
          <div class="card-subtasks">
            <div class="subtasks-header">Checklist (${doneCount}/${subtasks.length})</div>
            ${subtasks
              .map((st, idx) => `
                <label class="subtask-row ${st.done ? 'is-done' : ''}">
                  <input type="checkbox" data-action="toggle-subtask" data-id="${esc(task.id)}" data-sub-idx="${idx}" ${st.done ? 'checked' : ''}>
                  <span>${esc(st.title)}</span>
                </label>
              `)
              .join('')}
          </div>
        `
        : '';

      const voiceNotes = Array.isArray(task.voiceNotes) ? task.voiceNotes : [];
      const voiceHtml = voiceNotes.length
        ? `
          <div class="card-voice-notes">
            <div class="subtasks-header">Voice Notes (${voiceNotes.length})</div>
            ${voiceNotes
              .map((vn) => {
                const wantSrc = `/api/voice-notes/${encodeURIComponent(vn.filename)}?v=${encodeURIComponent(vn.filename)}`;
                return `
                  <div class="voice-note-item">
                    <div class="voice-note-meta">
                      <span>🎙️ ${esc(vn.label || vn.filename)}</span>
                      <button type="button" class="btn-icon-small" data-action="delete-voice-note" data-id="${esc(task.id)}" data-filename="${esc(vn.filename)}" title="Remove voice note">✕</button>
                    </div>
                    <audio controls preload="metadata" src="${esc(wantSrc)}" data-filename="${esc(vn.filename)}"></audio>
                  </div>
                `;
              })
              .join('')}
          </div>
        `
        : '';

      const snoozeBadge = task.snoozedUntil && new Date(task.snoozedUntil) > new Date()
        ? `<span class="badge badge-snooze">💤 Snoozed until ${esc(new Date(task.snoozedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</span>`
        : '';

      const readyBadge = summary.readyLabel
        ? `<span class="badge badge-deadline">🎯 ${esc(summary.readyLabel)}</span>`
        : '';

      const actionButtons = task.status === 'trashed'
        ? `
          <button type="button" class="btn btn-secondary btn-sm" data-action="restore" data-id="${esc(task.id)}">♻️ Restore</button>
          <button type="button" class="btn btn-danger btn-sm" data-action="delete-permanent" data-id="${esc(task.id)}">🗑️ Delete Forever</button>
        `
        : `
          <button type="button" class="btn btn-anabi btn-sm" data-action="trigger-now" data-id="${esc(task.id)}">🚨 Full-Screen Alert Now</button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="speak-tts" data-id="${esc(task.id)}">🔊 Read Aloud (TTS)</button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="edit" data-id="${esc(task.id)}">✏️ Edit / Voice Note</button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="toggle-complete" data-id="${esc(task.id)}">${task.status === 'completed' ? '↩️ Reopen' : '✅ Mark Ready'}</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="trash" data-id="${esc(task.id)}" title="Move to 30-day Trash">🗑️</button>
        `;

      return `
        <article class="reminder-card priority-${esc(task.priority || 'high')} ${task.status === 'completed' ? 'is-completed' : ''}" data-reminder-id="${esc(task.id)}">
          <div class="card-top">
            <div class="card-badges">
              <span class="badge badge-project">${esc(task.project || 'General')}</span>
              ${readyBadge}
              ${snoozeBadge}
              <span class="badge badge-priority">${esc((task.priority || 'high').toUpperCase())}</span>
            </div>
            <label class="switch-label" title="Enable or pause schedule">
              <input type="checkbox" data-action="toggle-enabled" data-id="${esc(task.id)}" ${task.enabled !== false ? 'checked' : ''}>
              <span>${task.enabled !== false ? 'Active' : 'Paused'}</span>
            </label>
          </div>

          <h3 class="card-title">${esc(task.title)}</h3>

          <div class="card-schedule-bar">
            <div class="schedule-chip">📅 <strong>Days:</strong> ${esc(summary.daysLabel)}</div>
            <div class="schedule-chip">⏰ <strong>Times:</strong> ${esc(summary.timesLabel)}</div>
            <div class="schedule-chip next-fire">⚡ <strong>Next Alert:</strong> ${esc(summary.nextLabel)}</div>
          </div>

          ${task.notes ? `<p class="card-notes">${esc(task.notes)}</p>` : ''}
          ${subtasksHtml}
          ${voiceHtml}

          <div class="card-actions">
            ${actionButtons}
          </div>
        </article>
      `;
    })
    .join('');

  container.querySelectorAll('[data-action]').forEach((el) => {
    const action = el.getAttribute('data-action');
    const id = el.getAttribute('data-id');
    if (action === 'toggle-subtask' || action === 'toggle-enabled') {
      el.addEventListener('change', () => {
        if (typeof cbs.onCardAction === 'function') {
          cbs.onCardAction(action, id, el);
        }
      });
    } else {
      el.addEventListener('click', () => {
        if (typeof cbs.onCardAction === 'function') {
          cbs.onCardAction(action, id, el);
        }
      });
    }
  });
};
