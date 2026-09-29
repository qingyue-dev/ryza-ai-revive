/* Settings store. Everything lives in localStorage; there is no server. */

(function (global) {
  'use strict';

  var KEY = 'ryza.settings.v1';

  var DEFAULTS = {
    llm: {
      baseUrl: '',
      model: 'gpt-4o-mini',
      apiKey: '',
      temperature: 0.9,
      maxTokens: 400,
      historyTurns: 12,
      contextWindow: 0,
      thinking: 'auto',
      thinkingEffort: 'default',
      thinkingStyle: 'auto',
      lang: 'auto'
    },

    memory: {
      enabled: true,
      turnsPerSession: 8,
      sessionCap: 8,
      summaryCap: 8
    },

    /* ---- TTS providers ---- */
    stt: {
      provider: 'whisper',
      baseUrl: '',
      apiKey: '',
      model: 'whisper-1',
      engine: 'auto'
    },
    tts: {
      provider: 'openai',
      baseUrl: '',
      apiKey: '',
      mode: 'clone',
      modelClone: 'voice-clone-model',
      modelPreset: 'tts-model',
      presetVoice: 'Chloe',
      format: 'wav',
      reference: 'assets/voice/ryza_wav/prologue_08.wav',
      styleHint: 'A bright, cheerful young woman\'s voice, spoken in a friendly tone.',
      modeHints: {},
      qwenBaseUrl: '',
      qwenApiKey: '',
      qwenModel: 'qwen3-tts-flash', 
      qwenVoice: 'Cherry',
      qwenCloneTarget: 'qwen3-tts-vc-2026-01-22',
      fishBaseUrl: '',
      fishApiKey: '',
      fishModel: '',
      fishVoice: '',
      fishVoiceAsmr: '',
      lang: 'auto'
    },

    /* ---- language matrix (all independent) ---- */
    voice: { lang: 'auto' },

    /* ---- character / persona (fed into the system prompt) ---- */
    chara: {
      personality: 'A cheerful, optimistic, and slightly clumsy alchemist',
      likes: 'Mixing, adventure, sweets',
      dislikes: 'Stay still',
      situation: 'I\'m at my home on Kuken Island, spending time with you.',
      callMe: 'You',
      extra: ''
    },

    /* ---- player profile (onboarding answers) ---- */
    profile: {
      name: '', birthday: '', gender: '',
      appearance: '', background: '', hobby: '', interest: '',
      interestExtra: '', storyStart: '',
      futureGoals: '', personality: ''
    },

    audio: { bgm: 0.55, ambient: 0.45, voice: 1, se: 0.85 },

    /* ---- presentation ---- */
    app: {
      lang: 'en',
      voice: true,
      volume: 0.9,
      textSpeed: 30,
      vibration: true,
      fullscreen: false,
      rim: true,
      nsfwEnabled: false,
      showBubble: true,
      stt: 'off',
      autoSend: false,
      autoSendDelay: 2000,
      npcFrequency: 'normal',
      bargeIn: false,
      quickCollapsed: false,
      timeMode: 'real',
      flowSpeed: 60,
      cheat: false
    },

    /* ---- session state ---- */
    state: {
      mode: 'chat',
      style: 'voice',
      skin: 'crf_skn_002_0001',
      stage: 'stage_01_001_04',
      tod: 'aft',
      posture: 'posture_standing',
      day: 1,
      lastDayDate: '',
      gameHour: 12,
      gameClockAt: 0,
      todManualUntil: 0,
      onboardingDone: false,
      welcome: { talk: false, map: false, alarm: false, skin: false, quest: false }
    }
  };

  function deepMerge(base, patch) {
    var out = Array.isArray(base) ? base.slice() : {};
    var k;
    for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    for (k in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
      var v = patch[k];
      out[k] = (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) ? deepMerge(base[k], v) : v;
    }
    return out;
  }

  var data;
  try {
    data = deepMerge(DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}'));
  } catch (e) {
    data = deepMerge(DEFAULTS, {});
  }
  if (data.state && data.state.skin) {
    data.state.skin = String(data.state.skin).replace(/_(01|99)$/, '');
  }
  if (data.tts && data.tts.provider === 'qwen') {
    if (!data.tts.qwenApiKey && data.tts.apiKey) data.tts.qwenApiKey = data.tts.apiKey;
    if (!data.tts.qwenBaseUrl && data.tts.baseUrl) data.tts.qwenBaseUrl = data.tts.baseUrl;
  }
  if (data.tts && data.tts.fishVoice === '2bc96959c27d41cc87d517b83569d43a') {
    data.tts.fishVoice = '';
  }
  if (data.tts && !data.tts.fishModelMigrated) {
    var fbase = String(data.tts.fishBaseUrl || '');
    var legacyHost = /fishaudio\.org|\/api\/open\//i.test(fbase);
    if (!legacyHost && data.tts.fishModel === 'fishaudio-s21pro-flash') {
      data.tts.fishModel = '';
    }
    data.tts.fishModelMigrated = true;
  }
  if (data.state && !data.state.postureMigrated) {
    data.state.posture = 'posture_standing';
    data.state.postureMigrated = true;
  }
  
  var TEXT_SPEEDS = [
    { v: 30, icon: 'text_speed_1x' },
    { v: 18, icon: 'text_speed_15x' },
    { v: 12, icon: 'text_speed_2x' },
    { v: 8,  icon: 'text_speed_3x' }
  ];

  var Config = {
    TEXT_SPEEDS: TEXT_SPEEDS,
    textSpeed: function () {
      var v = Number(data.app && data.app.textSpeed);
      for (var i = 0; i < TEXT_SPEEDS.length; i++) {
        if (TEXT_SPEEDS[i].v === v) return v;
      }
      return TEXT_SPEEDS[0].v;
    },
    get: function () { return data; },
    section: function (name) { return data[name]; },
    set: function (path, value) {
      var parts = path.split('.'), node = data, i;
      for (i = 0; i < parts.length - 1; i++) {
        if (typeof node[parts[i]] !== 'object' || node[parts[i]] === null) node[parts[i]] = {};
        node = node[parts[i]];
      }
      node[parts[parts.length - 1]] = value;
      Config.save();
    },
    save: function () {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
    },
    reset: function () {
      data = deepMerge(DEFAULTS, {});
      Config.save();
    },
    exportJSON: function () { return JSON.stringify(data, null, 2); },
    importJSON: function (text) {
      var parsed = JSON.parse(text);
      data = deepMerge(DEFAULTS, parsed);
      if (data.state && data.state.skin) {
        data.state.skin = String(data.state.skin).replace(/_(01|99)$/, '');
      }
      Config.save();
    },
    eraseAll: function () {
      var doomed = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('ryza.') === 0) doomed.push(k);
      }
      doomed.forEach(function (k) { localStorage.removeItem(k); });
      data = deepMerge(DEFAULTS, {});
      Config._hydrated = Promise.resolve();   
    },
    
    hydrate: function () {
      if (Config._hydrated) return Config._hydrated;
      Config._hydrated = fetch('config/providers.json').then(function (r) {
        return r.ok ? r.json() : null;
      }).then(function (p) {
        if (!p) return;
        function hostOf(u) {
          try { return new URL(u).host; } catch (e) { return ''; }
        }
        if (p.llm) {
          var llmHostOk = p.llm.base_url && hostOf(data.llm.baseUrl) === hostOf(p.llm.base_url);
          if (!data.llm.apiKey || !llmHostOk) {
            if (p.llm.base_url) data.llm.baseUrl = p.llm.base_url;
            if (p.llm.model) data.llm.model = p.llm.model;
            if (p.llm.api_key) data.llm.apiKey = p.llm.api_key;
            if (p.llm.temperature != null) data.llm.temperature = p.llm.temperature;
          }
        }
        if (p.tts) {
          var ttsHostOk = p.tts.base_url && hostOf(data.tts.baseUrl) === hostOf(p.tts.base_url);
          if (!data.tts.apiKey || !ttsHostOk) {
            if (p.tts.base_url) data.tts.baseUrl = p.tts.base_url;
            if (p.tts.api_key) data.tts.apiKey = p.tts.api_key;
            if (p.tts.model_clone) data.tts.modelClone = p.tts.model_clone;
            if (p.tts.model_preset) data.tts.modelPreset = p.tts.model_preset;
            if (p.tts.reference_audio) data.tts.reference = p.tts.reference_audio;
          }
          if (p.tts.qwen_api_key && !data.tts.qwenApiKey) {
            data.tts.qwenApiKey = p.tts.qwen_api_key;
            if (p.tts.qwen_base_url) data.tts.qwenBaseUrl = p.tts.qwen_base_url;
          }
          if (p.tts.fish_api_key && !data.tts.fishApiKey) {
            data.tts.fishApiKey = p.tts.fish_api_key;
            if (p.tts.fish_base_url) data.tts.fishBaseUrl = p.tts.fish_base_url;
            if (p.tts.fish_model) data.tts.fishModel = p.tts.fish_model;
            if (p.tts.fish_voice) data.tts.fishVoice = p.tts.fish_voice;
            if (p.tts.fish_voice_asmr) data.tts.fishVoiceAsmr = p.tts.fish_voice_asmr;
            if (p.tts.provider === 'fish') data.tts.provider = 'fish';
          }
        }
        Config.save();
      }).catch(function () {});
      return Config._hydrated;
    }
  };

  global.Config = Config;
})(window);
