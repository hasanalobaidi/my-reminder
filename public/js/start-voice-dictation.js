'use strict';

window.QNA = window.QNA || {};

window.QNA.startVoiceDictation = function startVoiceDictation(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const targetInput = opts.targetInput;
  const statusEl = opts.statusEl;
  const triggerBtn = opts.triggerBtn;

  if (!targetInput) {
    console.warn('[MyReminder] startVoiceDictation: targetInput missing');
    return null;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (statusEl) {
      statusEl.textContent = 'Voice-to-Text (SpeechRecognition) is not supported in this browser. Try Chrome or Edge.';
    }
    return null;
  }

  if (triggerBtn && triggerBtn._activeRecognition) {
    try {
      triggerBtn._activeRecognition.stop();
    } catch (_) {}
    triggerBtn._activeRecognition = null;
    triggerBtn.classList.remove('is-recording');
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = opts.lang || 'en-US';
  recognition.interimResults = true;
  recognition.continuous = false;

  const baseValue = targetInput.value ? `${targetInput.value.trim()} ` : '';

  if (triggerBtn) {
    triggerBtn._activeRecognition = recognition;
    triggerBtn.classList.add('is-recording');
  }
  if (statusEl) {
    statusEl.textContent = `Listening (${recognition.lang})… Speak your reminder or note now.`;
  }

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = 0; i < event.results.length; i += 1) {
      transcript += event.results[i][0].transcript;
    }
    targetInput.value = `${baseValue}${transcript}`.trim();
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
  };

  recognition.onerror = (event) => {
    if (statusEl) {
      statusEl.textContent = `Voice dictation stopped (${event.error || 'error'}).`;
    }
  };

  recognition.onend = () => {
    if (triggerBtn) {
      triggerBtn._activeRecognition = null;
      triggerBtn.classList.remove('is-recording');
    }
    if (statusEl && statusEl.textContent.startsWith('Listening')) {
      statusEl.textContent = 'Voice-to-Text captured.';
    }
    if (typeof opts.onComplete === 'function') {
      opts.onComplete(targetInput.value);
    }
  };

  try {
    recognition.start();
  } catch (err) {
    console.warn('[MyReminder] SpeechRecognition start error:', err);
  }

  return recognition;
};
