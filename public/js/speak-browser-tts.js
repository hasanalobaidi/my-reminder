'use strict';

window.QNA = window.QNA || {};

window.QNA.speakBrowserTts = function speakBrowserTts(text, options) {
  const opts = options && typeof options === 'object' ? options : {};

  if (opts.stop) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    fetch('/api/tts/stop', { method: 'POST' }).catch(() => {});
    return;
  }

  const cleanText = String(text || '').trim();
  if (!cleanText) {
    console.warn('[MyReminder] speakBrowserTts: empty text');
    return;
  }

  if ('speechSynthesis' in window && opts.useBrowser !== false) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = opts.lang || 'en-US';
      utterance.rate = Number(opts.rate || 1.0);
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[MyReminder] Browser speechSynthesis warning:', err);
    }
  }

  if (opts.useServerMacSay) {
    fetch('/api/tts/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText })
    }).catch(() => {});
  }
};
