'use strict';

window.QNA = window.QNA || {};

window.QNA.initAndroidSyncAndOta = function initAndroidSyncAndOta() {
  const STORAGE_KEYS = {
    lanUrl: 'myreminder_mac_lan_url',
    remoteUrl: 'myreminder_mac_remote_url',
    githubRepo: 'myreminder_github_repo',
    offlineReminders: 'myreminder_offline_reminders',
    offlineDirty: 'myreminder_offline_dirty',
    installedVersion: 'myreminder_ota_version',
    deviceId: 'myreminder_device_id'
  };

  const esc = window.QNA.escapeHtml || ((s) => String(s || ''));
  const origFetch = window.fetch.bind(window);

  let deviceId = localStorage.getItem(STORAGE_KEYS.deviceId);
  if (!deviceId) {
    deviceId = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem(STORAGE_KEYS.deviceId, deviceId);
  }

  // 1. Capture QR-code pairing query params (?pairLan=...&pairRemote=...)
  const urlParams = new URLSearchParams(window.location.search);
  const pairLan = urlParams.get('pairLan');
  const pairRemote = urlParams.get('pairRemote');
  if (pairLan) localStorage.setItem(STORAGE_KEYS.lanUrl, pairLan.replace(/\/+$/, ''));
  if (pairRemote) localStorage.setItem(STORAGE_KEYS.remoteUrl, pairRemote.replace(/\/+$/, ''));
  if (window.location.protocol.startsWith('http') && window.location.hostname !== '127.0.0.1' && window.location.hostname !== 'localhost') {
    const currentOrigin = window.location.origin.replace(/\/+$/, '');
    if (/^(?:192\.168\.|10\.|172\.)/.test(window.location.hostname)) {
      localStorage.setItem(STORAGE_KEYS.lanUrl, currentOrigin);
    } else {
      localStorage.setItem(STORAGE_KEYS.remoteUrl, currentOrigin);
    }
  }

  const getCachedReminders = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.offlineReminders);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  };

  const saveCachedReminders = (list, markDirty) => {
    if (!Array.isArray(list)) return;
    try {
      localStorage.setItem(STORAGE_KEYS.offlineReminders, JSON.stringify(list));
      if (markDirty) {
        localStorage.setItem(STORAGE_KEYS.offlineDirty, '1');
      }
      if (window.MyReminderAndroid && typeof window.MyReminderAndroid.syncNativeAlarms === 'function') {
        window.MyReminderAndroid.syncNativeAlarms(JSON.stringify(list));
      }
    } catch (_) {}
  };

  const getCandidateMacOrigins = () => {
    const candidates = [];
    if (window.location.protocol.startsWith('http')) {
      candidates.push('');
    }
    const savedLan = localStorage.getItem(STORAGE_KEYS.lanUrl);
    const savedRemote = localStorage.getItem(STORAGE_KEYS.remoteUrl);
    if (savedLan && !candidates.includes(savedLan)) candidates.push(savedLan);
    if (savedRemote && !candidates.includes(savedRemote)) candidates.push(savedRemote);
    return candidates;
  };

  const updateSyncPill = (text, isOffline) => {
    const pill = document.getElementById('android-sync-status-pill');
    if (!pill) return;
    pill.textContent = text;
    pill.classList.toggle('is-offline', Boolean(isOffline));
  };

  // 2. Multi-Host + Offline-First fetch wrapper for seamless Mac <-> Android operation
  const fetchWithTimeout = async (url, init, timeoutMs) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 3500);
    try {
      return await origFetch(url, { ...(init || {}), signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  const makeJsonResponse = (obj, status) => new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });

  window.fetch = async (input, init) => {
    const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if (!urlStr.startsWith('/api/')) {
      return origFetch(input, init);
    }

    const candidates = getCandidateMacOrigins();
    for (const baseOrigin of candidates) {
      try {
        const resp = await fetchWithTimeout(`${baseOrigin}${urlStr}`, init, baseOrigin === '' ? 4500 : 2800);
        if (resp && resp.ok) {
          if (urlStr === '/api/reminders' && (!init || !init.method || init.method === 'GET')) {
            const clone = resp.clone();
            clone.json().then((data) => {
              if (data && Array.isArray(data.reminders)) {
                saveCachedReminders(data.reminders, false);
                updateSyncPill('🟢 Mac & Android Linked', false);
              }
            }).catch(() => {});
          }
          return resp;
        }
      } catch (_) {}
    }

    // Offline-First Fallback when Android phone is away from Mac & offline
    updateSyncPill('📴 Offline Mode (Local Android Alarms Active)', true);
    const method = ((init && init.method) || 'GET').toUpperCase();
    const cached = getCachedReminders();

    if (urlStr === '/api/reminders' && method === 'GET') {
      return makeJsonResponse({
        ok: true,
        offline: true,
        reminders: cached,
        alertHistory: [],
        activeAlert: null
      });
    }

    if (urlStr === '/api/reminders' && method === 'POST') {
      const body = init && init.body ? JSON.parse(init.body) : {};
      const nowIso = new Date().toISOString();
      const newTask = {
        id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: String(body.title || body.rawPrompt || 'Offline Reminder').trim(),
        project: String(body.project || 'QNA post editor'),
        scheduleType: body.scheduleType || 'weekly',
        daysOfWeek: Array.isArray(body.daysOfWeek) && body.daysOfWeek.length ? body.daysOfWeek : ['tuesday', 'wednesday'],
        times: Array.isArray(body.times) && body.times.length ? body.times : ['11:00', '15:00'],
        readyByDay: String(body.readyByDay || 'thursday'),
        priority: body.priority || 'high',
        status: 'pending',
        enabled: true,
        ttsEnabled: body.ttsEnabled !== false,
        fullscreenEnabled: body.fullscreenEnabled !== false,
        notes: String(body.notes || ''),
        subtasks: Array.isArray(body.subtasks) ? body.subtasks : [],
        voiceNotes: [],
        createdAt: nowIso,
        updatedAt: nowIso
      };
      cached.unshift(newTask);
      saveCachedReminders(cached, true);
      return makeJsonResponse({ ok: true, offline: true, reminder: newTask }, 201);
    }

    const singleMatch = urlStr.match(/^\/api\/reminders\/([^/?]+)/);
    if (singleMatch && method === 'PUT') {
      const id = decodeURIComponent(singleMatch[1]);
      const body = init && init.body ? JSON.parse(init.body) : {};
      const idx = cached.findIndex((r) => r.id === id);
      if (idx !== -1) {
        cached[idx] = { ...cached[idx], ...body, id, updatedAt: new Date().toISOString() };
        saveCachedReminders(cached, true);
        return makeJsonResponse({ ok: true, offline: true, reminder: cached[idx] });
      }
    }

    return makeJsonResponse({ ok: false, offline: true, error: 'Offline mode' }, 503);
  };

  // 3. Background Two-Way Sync between Android Local Cache and Mac Server
  const runTwoWaySync = async () => {
    const candidates = getCandidateMacOrigins();
    const localReminders = getCachedReminders();
    for (const baseOrigin of candidates) {
      try {
        const resp = await fetchWithTimeout(`${baseOrigin}/api/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientDeviceId: deviceId,
            clientReminders: localReminders
          })
        }, 3000);
        if (resp && resp.ok) {
          const data = await resp.json();
          if (data && data.ok && Array.isArray(data.reminders)) {
            saveCachedReminders(data.reminders, false);
            localStorage.removeItem(STORAGE_KEYS.offlineDirty);
            if (data.version) {
              localStorage.setItem(STORAGE_KEYS.installedVersion, data.version);
            }
            updateSyncPill(`🟢 Linked · v${data.version || '1.00.03'}`, false);
            return data;
          }
        }
      } catch (_) {}
    }
    return null;
  };

  // 4. GitHub + Mac Live OTA Auto-Update Check (Zero APK Reinstall)
  const checkAndApplyOtaUpdate = async (options) => {
    const opts = options && typeof options === 'object' ? options : {};
    const statusBox = document.getElementById('ota-update-status-msg');
    if (statusBox && opts.manual) {
      statusBox.textContent = '🔍 Checking GitHub & Mac for newer OTA bundle...';
    }

    const currentVer = localStorage.getItem(STORAGE_KEYS.installedVersion) || '1.00.03';
    const repo = localStorage.getItem(STORAGE_KEYS.githubRepo) || 'hasanalobaidi/my-reminder';
    const ghVersionUrl = `https://raw.githubusercontent.com/${repo}/main/version.json?t=${Date.now()}`;

    let remoteVersionObj = null;
    let sourceLabel = 'Mac Server';

    // Try GitHub first so phones anywhere in the world get updates directly from GitHub
    try {
      const ghResp = await fetchWithTimeout(ghVersionUrl, { cache: 'no-store' }, 3500);
      if (ghResp && ghResp.ok) {
        remoteVersionObj = await ghResp.json();
        sourceLabel = `GitHub (${repo})`;
      }
    } catch (_) {}

    // Fallback to linked Mac server /api/version
    if (!remoteVersionObj) {
      const candidates = getCandidateMacOrigins();
      for (const baseOrigin of candidates) {
        try {
          const macResp = await fetchWithTimeout(`${baseOrigin}/api/version`, { cache: 'no-store' }, 2500);
          if (macResp && macResp.ok) {
            remoteVersionObj = await macResp.json();
            sourceLabel = 'Linked Mac Server';
            break;
          }
        } catch (_) {}
      }
    }

    if (!remoteVersionObj || !remoteVersionObj.version) {
      if (statusBox && opts.manual) {
        statusBox.textContent = `✅ Running v${currentVer} (Offline / Up to date).`;
      }
      return;
    }

    const remoteVer = String(remoteVersionObj.version);
    const isNewer = remoteVer.localeCompare(currentVer, undefined, { numeric: true }) > 0;

    if (window.MyReminderAndroid && typeof window.MyReminderAndroid.applyOtaBundleFromUrl === 'function') {
      if (isNewer || opts.forceApply) {
        const ghBundleUrl = `https://raw.githubusercontent.com/${repo}/main/public/ota-bundle.json`;
        const macOrigin = localStorage.getItem(STORAGE_KEYS.lanUrl) || '';
        const macBundleUrl = macOrigin ? `${macOrigin}/api/ota/bundle` : '';
        if (statusBox) {
          statusBox.textContent = `⚡ Downloading & applying v${remoteVer} from ${sourceLabel} (no APK reinstall needed)...`;
        }
        window.MyReminderAndroid.applyOtaBundleFromUrl(ghBundleUrl, macBundleUrl, remoteVer);
        localStorage.setItem(STORAGE_KEYS.installedVersion, remoteVer);
        return;
      }
    }

    if (isNewer) {
      localStorage.setItem(STORAGE_KEYS.installedVersion, remoteVer);
      if (statusBox) {
        statusBox.textContent = `✨ Auto-updated to v${remoteVer} from ${sourceLabel}! Reloading...`;
      }
      if ('serviceWorker' in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const r of regs) await r.update();
        } catch (_) {}
      }
      setTimeout(() => window.location.reload(), 600);
    } else if (statusBox && opts.manual) {
      statusBox.textContent = `✅ Up to date on v${remoteVer} (Checked ${sourceLabel}).`;
    }
  };

  // 5. Render & Wire the Android App, QR Pairing & GitHub Auto-Update Modal
  const dialogEl = document.getElementById('android-sync-dialog');
  const openBtn = document.getElementById('open-android-sync-btn');
  const closeBtn = document.getElementById('android-sync-close-btn');

  const refreshNetworkModal = async () => {
    try {
      const resp = await fetch('/api/network-info');
      const info = await resp.json();
      if (!info || !info.ok) return;

      if (info.primaryLanUrl) {
        localStorage.setItem(STORAGE_KEYS.lanUrl, info.primaryLanUrl);
      }
      if (info.remoteTunnelUrl) {
        localStorage.setItem(STORAGE_KEYS.remoteUrl, info.remoteTunnelUrl);
      }
      if (info.version) {
        localStorage.setItem(STORAGE_KEYS.installedVersion, info.version);
      }

      const lanUrlEl = document.getElementById('android-lan-url-text');
      const apkLinkEl = document.getElementById('android-apk-download-link');
      const qrApkImg = document.getElementById('android-qr-apk-img');
      const qrPairImg = document.getElementById('android-qr-pair-img');
      const remoteUrlEl = document.getElementById('android-remote-url-text');
      const ghRepoEl = document.getElementById('android-github-repo-input');
      const verBadgeEl = document.getElementById('android-current-version-badge');

      const apkUrl = info.apk && info.apk.lanDownloadUrl
        ? info.apk.lanDownloadUrl
        : `${info.primaryLanUrl}/download/MyReminder.apk`;
      const pairUrl = `${info.primaryLanUrl}/?pairLan=${encodeURIComponent(info.primaryLanUrl)}${info.remoteTunnelUrl ? `&pairRemote=${encodeURIComponent(info.remoteTunnelUrl)}` : ''}`;

      if (lanUrlEl) lanUrlEl.textContent = info.primaryLanUrl;
      if (apkLinkEl) {
        apkLinkEl.href = '/download/MyReminder.apk';
        const kb = info.apk && info.apk.sizeBytes ? ` (${Math.round(info.apk.sizeBytes / 1024)} KB)` : '';
        apkLinkEl.textContent = `⬇️ Download MyReminder.apk${kb}`;
      }
      if (qrApkImg) {
        qrApkImg.src = `/api/qr.svg?text=${encodeURIComponent(apkUrl)}`;
      }
      if (qrPairImg) {
        qrPairImg.src = `/api/qr.svg?text=${encodeURIComponent(pairUrl)}`;
      }
      if (remoteUrlEl) {
        remoteUrlEl.textContent = info.remoteTunnelUrl
          ? `${info.remoteTunnelUrl} (Active 4G/5G Live Bridge)`
          : `Status: ${info.remoteTunnelStatus || 'Connecting...'}`;
      }
      if (ghRepoEl && info.ota && info.ota.githubOwner && info.ota.githubRepo) {
        ghRepoEl.value = `${info.ota.githubOwner}/${info.ota.githubRepo}`;
      }
      if (verBadgeEl) {
        verBadgeEl.textContent = `v${info.version || '1.00.03'} · Live GitHub + Mac OTA Active`;
      }
    } catch (err) {
      console.warn('[MyReminder] Network info load warning:', err);
    }
  };

  if (openBtn && dialogEl) {
    openBtn.addEventListener('click', () => {
      refreshNetworkModal();
      dialogEl.showModal();
    });
  }

  if (closeBtn && dialogEl) {
    closeBtn.addEventListener('click', () => dialogEl.close('cancel'));
  }

  const checkOtaBtn = document.getElementById('ota-check-update-btn');
  if (checkOtaBtn) {
    checkOtaBtn.addEventListener('click', () => {
      const ghInput = document.getElementById('android-github-repo-input');
      if (ghInput && ghInput.value.trim()) {
        localStorage.setItem(STORAGE_KEYS.githubRepo, ghInput.value.trim());
      }
      checkAndApplyOtaUpdate({ manual: true, forceApply: true });
    });
  }

  const publishGhBtn = document.getElementById('ota-publish-github-btn');
  if (publishGhBtn) {
    publishGhBtn.addEventListener('click', async () => {
      const statusBox = document.getElementById('ota-update-status-msg');
      const ghInput = document.getElementById('android-github-repo-input');
      const repoVal = (ghInput && ghInput.value.trim()) || 'hasanalobaidi/my-reminder';
      const [owner, repo] = repoVal.split('/');
      publishGhBtn.disabled = true;
      if (statusBox) statusBox.textContent = `🚀 Building OTA bundle & publishing to GitHub (${repoVal})...`;
      try {
        const resp = await fetch('/api/ota/publish-github', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner: owner || 'hasanalobaidi', repo: repo || 'my-reminder' })
        });
        const data = await resp.json();
        if (data && data.ok) {
          if (statusBox) {
            statusBox.textContent = `✅ Published v${data.version} (${data.bundleHash}) to GitHub (${data.repo})! All Android devices will auto-update without reinstalling the APK.`;
          }
        } else if (statusBox) {
          statusBox.textContent = `⚠️ GitHub publish status: ${(data && data.error) || 'Check gh CLI'}`;
        }
      } catch (err) {
        if (statusBox) statusBox.textContent = `⚠️ Error publishing to GitHub: ${err.message}`;
      } finally {
        publishGhBtn.disabled = false;
      }
    });
  }

  const syncNowBtn = document.getElementById('android-sync-now-btn');
  if (syncNowBtn) {
    syncNowBtn.addEventListener('click', async () => {
      const statusBox = document.getElementById('ota-update-status-msg');
      if (statusBox) statusBox.textContent = '🔄 Syncing reminders & native Android alarms with Mac...';
      const res = await runTwoWaySync();
      if (statusBox) {
        statusBox.textContent = res
          ? `✅ Synced ${res.reminders.length} reminder(s) with Mac & scheduled native Android alarms.`
          : '📴 Currently offline — reminders & alarms are saved locally on your device.';
      }
    });
  }

  const startTunnelBtn = document.getElementById('android-toggle-tunnel-btn');
  if (startTunnelBtn) {
    startTunnelBtn.addEventListener('click', async () => {
      await fetch('/api/tunnel/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: true })
      });
      setTimeout(refreshNetworkModal, 1800);
    });
  }

  window.addEventListener('myreminder:fullscreen-alert', (evt) => {
    const alertObj = evt && evt.detail;
    if (!alertObj) return;
    if (navigator.vibrate) {
      try { navigator.vibrate([400, 200, 400, 200, 600]); } catch (_) {}
    }
    if (window.MyReminderAndroid && typeof window.MyReminderAndroid.triggerNativeAlertNow === 'function') {
      try {
        window.MyReminderAndroid.triggerNativeAlertNow(
          String(alertObj.title || 'QNA Reminder'),
          String(alertObj.project || 'QNA post editor'),
          String(alertObj.readyByDay || ''),
          String(alertObj.notes || '')
        );
      } catch (_) {}
    }
  });

  // Run initial sync & OTA check, then repeat periodically in background
  runTwoWaySync();
  setTimeout(() => checkAndApplyOtaUpdate({ manual: false }), 1500);
  setInterval(runTwoWaySync, 20000);
  setInterval(() => checkAndApplyOtaUpdate({ manual: false }), 15 * 60 * 1000);
};
