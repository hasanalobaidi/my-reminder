'use strict';

const http = require('http');
const { spawn } = require('child_process');
const readReminderConfig = require('./read-reminder-config');
const readRemindersStore = require('./read-reminders-store');
const handleReminderHttpRequest = require('./handle-reminder-http-request');
const tickReminderScheduler = require('./tick-reminder-scheduler');
const buildOtaUpdateBundle = require('./build-ota-update-bundle');
const manageRemoteTunnel = require('./manage-remote-tunnel');

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

  try {
    buildOtaUpdateBundle({ writeToDisk: true });
  } catch (_) {}

  const bindHost = process.env.MYREMINDER_HEADLESS_TEST === '1' ? '127.0.0.1' : '0.0.0.0';
  server.listen(port, bindHost);
  server.on('listening', () => {
    const addr = server.address();
    if (addr && typeof addr.port === 'number') {
      state.port = addr.port;
    }
    if (process.env.MYREMINDER_HEADLESS_TEST !== '1' && cfg.remoteTunnelEnabled !== false) {
      manageRemoteTunnel({ action: 'start', port: state.port });
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
