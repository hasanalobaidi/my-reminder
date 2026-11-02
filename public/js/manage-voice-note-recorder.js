'use strict';

window.QNA = window.QNA || {};

window.QNA.manageVoiceNoteRecorder = function manageVoiceNoteRecorder(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const recordBtn = opts.recordBtn;
  const statusEl = opts.statusEl;
  const labelInput = opts.labelInput;
  const getReminderId = opts.getReminderId;
  const onUploaded = opts.onUploaded;

  if (!recordBtn) {
    console.warn('[MyReminder] manageVoiceNoteRecorder: recordBtn missing');
    return;
  }

  let mediaRecorder = null;
  let chunks = [];
  let startedAt = 0;

  recordBtn.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (statusEl) statusEl.textContent = 'Microphone recording is not available in this browser.';
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      startedAt = Date.now();
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        recordBtn.classList.remove('is-recording');
        recordBtn.textContent = '🎙️ Record Voice Note';
        const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });

        if (statusEl) statusEl.textContent = 'Saving voice note…';

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Data = reader.result;
          const label = (labelInput && labelInput.value.trim()) || `Voice Note (${durationSec}s)`;
          const reminderId = typeof getReminderId === 'function' ? getReminderId() : '';

          try {
            const resp = await fetch('/api/voice-notes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                reminderId,
                label,
                mimeType,
                durationSec,
                base64Data
              })
            });
            const data = await resp.json();
            if (data && data.ok && data.voiceNote) {
              if (labelInput) labelInput.value = '';
              if (statusEl) statusEl.textContent = `Saved: ${data.voiceNote.label}`;
              if (typeof onUploaded === 'function') onUploaded(data.voiceNote);
            } else if (statusEl) {
              statusEl.textContent = (data && data.error) || 'Failed to save voice note.';
            }
          } catch (err) {
            if (statusEl) statusEl.textContent = `Upload failed: ${err.message}`;
          }
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start();
      recordBtn.classList.add('is-recording');
      recordBtn.textContent = '⏹️ Stop & Save Recording';
      if (statusEl) statusEl.textContent = 'Recording voice note… Click Stop when finished.';
    } catch (err) {
      if (statusEl) statusEl.textContent = `Microphone permission denied or unavailable: ${err.message}`;
    }
  });
};
