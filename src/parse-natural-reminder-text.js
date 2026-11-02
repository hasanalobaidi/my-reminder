'use strict';

function parseNaturalReminderText(rawInput) {
  const original = String(rawInput || '').trim();
  if (!original) {
    return {
      title: '',
      project: 'General',
      scheduleType: 'weekly',
      daysOfWeek: [],
      times: ['09:00'],
      readyByDay: '',
      priority: 'high',
      subtasks: [],
      notes: ''
    };
  }

  const typoMap = [
    [/\bremonder\b/gi, 'reminder'],
    [/\bremond\b/gi, 'remind'],
    [/\breminde\b/gi, 'remind'],
    [/\bschadual\b/gi, 'schedule'],
    [/\bscedule\b/gi, 'schedule'],
    [/\btuesdsday\b/gi, 'tuesday'],
    [/\btuesady\b/gi, 'tuesday'],
    [/\btusday\b/gi, 'tuesday'],
    [/\bwednsday\b/gi, 'wednesday'],
    [/\bwensday\b/gi, 'wednesday'],
    [/\bthursady\b/gi, 'thursday'],
    [/\bthurday\b/gi, 'thursday'],
    [/\bthrusday\b/gi, 'thursday'],
    [/\bmonady\b/gi, 'monday'],
    [/\bfriady\b/gi, 'friday'],
    [/\bsaturady\b/gi, 'saturday'],
    [/\bsunady\b/gi, 'sunday']
  ];

  let normalized = original;
  for (const [pattern, replacement] of typoMap) {
    normalized = normalized.replace(pattern, replacement);
  }

  let working = normalized;
  let readyByDay = '';
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayAliases = {
    sun: 'sunday',
    sunday: 'sunday',
    mon: 'monday',
    monday: 'monday',
    tue: 'tuesday',
    tues: 'tuesday',
    tuesday: 'tuesday',
    wed: 'wednesday',
    weds: 'wednesday',
    wednesday: 'wednesday',
    thu: 'thursday',
    thur: 'thursday',
    thurs: 'thursday',
    thursday: 'thursday',
    fri: 'friday',
    friday: 'friday',
    sat: 'saturday',
    saturday: 'saturday'
  };

  // 1. Extract "to be ready on <day>" / "ready by <day>" / "due on <day>" first
  const readyRegex = /\b(?:to\s+be\s+ready|ready|due|deadline)\s+(?:on|by|for)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/i;
  const readyMatch = working.match(readyRegex);
  if (readyMatch) {
    const matchedKey = readyMatch[1].toLowerCase();
    readyByDay = dayAliases[matchedKey] || matchedKey;
    working = working.replace(readyMatch[0], ' ');
  }

  // 2. Extract Project / Context (e.g., "on QNA post editor")
  let project = 'General';
  const knownProjects = [
    { pattern: /\b(?:on|in|for)?\s*(qna\s+post\s+editor)\b/i, name: 'QNA post editor' },
    { pattern: /\b(?:on|in|for)?\s*(qna\s+editor)\b/i, name: 'QNA post editor' },
    { pattern: /\b(?:on|in|for)?\s*(infographics(?:\s+section)?)\b/i, name: 'Infographics' },
    { pattern: /\b(?:on|in|for)?\s*(weather\s+video|weather\s+clips)\b/i, name: 'Weather Video' }
  ];
  for (const kp of knownProjects) {
    const m = working.match(kp.pattern);
    if (m) {
      project = kp.name;
      working = working.replace(m[0], ' ');
      break;
    }
  }

  // 3. Extract Reminder Times (e.g. "remind me at 11 am, 3 pm" or "at 11:00 am, 3:30 pm")
  const times = [];
  const addTime24 = (hourRaw, minRaw, meridiemRaw) => {
    let h = parseInt(hourRaw, 10);
    const m = minRaw ? parseInt(minRaw, 10) : 0;
    if (Number.isNaN(h) || Number.isNaN(m) || m < 0 || m > 59) return;
    const mer = (meridiemRaw || '').toLowerCase();
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    if (h < 0 || h > 23) return;
    const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (!times.includes(formatted)) {
      times.push(formatted);
    }
  };

  // Match explicit time tokens with am/pm or HH:MM
  const timeTokenRegex = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b([01]?\d|2[0-3]):([0-5]\d)\b/gi;
  let tm;
  while ((tm = timeTokenRegex.exec(working)) !== null) {
    if (tm[3]) {
      addTime24(tm[1], tm[2] || '00', tm[3]);
    } else if (tm[4] !== undefined) {
      addTime24(tm[4], tm[5], '');
    }
  }

  // Remove "remind me at ..." clause from working text
  working = working.replace(/\b(?:and\s+)?(?:remind(?:\s+me)?|alarm|alert|at)\s+(?:at\s+)?(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?[\s,*(?:and)?]*)+/gi, ' ');
  working = working.replace(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi, ' ');

  // 4. Extract Reminder Days of Week from remaining text
  const daysOfWeek = [];
  const dayRegex = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)\b/gi;
  let dm;
  while ((dm = dayRegex.exec(working)) !== null) {
    const canonical = dayAliases[dm[1].toLowerCase()];
    if (canonical && !daysOfWeek.includes(canonical)) {
      daysOfWeek.push(canonical);
    }
  }

  let scheduleType = 'weekly';
  if (/\bevery\s+day\b|\bdaily\b/i.test(working)) {
    scheduleType = 'daily';
    for (const d of dayNames) {
      if (!daysOfWeek.includes(d)) daysOfWeek.push(d);
    }
    working = working.replace(/\b(?:every\s+day|daily)\b/gi, ' ');
  } else if (/\bweekdays\b/i.test(working)) {
    for (const d of ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday']) {
      if (!daysOfWeek.includes(d)) daysOfWeek.push(d);
    }
    working = working.replace(/\bweekdays\b/gi, ' ');
  }

  // Strip day names and leading boilerplate ("set reminder, on tuesday, wednesday, to ...")
  working = working.replace(/\b(?:on\s+)?(?:(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)[\s,*(?:and)?]+)+/gi, ' ');
  working = working.replace(/^(?:please\s+)?(?:set\s+(?:a\s+)?(?:reminder|alarm|schedule|task|job)|remind\s+me|schedule\s+(?:a\s+)?(?:task|reminder|job))[\s,:-]*/i, '');
  working = working.replace(/^[\s,:-]+/, '').replace(/\b(?:on|at|to)\s*$/i, '').trim();
  working = working.replace(/^to\s+/i, '').trim();
  working = working.replace(/\s*,\s*$/, '').replace(/\s+/g, ' ').trim();

  const title = working
    ? working.charAt(0).toUpperCase() + working.slice(1)
    : 'Scheduled Reminder';

  // 5. Generate Subtasks automatically if a count like "3 weekly templates" is present
  const subtasks = [];
  const countMatch = title.match(/\b([2-9]|10)\s+([a-zA-Z0-9\s]+?)(?:s)\b/i);
  if (countMatch) {
    const count = parseInt(countMatch[1], 10);
    const singularBase = countMatch[2].trim();
    const labelBase = singularBase.charAt(0).toUpperCase() + singularBase.slice(1);
    for (let i = 1; i <= count; i += 1) {
      subtasks.push({
        id: `sub-${i}`,
        title: `${labelBase} #${i}`,
        done: false
      });
    }
  }

  if (!times.length) {
    times.push('11:00');
  }
  times.sort();

  const notesParts = [];
  if (readyByDay) {
    const readyCap = readyByDay.charAt(0).toUpperCase() + readyByDay.slice(1);
    notesParts.push(`Target deadline: Ready on ${readyCap}`);
  }
  if (project && project !== 'General') {
    notesParts.push(`Platform / Section: ${project}`);
  }

  return {
    title,
    project,
    scheduleType: daysOfWeek.length ? 'weekly' : scheduleType,
    daysOfWeek: daysOfWeek.length ? daysOfWeek : ['tuesday', 'wednesday'],
    times,
    readyByDay,
    priority: 'high',
    subtasks,
    notes: notesParts.join(' · ')
  };
}

module.exports = parseNaturalReminderText;
