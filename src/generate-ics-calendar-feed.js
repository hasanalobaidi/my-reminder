'use strict';

function generateIcsCalendarFeed(reminders) {
  const list = Array.isArray(reminders) ? reminders : [];
  const dayMap = {
    sunday: 'SU',
    monday: 'MO',
    tuesday: 'TU',
    wednesday: 'WE',
    thursday: 'TH',
    friday: 'FR',
    saturday: 'SA'
  };

  const escapeIcs = (str) => String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

  const formatUtcStamp = (dateObj) => {
    const d = dateObj instanceof Date && !Number.isNaN(dateObj.getTime()) ? dateObj : new Date();
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  };

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//QNA//MyReminder Mac & Android Suite//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:MyReminder QNA Schedule',
    'X-WR-TIMEZONE:Asia/Qatar'
  ];

  const nowStamp = formatUtcStamp(new Date());

  for (const task of list) {
    if (!task || task.status === 'trashed' || task.enabled === false) continue;
    const times = Array.isArray(task.times) && task.times.length ? task.times : ['11:00'];
    const days = Array.isArray(task.daysOfWeek) && task.daysOfWeek.length ? task.daysOfWeek : ['tuesday', 'wednesday'];
    const byDay = days.map((d) => dayMap[String(d).toLowerCase()]).filter(Boolean).join(',');

    for (const hm of times) {
      const [hhStr, mmStr] = String(hm || '11:00').split(':');
      const hh = Number(hhStr || 11);
      const mm = Number(mmStr || 0);
      const startRef = new Date();
      startRef.setHours(hh, mm, 0, 0);
      const endRef = new Date(startRef.getTime() + 30 * 60 * 1000);

      const uid = `${task.id}-${hm.replace(':', '')}@myreminder.qna.org.qa`;
      const readyNote = task.readyByDay ? ` [Ready on ${task.readyByDay}]` : '';
      const summary = `${task.title} (${task.project || 'QNA'})${readyNote}`;
      const description = `${task.notes || ''}${Array.isArray(task.subtasks) && task.subtasks.length ? '\\nSubtasks: ' + task.subtasks.map((s) => s.title).join(', ') : ''}`;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${escapeIcs(uid)}`);
      lines.push(`DTSTAMP:${nowStamp}`);
      lines.push(`DTSTART:${formatUtcStamp(startRef)}`);
      lines.push(`DTEND:${formatUtcStamp(endRef)}`);
      if (task.scheduleType === 'daily') {
        lines.push('RRULE:FREQ=DAILY');
      } else if (task.scheduleType !== 'once' && byDay) {
        lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${byDay}`);
      }
      lines.push(`SUMMARY:${escapeIcs(summary)}`);
      lines.push(`DESCRIPTION:${escapeIcs(description)}`);
      lines.push('BEGIN:VALARM');
      lines.push('TRIGGER:-PT0M');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:${escapeIcs(summary)}`);
      lines.push('END:VALARM');
      lines.push('END:VEVENT');
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

module.exports = generateIcsCalendarFeed;
