'use strict';

window.QNA = window.QNA || {};

window.QNA.playAlarmChime = function playAlarmChime(mode) {
  if (mode === 'stop') {
    if (window.QNA._chimeInterval) {
      clearInterval(window.QNA._chimeInterval);
      window.QNA._chimeInterval = null;
    }
    return;
  }

  const playPattern = () => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      const ctx = new AudioCtx();
      const notes = [587.33, 880.0, 1174.66]; // D5, A5, D6 chime
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.16);
        gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + idx * 0.16 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.16 + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.16);
        osc.stop(ctx.currentTime + idx * 0.16 + 0.48);
      });
    } catch (_) {}
  };

  playPattern();
  if (mode === 'loop') {
    if (window.QNA._chimeInterval) clearInterval(window.QNA._chimeInterval);
    window.QNA._chimeInterval = setInterval(playPattern, 4500);
  }
};
