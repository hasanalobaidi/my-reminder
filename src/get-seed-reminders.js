'use strict';

const computeNextTriggerAt = require('./compute-next-trigger-at');

function getSeedReminders() {
  const nowIso = new Date().toISOString();
  const seedTask = {
    id: 'rem-qna-weekly-templates',
    title: 'Prepare the 3 weekly templates',
    project: 'QNA post editor',
    scheduleType: 'weekly',
    daysOfWeek: ['tuesday', 'wednesday'],
    times: ['11:00', '15:00'],
    readyByDay: 'thursday',
    oneTimeAt: '',
    priority: 'high',
    status: 'pending',
    enabled: true,
    ttsEnabled: true,
    fullscreenEnabled: true,
    notes: 'Prepare the 3 weekly templates on Tuesday & Wednesday so all 3 are verified with the approved November 2026 footer and ready on Thursday on QNA post editor.',
    subtasks: [
      { id: 'sub-1', title: 'Weekly template #1 (prepare & verify Nov 2026 footer)', done: false },
      { id: 'sub-2', title: 'Weekly template #2 (prepare & verify Nov 2026 footer)', done: false },
      { id: 'sub-3', title: 'Weekly template #3 (final Thursday readiness check on QNA post editor)', done: false }
    ],
    voiceNotes: [],
    snoozedUntil: null,
    lastTriggeredAt: null,
    lastTriggeredSlotKey: null,
    createdAt: nowIso,
    updatedAt: nowIso
  };
  seedTask.nextTriggerAt = computeNextTriggerAt(seedTask);
  return [seedTask];
}

module.exports = getSeedReminders;
