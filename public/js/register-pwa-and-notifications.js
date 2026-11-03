'use strict';

window.QNA = window.QNA || {};

window.QNA.registerPwaAndNotifications = function registerPwaAndNotifications() {
  let swRegistration = null;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        swRegistration = reg;
      })
      .catch((err) => {
        console.warn('[MyReminder] Service worker registration skipped:', err.message);
      });
  }

  const showOsWebNotification = (title, body, tag) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return;
    }
    const opts = {
      body: String(body || ''),
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: String(tag || `myreminder-${Date.now()}`),
      requireInteraction: true
    };
    try {
      if (swRegistration && typeof swRegistration.showNotification === 'function') {
        swRegistration.showNotification(title, opts);
      } else {
        const n = new Notification(title, opts);
        n.onclick = () => {
          window.focus();
          n.close();
        };
      }
    } catch (_) {}
  };

  const notifyBtn = document.getElementById('enable-os-notifications-btn');
  if (notifyBtn) {
    notifyBtn.addEventListener('click', async () => {
      const origText = notifyBtn.textContent;
      notifyBtn.disabled = true;
      notifyBtn.textContent = '🔔 Sending Mac Notification...';

      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          await Notification.requestPermission();
        }
      } catch (_) {}

      try {
        await fetch('/api/notifications/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: '⏰ MyReminder Mac Notification Active',
            subtitle: 'QNA Post Editor · Ready on Thursday',
            message: 'Real macOS Notification Center banner + Native Full-Screen Alert + TTS are active.'
          })
        });
        showOsWebNotification(
          '⏰ MyReminder Mac Notification Active',
          'Real macOS Notification Center + Native Full-Screen Alert are active.',
          'myreminder-test'
        );
        notifyBtn.textContent = '✅ Mac Notification Sent!';
      } catch (err) {
        console.warn('[MyReminder] Notification test failed:', err);
        notifyBtn.textContent = '⚠️ Notification Error';
      }

      setTimeout(() => {
        notifyBtn.disabled = false;
        notifyBtn.textContent = origText;
      }, 2800);
    });
  }

  window.addEventListener('myreminder:fullscreen-alert', (evt) => {
    const alertObj = evt && evt.detail;
    if (!alertObj) return;
    const readySuffix = alertObj.readyByDay ? ` (Ready on ${alertObj.readyByDay})` : '';
    showOsWebNotification(
      `⏰ ${alertObj.title || 'Scheduled Reminder'}`,
      `${alertObj.project || 'QNA'}${readySuffix} — ${alertObj.notes || 'Due now'}`,
      alertObj.alertId || 'myreminder-live'
    );
  });
};
