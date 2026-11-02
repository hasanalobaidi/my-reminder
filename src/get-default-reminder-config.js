'use strict';

function getDefaultReminderConfig() {
  return {
    port: 5252,
    brandColor: '#8A1538',
    preventMacSleep: true,
    ttsEnabled: true,
    ttsUseMacSay: true,
    ttsUseBrowserSpeech: true,
    ttsVoice: 'Samantha',
    ttsLang: 'en-US',
    ttsRate: 185,
    nativeFullscreenEnabled: true,
    soundEnabled: true,
    defaultSnoozeMinutes: 15,
    projects: [
      'QNA post editor',
      'Infographics',
      'Weather Video',
      'General'
    ]
  };
}

module.exports = getDefaultReminderConfig;
