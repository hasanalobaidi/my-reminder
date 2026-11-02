'use strict';

const fs = require('fs');
const path = require('path');
const getSeedReminders = require('./get-seed-reminders');
const computeNextTriggerAt = require('./compute-next-trigger-at');

function readRemindersStore() {
  const dataDir = process.env.MYREMINDER_DATA_DIR || path.join(__dirname, '..', 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const storePath = path.join(dataDir, 'reminders.json');

  if (!fs.existsSync(storePath)) {
    const initial = {
      reminders: getSeedReminders(),
      alertHistory: [],
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(storePath, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    const reminders = Array.isArray(parsed && parsed.reminders) ? parsed.reminders : [];
    const now = new Date();
    for (const item of reminders) {
      item.nextTriggerAt = computeNextTriggerAt(item, now);
    }
    return {
      reminders,
      alertHistory: Array.isArray(parsed && parsed.alertHistory) ? parsed.alertHistory : [],
      updatedAt: (parsed && parsed.updatedAt) || now.toISOString()
    };
  } catch (err) {
    console.warn('[MyReminder] Failed to read reminders.json, returning seed store:', err.message);
    return {
      reminders: getSeedReminders(),
      alertHistory: [],
      updatedAt: new Date().toISOString()
    };
  }
}

module.exports = readRemindersStore;
