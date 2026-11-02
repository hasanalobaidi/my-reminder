'use strict';

const fs = require('fs');
const path = require('path');
const getDefaultReminderConfig = require('./get-default-reminder-config');

function readReminderConfig() {
  const defaults = getDefaultReminderConfig();
  const dataDir = process.env.MYREMINDER_DATA_DIR || path.join(__dirname, '..', 'data');
  const cfgPath = path.join(dataDir, 'reminder-config.json');
  if (!fs.existsSync(cfgPath)) {
    return defaults;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    return {
      ...defaults,
      ...(raw && typeof raw === 'object' ? raw : {}),
      brandColor: '#8A1538'
    };
  } catch (err) {
    console.warn('[MyReminder] Failed to read reminder-config.json, using defaults:', err.message);
    return defaults;
  }
}

module.exports = readReminderConfig;
