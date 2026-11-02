'use strict';

const http = require('http');
const { spawn } = require('child_process');
const readReminderConfig = require('./read-reminder-config');
const readRemindersStore = require('./read-reminders-store');
const handleReminderHttpRequest = require('./handle-reminder-http-request');
const tickReminderScheduler = require('./tick-reminder-scheduler');

function startReminderServer(customPort) {
  const cfg = readReminderConfig();
  readRemindersStore();

  if (cfg.preventMacSleep !== false && process.env.MYREMINDER_HEADLESS_TEST !== '1') {
    try {
      const caf = spawn('caffeinate', ['-dims'], {
        stdio: 'ignore',
        detached: true
      });
      if (caf && typeof caf.unref === 'function') caf.unref();
    } catch (_) {}
  }

  const port = Number(customPort !== undefined ? customPort : (process.env.PORT || cfg.port || 5252));
  const state = {
    port,
    activeAlert: null,
    sseClients: [],
    mockNow: null
  };

  const server = http.createServer((req, res) => {
    handleReminderHttpRequest(req, res, state);
  });

  server.listen(port, '127.0.0.1');
  server.on('listening', () => {
    const addr = server.address();
    if (addr && typeof addr.port === 'number') {
      state.port = addr.port;
    }
  });

  const tickTimer = setInterval(() => {
    try {
      tickReminderScheduler(state);
    } catch (err) {
      console.warn('[MyReminder] Scheduler tick warning:', err.message);
    }
  }, 5000);
  if (tickTimer && typeof tickTimer.unref === 'function') tickTimer.unref();

  const close = () => new Promise((resolve) => {
    clearInterval(tickTimer);
    for (const clientRes of state.sseClients) {
      try {
        clientRes.end();
      } catch (_) {}
    }
    state.sseClients = [];
    server.close(() => resolve());
  });

  return {
    server,
    port,
    url: `http://127.0.0.1:${port}`,
    state,
    close
  };
}

module.exports = startReminderServer;
