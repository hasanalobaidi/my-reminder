'use strict';

window.QNA = window.QNA || {};

window.QNA.formatScheduleSummary = function formatScheduleSummary(task) {
  if (!task || typeof task !== 'object') {
    console.warn('[MyReminder] formatScheduleSummary: task missing');
    return { daysLabel: 'Unscheduled', timesLabel: '—', readyLabel: '', nextLabel: '—' };
  }

  const formatTime12 = (time24) => {
    const parts = String(time24 || '').split(':');
    if (parts.length < 2) return String(time24 || '');
    let h = parseInt(parts[0], 10);
    const m = parts[1];
    if (Number.isNaN(h)) return String(time24 || '');
    const mer = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return m === '00' ? `${h}:00 ${mer}` : `${h}:${m} ${mer}`;
  };

  const cap = (s) => {
    const str = String(s || '');
    return str ? str.charAt(0).toUpperCase() + str.slice(1, 3) : '';
  };

  const fullCap = (s) => {
    const str = String(s || '');
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  };

  let daysLabel = 'Every day';
  if (task.scheduleType === 'once') {
    daysLabel = task.oneTimeAt
      ? `Once: ${new Date(task.oneTimeAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`
      : 'One-time';
  } else if (task.scheduleType !== 'daily' && Array.isArray(task.daysOfWeek) && task.daysOfWeek.length) {
    daysLabel = task.daysOfWeek.map(cap).join(', ');
  }

  const timesLabel = Array.isArray(task.times) && task.times.length
    ? task.times.map(formatTime12).join(' & ')
    : '11:00 AM';

  const readyLabel = task.readyByDay ? `Ready by ${fullCap(task.readyByDay)}` : '';

  let nextLabel = 'Paused';
  if (task.status === 'completed') {
    nextLabel = 'Completed';
  } else if (task.status === 'trashed') {
    nextLabel = 'In Trash (30d)';
  } else if (task.nextTriggerAt) {
    const dt = new Date(task.nextTriggerAt);
    if (!Number.isNaN(dt.getTime())) {
      nextLabel = dt.toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    }
  }

  return { daysLabel, timesLabel, readyLabel, nextLabel };
};
