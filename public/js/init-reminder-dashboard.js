'use strict';

window.QNA = window.QNA || {};

window.QNA.initReminderDashboard = function initReminderDashboard() {
  const state = {
    reminders: [],
    alertHistory: [],
    activeAlert: null,
    config: {},
    filter: {
      statusTab: 'active',
      project: 'all',
      search: ''
    },
    editingId: null,
    draftTimes: ['11:00', '15:00'],
    draftSubtasks: [],
    draftVoiceNotes: []
  };

  const esc = window.QNA.escapeHtml || ((s) => String(s || ''));

  // 1. Modern Web Guidance: Dialog light-dismiss fallback when closedBy is missing
  if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
    const outside = (e, dlg) => {
      const r = dlg.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    for (const dlg of document.querySelectorAll('dialog[closedby="any"]')) {
      let pressedOutside = false;
      dlg.addEventListener('pointerdown', (e) => { pressedOutside = outside(e, dlg); });
      dlg.addEventListener('pointerup', (e) => {
        if (pressedOutside && outside(e, dlg)) dlg.close();
      });
    }
  }

  // 2. Modern Web Guidance: Sync aria-invalid with :user-invalid on blur & input
  const syncAriaInvalid = (el) => {
    if (!el || typeof el.matches !== 'function' || !el.checkValidity) return;
    try {
      if (CSS.supports('selector(:user-invalid)')) {
        el.setAttribute('aria-invalid', el.matches(':user-invalid') ? 'true' : 'false');
      } else {
        const isValid = el.checkValidity();
        el.classList.toggle('user-invalid-fallback', !isValid);
        el.classList.toggle('user-valid-fallback', isValid);
        el.setAttribute('aria-invalid', isValid ? 'false' : 'true');
      }
    } catch (_) {}
  };
  document.addEventListener('blur', (e) => syncAriaInvalid(e.target), true);
  document.addEventListener('input', (e) => {
    if (e.target && e.target.hasAttribute && e.target.hasAttribute('aria-invalid')) {
      syncAriaInvalid(e.target);
    }
  });

  // Live Qatar Clock in Header
  const headerClockEl = document.getElementById('live-qatar-clock');
  const updateClock = () => {
    if (!headerClockEl) return;
    try {
      headerClockEl.textContent = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Qatar',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) + ' (Qatar)';
    } catch (_) {
      headerClockEl.textContent = new Date().toLocaleTimeString();
    }
  };
  updateClock();
  setInterval(updateClock, 1000);

  const updateCounts = () => {
    const activeCount = state.reminders.filter((r) => r.status !== 'completed' && r.status !== 'trashed').length;
    const completedCount = state.reminders.filter((r) => r.status === 'completed').length;
    const trashedCount = state.reminders.filter((r) => r.status === 'trashed').length;

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    };
    setTxt('count-active', activeCount);
    setTxt('count-completed', completedCount);
    setTxt('count-trashed', trashedCount);
  };

  const refreshGrid = () => {
    updateCounts();
    window.QNA.renderReminderCards(state.reminders, state.filter, {
      onCardAction: handleCardAction
    });
  };

  const fetchAllData = async () => {
    try {
      const resp = await fetch('/api/reminders');
      const data = await resp.json();
      if (data && data.ok) {
        state.reminders = data.reminders || [];
        state.alertHistory = data.alertHistory || [];
        state.activeAlert = data.activeAlert || null;
        refreshGrid();
        if (state.activeAlert) {
          window.QNA.renderFullscreenAlert(state.activeAlert);
        }
      }
    } catch (err) {
      console.warn('[MyReminder] Failed to load reminders:', err);
    }
  };

  const handleCardAction = async (action, id, el) => {
    const task = state.reminders.find((r) => r.id === id);
    if (!task) return;

    if (action === 'trigger-now') {
      await fetch(`/api/reminders/${encodeURIComponent(id)}/trigger`, { method: 'POST' });
      return;
    }

    if (action === 'speak-tts') {
      const readyPart = task.readyByDay ? ` To be ready on ${task.readyByDay}.` : '';
      const msg = `${task.title}. Project: ${task.project || 'General'}.${readyPart} ${task.notes || ''}`;
      window.QNA.speakBrowserTts(msg, { useBrowser: true, useServerMacSay: true });
      return;
    }

    if (action === 'edit') {
      openEditorModal(task);
      return;
    }

    if (action === 'toggle-enabled') {
      await fetch(`/api/reminders/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: Boolean(el.checked) })
      });
      await fetchAllData();
      return;
    }

    if (action === 'toggle-complete') {
      const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
      await fetch(`/api/reminders/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      await fetchAllData();
      return;
    }

    if (action === 'toggle-subtask') {
      const subIdx = Number(el.getAttribute('data-sub-idx'));
      const subtasks = Array.isArray(task.subtasks) ? task.subtasks.slice() : [];
      if (subtasks[subIdx]) {
        subtasks[subIdx] = { ...subtasks[subIdx], done: Boolean(el.checked) };
        await fetch(`/api/reminders/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subtasks })
        });
        await fetchAllData();
      }
      return;
    }

    if (action === 'delete-voice-note') {
      const filename = el.getAttribute('data-filename');
      if (filename) {
        await fetch(`/api/voice-notes/${encodeURIComponent(filename)}?reminderId=${encodeURIComponent(id)}`, {
          method: 'DELETE'
        });
        await fetchAllData();
      }
      return;
    }

    if (action === 'trash') {
      await fetch(`/api/reminders/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await fetchAllData();
      return;
    }

    if (action === 'restore') {
      await fetch(`/api/reminders/${encodeURIComponent(id)}/restore`, { method: 'POST' });
      await fetchAllData();
      return;
    }

    if (action === 'delete-permanent') {
      await fetch(`/api/reminders/${encodeURIComponent(id)}?permanent=1`, { method: 'DELETE' });
      await fetchAllData();
    }
  };

  // Smart Command Bar live natural-language parsing + IME-safe Enter submit
  const smartForm = document.getElementById('smart-command-form');
  const smartInput = document.getElementById('smart-command-input');
  const smartPreview = document.getElementById('smart-parse-preview');
  const smartDictateBtn = document.getElementById('smart-dictate-btn');
  const smartDictateLang = document.getElementById('smart-dictate-lang');
  const smartExampleBtn = document.getElementById('smart-fill-example-btn');
  const smartOpenModalBtn = document.getElementById('smart-customize-btn');

  let parseDebounce = null;
  const updateSmartPreview = async () => {
    if (!smartInput || !smartPreview) return;
    const text = smartInput.value.trim();
    if (!text) {
      smartPreview.hidden = true;
      return;
    }
    try {
      const resp = await fetch('/api/reminders/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await resp.json();
      if (data && data.ok && data.parsed) {
        const p = data.parsed;
        smartPreview.hidden = false;
        smartPreview.innerHTML = `
          <span class="preview-pill">📌 <strong>Task:</strong> ${esc(p.title)}</span>
          <span class="preview-pill">🗂️ <strong>Project:</strong> ${esc(p.project)}</span>
          <span class="preview-pill">📅 <strong>Days:</strong> ${esc((p.daysOfWeek || []).join(', '))}</span>
          <span class="preview-pill">⏰ <strong>Times:</strong> ${esc((p.times || []).join(', '))}</span>
          ${p.readyByDay ? `<span class="preview-pill">🎯 <strong>Ready On:</strong> ${esc(p.readyByDay)}</span>` : ''}
          ${p.subtasks && p.subtasks.length ? `<span class="preview-pill">☑️ <strong>Subtasks:</strong> ${p.subtasks.length} items</span>` : ''}
        `;
      }
    } catch (_) {}
  };

  if (smartInput) {
    smartInput.addEventListener('input', () => {
      clearTimeout(parseDebounce);
      parseDebounce = setTimeout(updateSmartPreview, 180);
    });

    // Modern Web Guidance: IME-safe Enter-to-submit (isComposing || keyCode === 229)
    smartInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (event.isComposing || event.keyCode === 229) {
          return;
        }
        if (smartForm) smartForm.requestSubmit();
      }
    });
  }

  if (smartExampleBtn && smartInput) {
    smartExampleBtn.addEventListener('click', () => {
      smartInput.value = 'set remonder, on tuesdsday, wednesday, to prepare the 3 weekly templates, to be ready on thursady on QNA post editor, remond me at 11 am, 3 pm';
      updateSmartPreview();
      smartInput.focus();
    });
  }

  if (smartDictateBtn && smartInput) {
    smartDictateBtn.addEventListener('click', () => {
      const lang = (smartDictateLang && smartDictateLang.value) || 'en-US';
      window.QNA.startVoiceDictation({
        targetInput: smartInput,
        triggerBtn: smartDictateBtn,
        statusEl: document.getElementById('smart-voice-status'),
        lang,
        onComplete: () => updateSmartPreview()
      });
    });
  }

  if (smartForm && smartInput) {
    smartForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rawPrompt = smartInput.value.trim();
      if (!rawPrompt) return;
      const resp = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawPrompt })
      });
      const data = await resp.json();
      if (data && data.ok) {
        smartInput.value = '';
        if (smartPreview) smartPreview.hidden = true;
        await fetchAllData();
      }
    });
  }

  if (smartOpenModalBtn && smartInput) {
    smartOpenModalBtn.addEventListener('click', async () => {
      const text = smartInput.value.trim();
      if (text) {
        const resp = await fetch('/api/reminders/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        const data = await resp.json();
        if (data && data.ok && data.parsed) {
          openEditorModal(data.parsed, true);
          return;
        }
      }
      openEditorModal(null);
    });
  }

  // Editor Modal (<dialog>)
  const editorDialog = document.getElementById('reminder-editor-dialog');
  const editorForm = document.getElementById('reminder-editor-form');
  const newReminderBtn = document.getElementById('open-new-reminder-btn');

  if (editorDialog) {
    editorDialog.addEventListener('close', () => {
      // Modern Web Guidance: Read returnValue and reset to '' so stale values never leak
      const _outcome = editorDialog.returnValue;
      editorDialog.returnValue = '';
      return _outcome;
    });
  }

  const renderDraftTimes = () => {
    const listEl = document.getElementById('editor-times-list');
    if (!listEl) return;
    listEl.innerHTML = state.draftTimes
      .map((t, idx) => `
        <span class="time-chip">
          <input type="time" value="${esc(t)}" data-time-idx="${idx}" aria-label="Alarm time ${idx + 1}">
          <button type="button" class="btn-chip-remove" data-remove-time="${idx}" title="Remove time">✕</button>
        </span>
      `)
      .join('');

    listEl.querySelectorAll('input[type="time"]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const i = Number(inp.getAttribute('data-time-idx'));
        if (inp.value) state.draftTimes[i] = inp.value;
      });
    });
    listEl.querySelectorAll('[data-remove-time]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.getAttribute('data-remove-time'));
        if (state.draftTimes.length > 1) {
          state.draftTimes.splice(i, 1);
          renderDraftTimes();
        }
      });
    });
  };

  const renderDraftSubtasks = () => {
    const listEl = document.getElementById('editor-subtasks-list');
    if (!listEl) return;
    listEl.innerHTML = state.draftSubtasks
      .map((st, idx) => `
        <div class="draft-subtask-row">
          <input type="checkbox" data-draft-sub-done="${idx}" ${st.done ? 'checked' : ''}>
          <input type="text" value="${esc(st.title)}" data-draft-sub-title="${idx}" placeholder="Subtask title">
          <button type="button" class="btn-chip-remove" data-remove-sub="${idx}">✕</button>
        </div>
      `)
      .join('');

    listEl.querySelectorAll('[data-draft-sub-done]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const i = Number(cb.getAttribute('data-draft-sub-done'));
        if (state.draftSubtasks[i]) state.draftSubtasks[i].done = Boolean(cb.checked);
      });
    });
    listEl.querySelectorAll('[data-draft-sub-title]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const i = Number(inp.getAttribute('data-draft-sub-title'));
        if (state.draftSubtasks[i]) state.draftSubtasks[i].title = inp.value;
      });
    });
    listEl.querySelectorAll('[data-remove-sub]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.getAttribute('data-remove-sub'));
        state.draftSubtasks.splice(i, 1);
        renderDraftSubtasks();
      });
    });
  };

  const renderDraftVoiceNotes = () => {
    const listEl = document.getElementById('editor-voice-notes-list');
    if (!listEl) return;
    if (!state.draftVoiceNotes.length) {
      listEl.innerHTML = '<p class="hint">No voice notes recorded yet for this reminder.</p>';
      return;
    }
    listEl.innerHTML = state.draftVoiceNotes
      .map((vn, idx) => {
        const wantSrc = `/api/voice-notes/${encodeURIComponent(vn.filename)}?v=${encodeURIComponent(vn.filename)}`;
        return `
          <div class="voice-note-item">
            <div class="voice-note-meta">
              <span>🎙️ ${esc(vn.label || vn.filename)}</span>
              <button type="button" class="btn-chip-remove" data-remove-vn="${idx}">✕</button>
            </div>
            <audio controls preload="metadata" src="${esc(wantSrc)}" data-filename="${esc(vn.filename)}"></audio>
          </div>
        `;
      })
      .join('');

    listEl.querySelectorAll('[data-remove-vn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.getAttribute('data-remove-vn'));
        state.draftVoiceNotes.splice(i, 1);
        renderDraftVoiceNotes();
      });
    });
  };

  const openEditorModal = (taskOrDraft, isNewFromDraft) => {
    if (!editorDialog || !editorForm) return;
    const isEdit = Boolean(taskOrDraft && taskOrDraft.id && !isNewFromDraft);
    state.editingId = isEdit ? taskOrDraft.id : null;

    const heading = document.getElementById('editor-dialog-title');
    if (heading) {
      heading.textContent = isEdit ? 'Edit Reminder / Job Schedule' : 'New Reminder / Job Schedule';
    }

    const t = taskOrDraft || {
      title: '',
      project: 'QNA post editor',
      scheduleType: 'weekly',
      daysOfWeek: ['tuesday', 'wednesday'],
      times: ['11:00', '15:00'],
      readyByDay: 'thursday',
      priority: 'high',
      notes: '',
      ttsEnabled: true,
      fullscreenEnabled: true,
      subtasks: [],
      voiceNotes: []
    };

    document.getElementById('field-title').value = t.title || '';
    document.getElementById('field-project').value = t.project || 'QNA post editor';
    document.getElementById('field-schedule-type').value = t.scheduleType || 'weekly';
    document.getElementById('field-ready-day').value = t.readyByDay || '';
    document.getElementById('field-one-time').value = t.oneTimeAt ? t.oneTimeAt.slice(0, 16) : '';
    document.getElementById('field-priority').value = t.priority || 'high';
    document.getElementById('field-notes').value = t.notes || '';
    document.getElementById('field-tts-enabled').checked = t.ttsEnabled !== false;
    document.getElementById('field-fullscreen-enabled').checked = t.fullscreenEnabled !== false;

    const selectedDays = Array.isArray(t.daysOfWeek) ? t.daysOfWeek.map((d) => d.toLowerCase()) : ['tuesday', 'wednesday'];
    document.querySelectorAll('input[name="dayOfWeek"]').forEach((cb) => {
      cb.checked = selectedDays.includes(cb.value.toLowerCase());
    });

    state.draftTimes = Array.isArray(t.times) && t.times.length ? t.times.slice() : ['11:00', '15:00'];
    state.draftSubtasks = Array.isArray(t.subtasks) ? t.subtasks.map((s) => ({ ...s })) : [];
    state.draftVoiceNotes = Array.isArray(t.voiceNotes) ? t.voiceNotes.map((v) => ({ ...v })) : [];

    renderDraftTimes();
    renderDraftSubtasks();
    renderDraftVoiceNotes();

    editorDialog.showModal();
  };

  if (newReminderBtn) {
    newReminderBtn.addEventListener('click', () => openEditorModal(null));
  }

  const addTimeBtn = document.getElementById('editor-add-time-btn');
  if (addTimeBtn) {
    addTimeBtn.addEventListener('click', () => {
      const picker = document.getElementById('editor-new-time-input');
      const val = (picker && picker.value) || '15:00';
      if (!state.draftTimes.includes(val)) {
        state.draftTimes.push(val);
        state.draftTimes.sort();
      }
      renderDraftTimes();
    });
  }

  const addSubtaskBtn = document.getElementById('editor-add-subtask-btn');
  if (addSubtaskBtn) {
    addSubtaskBtn.addEventListener('click', () => {
      const inp = document.getElementById('editor-new-subtask-input');
      const title = inp ? inp.value.trim() : '';
      if (!title) return;
      state.draftSubtasks.push({
        id: `sub-${Date.now()}`,
        title,
        done: false
      });
      if (inp) inp.value = '';
      renderDraftSubtasks();
    });
  }

  // Notes Voice-to-Text (STT) & Text-to-Voice (TTS) inside modal
  const notesDictateBtn = document.getElementById('editor-dictate-notes-btn');
  if (notesDictateBtn) {
    notesDictateBtn.addEventListener('click', () => {
      const langSel = document.getElementById('editor-dictate-lang');
      window.QNA.startVoiceDictation({
        targetInput: document.getElementById('field-notes'),
        triggerBtn: notesDictateBtn,
        statusEl: document.getElementById('editor-voice-status'),
        lang: (langSel && langSel.value) || 'en-US'
      });
    });
  }

  const notesSpeakBtn = document.getElementById('editor-speak-notes-btn');
  if (notesSpeakBtn) {
    notesSpeakBtn.addEventListener('click', () => {
      const title = document.getElementById('field-title').value;
      const notes = document.getElementById('field-notes').value;
      window.QNA.speakBrowserTts(`${title}. ${notes}`, { useBrowser: true, useServerMacSay: true });
    });
  }

  // Voice Note Audio Recorder inside modal
  window.QNA.manageVoiceNoteRecorder({
    recordBtn: document.getElementById('editor-record-voice-btn'),
    statusEl: document.getElementById('editor-voice-status'),
    labelInput: document.getElementById('editor-voice-label-input'),
    getReminderId: () => state.editingId || '',
    onUploaded: (vn) => {
      state.draftVoiceNotes.push(vn);
      renderDraftVoiceNotes();
    }
  });

  if (editorForm) {
    editorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('field-title').value.trim();
      if (!title) return;

      const daysOfWeek = [];
      document.querySelectorAll('input[name="dayOfWeek"]:checked').forEach((cb) => {
        daysOfWeek.push(cb.value.toLowerCase());
      });

      const payload = {
        title,
        project: document.getElementById('field-project').value,
        scheduleType: document.getElementById('field-schedule-type').value,
        daysOfWeek: daysOfWeek.length ? daysOfWeek : ['tuesday', 'wednesday'],
        times: state.draftTimes.length ? state.draftTimes : ['11:00'],
        readyByDay: document.getElementById('field-ready-day').value,
        oneTimeAt: document.getElementById('field-one-time').value,
        priority: document.getElementById('field-priority').value,
        notes: document.getElementById('field-notes').value.trim(),
        ttsEnabled: document.getElementById('field-tts-enabled').checked,
        fullscreenEnabled: document.getElementById('field-fullscreen-enabled').checked,
        subtasks: state.draftSubtasks,
        voiceNotes: state.draftVoiceNotes
      };

      if (state.editingId) {
        await fetch(`/api/reminders/${encodeURIComponent(state.editingId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await fetch('/api/reminders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      editorDialog.close('saved');
      await fetchAllData();
    });
  }

  const editorCancelBtn = document.getElementById('editor-cancel-btn');
  if (editorCancelBtn && editorDialog) {
    editorCancelBtn.addEventListener('click', () => editorDialog.close('cancel'));
  }

  // Filter Tabs & Search
  document.querySelectorAll('[data-status-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-status-tab]').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.filter.statusTab = btn.getAttribute('data-status-tab');
      refreshGrid();
    });
  });

  const projectFilterEl = document.getElementById('filter-project-select');
  if (projectFilterEl) {
    projectFilterEl.addEventListener('change', () => {
      state.filter.project = projectFilterEl.value;
      refreshGrid();
    });
  }

  const searchInputEl = document.getElementById('filter-search-input');
  if (searchInputEl) {
    searchInputEl.addEventListener('input', () => {
      state.filter.search = searchInputEl.value;
      refreshGrid();
    });
  }

  // Full-Screen Alert Dialog Actions (Snooze, Dismiss, Complete, Speak)
  const fsDialog = document.getElementById('fullscreen-alert-dialog');
  if (fsDialog) {
    fsDialog.addEventListener('close', () => {
      fsDialog.returnValue = '';
      window.QNA.playAlarmChime('stop');
    });
  }

  document.querySelectorAll('[data-fs-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.getAttribute('data-fs-action');
      const reminderId = (fsDialog && fsDialog.dataset.reminderId) || '';
      if (action === 'speak-again') {
        const msg = (fsDialog && fsDialog.dataset.ttsMessage) || 'Reminder alert';
        window.QNA.speakBrowserTts(msg, { useBrowser: true, useServerMacSay: true });
        return;
      }
      if (action === 'stop-voice') {
        window.QNA.playAlarmChime('stop');
        window.QNA.speakBrowserTts('', { stop: true });
        return;
      }
      const snoozeMinutes = Number(btn.getAttribute('data-snooze-min') || 15);
      await fetch('/api/alerts/ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reminderId, snoozeMinutes })
      });
      window.QNA.renderFullscreenAlert(null);
      await fetchAllData();
    });
  });

  // Connect to Server-Sent Events (/api/events) for real-time full-screen notifications
  const connectSse = () => {
    const es = new EventSource('/api/events');
    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'fullscreen-alert' && msg.alert) {
          state.activeAlert = msg.alert;
          window.QNA.renderFullscreenAlert(msg.alert);
          fetchAllData();
        } else if (msg.type === 'alert-closed') {
          state.activeAlert = null;
          window.QNA.renderFullscreenAlert(null);
          fetchAllData();
        } else if (msg.type === 'reminders-updated') {
          fetchAllData();
        }
      } catch (_) {}
    };
    es.onerror = () => {
      es.close();
      setTimeout(connectSse, 3000);
    };
  };

  fetchAllData();
  connectSse();
};
