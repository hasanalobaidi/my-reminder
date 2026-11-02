'use strict';

function computeNextTriggerAt(task, nowInput) {
  if (!task || typeof task !== 'object') return null;
  if (task.enabled === false || task.status === 'completed' || task.status === 'trashed') {
    return null;
  }

  const now = nowInput instanceof Date ? new Date(nowInput.getTime()) : new Date(nowInput || Date.now());
  if (Number.isNaN(now.getTime())) return null;

  if (task.snoozedUntil) {
    const snoozeDate = new Date(task.snoozedUntil);
    if (!Number.isNaN(snoozeDate.getTime()) && snoozeDate.getTime() > now.getTime()) {
      return snoozeDate.toISOString();
    }
  }

  if (task.scheduleType === 'once' && task.oneTimeAt) {
    const onceDate = new Date(task.oneTimeAt);
    if (!Number.isNaN(onceDate.getTime()) && onceDate.getTime() > now.getTime()) {
      return onceDate.toISOString();
    }
    return null;
  }

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const activeDays = task.scheduleType === 'daily'
    ? dayNames
    : (Array.isArray(task.daysOfWeek) && task.daysOfWeek.length
        ? task.daysOfWeek.map((d) => String(d).toLowerCase())
        : dayNames);

  const times = Array.isArray(task.times) && task.times.length ? task.times : ['11:00'];
  let bestCandidate = null;

  for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
    const candidateDay = new Date(now.getTime());
    candidateDay.setDate(candidateDay.getDate() + dayOffset);
    const weekdayName = dayNames[candidateDay.getDay()];
    if (!activeDays.includes(weekdayName)) continue;

    for (const timeStr of times) {
      const parts = String(timeStr || '').split(':');
      if (parts.length < 2) continue;
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      if (Number.isNaN(hours) || Number.isNaN(minutes)) continue;

      const slotDate = new Date(candidateDay.getTime());
      slotDate.setHours(hours, minutes, 0, 0);

      if (slotDate.getTime() > now.getTime()) {
        if (!bestCandidate || slotDate.getTime() < bestCandidate.getTime()) {
          bestCandidate = slotDate;
        }
      }
    }
  }

  return bestCandidate ? bestCandidate.toISOString() : null;
}

module.exports = computeNextTriggerAt;
