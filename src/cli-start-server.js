'use strict';

const startReminderServer = require('./start-reminder-server');

function cliStartServer() {
  const info = startReminderServer();
  console.log(`[MyReminder] Full-Screen Notification & Web Control Server running at ${info.url}`);
  return info;
}

if (require.main === module) {
  cliStartServer();
}

module.exports = cliStartServer;
