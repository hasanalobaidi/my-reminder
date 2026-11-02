'use strict';

const fs = require('fs');
const path = require('path');
const readReminderConfig = require('./read-reminder-config');

function saveReminderConfig(patch) {
  const dataDir = process.env.MYREMINDER_DATA_DIR || path.join(__dirname, '..', 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const cfgPath = path.join(dataDir, 'reminder-config.json');
  const backupPath = path.join(dataDir, 'reminder-config.backup.json');
  const current = readReminderConfig();
  if (fs.existsSync(cfgPath)) {
    try {
      fs.copyFileSync(cfgPath, backupPath);
    } catch (_) {}
  }
  const updated = {
    ...current,
    ...(patch && typeof patch === 'object' ? patch : {}),
    brandColor: '#8A1538',
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(cfgPath, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

module.exports = saveReminderConfig;
