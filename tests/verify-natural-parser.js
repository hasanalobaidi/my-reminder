'use strict';

const assert = require('node:assert/strict');
const parseNaturalReminderText = require('../src/parse-natural-reminder-text');
const computeNextTriggerAt = require('../src/compute-next-trigger-at');

function verifyNaturalParser() {
  const sample = 'set remonder, on tuesdsday, wednesday, to prepare the 3 weekly templates, to be ready on thursady on QNA post editor, remond me at 11 am, 3 pm';
  const parsed = parseNaturalReminderText(sample);

  assert.deepEqual(parsed.daysOfWeek, ['tuesday', 'wednesday'], 'Should extract tuesday and wednesday even with typo tuesdsday');
  assert.deepEqual(parsed.times, ['11:00', '15:00'], 'Should extract 11:00 and 15:00 from 11 am, 3 pm');
  assert.equal(parsed.readyByDay, 'thursday', 'Should extract thursday readyByDay even with typo thursady');
  assert.equal(parsed.project, 'QNA post editor', 'Should detect QNA post editor project');
  assert.equal(parsed.scheduleType, 'weekly', 'Should set weekly schedule type');
  assert.equal(parsed.subtasks.length, 3, 'Should auto-generate 3 subtasks for "3 weekly templates"');
  assert.ok(
    parsed.title.toLowerCase().includes('prepare the 3 weekly templates'),
    `Expected title to include "prepare the 3 weekly templates", got "${parsed.title}"`
  );

  // Verify next trigger computation from a Tuesday 10:00 AM local time
  const tueMorning = new Date(2026, 10, 3, 10, 0, 0, 0); // Nov 3, 2026 is a Tuesday
  const nextIso = computeNextTriggerAt(parsed, tueMorning);
  assert.ok(nextIso, 'Should compute a valid nextTriggerAt ISO string');
  const nextDate = new Date(nextIso);
  assert.equal(nextDate.getHours(), 11, 'Next trigger after Tuesday 10:00 AM should be 11:00 AM');
  assert.equal(nextDate.getMinutes(), 0);

  console.log('[PASS] verify-natural-parser: User QNA Post Editor prompt & schedule computation verified.');
}

verifyNaturalParser();
