'use strict';

const readRemindersStore = require('./read-reminders-store');
const saveRemindersStore = require('./save-reminders-store');
const speakReminderTts = require('./speak-reminder-tts');
const launchNativeFullscreenAlert = require('./launch-native-fullscreen-alert');

function tickReminderScheduler(state) {
  if (!state || typeof state !== 'object') return { triggered: [] };

  const now = state.mockNow instanceof Date ? state.mockNow : new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentWeekday = dayNames[now.getDay()];
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const currentHm = `${hh}:${mm}`;
  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const slotKey = `${dateKey}_${currentHm}`;

  const store = readRemindersStore();
  const triggered = [];
  let storeChanged = false;

  const fireReminder = (task, triggerSource) => {
    const nowIso = now.toISOString();
    task.lastTriggeredAt = nowIso;
    task.lastTriggeredSlotKey = slotKey;
    if (triggerSource === 'snooze') {
      task.snoozedUntil = null;
    }
    storeChanged = true;

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
      triggerSource
    };

    state.activeAlert = alertRecord;
    store.alertHistory.unshift(alertRecord);
    triggered.push(alertRecord);

    if (Array.isArray(state.sseClients)) {
      const payload = `data: ${JSON.stringify({ type: 'fullscreen-alert', alert: alertRecord })}\n\n`;
      for (const clientRes of state.sseClients) {
        try {
          clientRes.write(payload);
        } catch (_) {}
      }
    }

    if (task.ttsEnabled !== false) {
      speakReminderTts({ text: ttsMessage });
    }
    if (task.fullscreenEnabled !== false) {
      launchNativeFullscreenAlert({ reminderId: task.id, port: state.port });
    }
  };

  for (const task of store.reminders) {
    if (!task || task.enabled === false || task.status === 'completed' || task.status === 'trashed') {
      continue;
    }

    // 1. Check active snooze expiration
    if (task.snoozedUntil) {
      const snoozeTime = new Date(task.snoozedUntil).getTime();
      if (!Number.isNaN(snoozeTime) && now.getTime() >= snoozeTime) {
        fireReminder(task, 'snooze');
        continue;
      }
    }

    // Avoid firing twice in the same minute slot
    if (task.lastTriggeredSlotKey === slotKey) {
      continue;
    }

    // 2. Check one-time schedule
    if (task.scheduleType === 'once' && task.oneTimeAt) {
      const onceDate = new Date(task.oneTimeAt);
      if (!Number.isNaN(onceDate.getTime())) {
        const diffMs = now.getTime() - onceDate.getTime();
        if (diffMs >= 0 && diffMs < 60000 && !task.lastTriggeredAt) {
          fireReminder(task, 'once');
          continue;
        }
      }
    }

    // 3. Check weekly or daily schedule
    const times = Array.isArray(task.times) ? task.times : [];
    if (!times.includes(currentHm)) {
      continue;
    }

    const activeDays = task.scheduleType === 'daily'
      ? dayNames
      : (Array.isArray(task.daysOfWeek) ? task.daysOfWeek.map((d) => String(d).toLowerCase()) : []);

    if (activeDays.includes(currentWeekday)) {
      fireReminder(task, 'schedule');
    }
  }

  if (storeChanged) {
    saveRemindersStore(store);
  }

  return { triggered };
}

module.exports = tickReminderScheduler;
