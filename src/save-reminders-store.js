'use strict';

const fs = require('fs');
const path = require('path');
const computeNextTriggerAt = require('./compute-next-trigger-at');

function saveRemindersStore(store) {
  const dataDir = process.env.MYREMINDER_DATA_DIR || path.join(__dirname, '..', 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const storePath = path.join(dataDir, 'reminders.json');
  const backupPath = path.join(dataDir, 'reminders.backup.json');

  if (fs.existsSync(storePath)) {
    try {
      fs.copyFileSync(storePath, backupPath);
    } catch (_) {}
  }

  const now = new Date();
  const reminders = Array.isArray(store && store.reminders) ? store.reminders : [];
  for (const item of reminders) {
    item.nextTriggerAt = computeNextTriggerAt(item, now);
  }

  const payload = {
    reminders,
    alertHistory: Array.isArray(store && store.alertHistory) ? store.alertHistory.slice(0, 200) : [],
    updatedAt: now.toISOString()
  };

  try {
    fs.writeFileSync(storePath, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    if (fs.existsSync(backupPath)) {
      try {
        fs.copyFileSync(backupPath, storePath);
      } catch (_) {}
    }
    throw err;
  }

  return payload;
}

module.exports = saveRemindersStore;
