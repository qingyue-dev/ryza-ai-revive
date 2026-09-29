/* Speech provider registry: one row per backend. */

(function (global) {
  'use strict';

  var ROWS = [
    {
      id: 'openai', kind: 'tts',
      label: 'settings.tts.provider.openai',
      creds: { baseUrl: 'tts.baseUrl', apiKey: 'tts.apiKey', model: 'tts.modelPreset', modelClone: 'tts.modelClone', voice: 'tts.presetVoice' },
      capabilities: { instructions: true, emotion: false, clone: true, local: false }
    },
    {
      id: 'qwen', kind: 'tts',
      label: 'settings.tts.provider.qwen',
      creds: { baseUrl: 'tts.qwenBaseUrl', apiKey: 'tts.qwenApiKey', model: 'tts.qwenModel', voice: 'tts.qwenVoice' },
      capabilities: { instructions: true, emotion: false, clone: true, local: false },
      defaults: { model: 'qwen3-tts-flash' }
    },
    {
      id: 'fish', kind: 'tts',
      label: 'settings.tts.provider.fish',
      creds: { baseUrl: 'tts.fishBaseUrl', apiKey: 'tts.fishApiKey', model: 'tts.fishModel', voice: 'tts.fishVoice', voiceAsmr: 'tts.fishVoiceAsmr' },
      capabilities: { instructions: true, emotion: true, clone: true, local: false },

      defaults: { model: 's2.1-pro-free' }
    },
    {
      id: 'voicevox', kind: 'tts',
      label: 'settings.tts.provider.voicevox',
      creds: { baseUrl: 'tts.voicevoxBaseUrl', voice: 'tts.voicevoxVoice' },
      defaults: { baseUrl: 'http://127.0.0.1:50021/', voice: '0' },
      capabilities: { instructions: false, emotion: false, clone: false, local: true }
    },
    {
      id: 'aivis', kind: 'tts',
      label: 'settings.tts.provider.aivis',
      creds: { baseUrl: 'tts.aivisBaseUrl', voice: 'tts.aivisVoice' },
      defaults: { baseUrl: 'http://127.0.0.1:10101/', voice: '0' },
      capabilities: { instructions: false, emotion: false, clone: false, local: true }
    },
    {
      id: 'whisper', kind: 'stt',
      label: 'settings.stt.provider.whisper',
      creds: { baseUrl: 'stt.baseUrl', apiKey: 'stt.apiKey', model: 'stt.model' },
      defaults: { model: 'whisper-1' },
      capabilities: { local: false }
    }
  ];

  var BY_ID = {};
  ROWS.forEach(function (r) { BY_ID[r.id] = r; });

  function pick(tts, field, fallback) {
    if (!field) return '';
    var v = tts ? tts[field.split('.').pop()] : '';
    if (v == null || v === '') return fallback == null ? '' : fallback;
    return String(v);
  }

  function voicevoxSpeak(row, ctx) {
    var base = String(ctx.creds.baseUrl || '').trim();
    if (!base) return Promise.reject(named('NO_URL', row.id));
    base = base.replace(/\/+$/, '') + '/';
    var style = String(ctx.creds.voice || '').trim() || '0';
    var text = encodeURIComponent(String(ctx.text || ''));

    function fail(what, status) {
      var e = new Error(row.id + ': ' + what + (status ? ' (HTTP ' + status + ')' : ''));
      e.hint = 'local-engine';
      return e;
    }

    return ctx.fetch(base + 'audio_query?text=' + text + '&speaker=' + encodeURIComponent(style),
                     { method: 'POST' })
      .then(function (r) {
        if (!r.ok) throw fail('audio_query failed', r.status);
        return r.json();
      })
      .then(function (query) {
        return ctx.fetch(base + 'synthesis?speaker=' + encodeURIComponent(style), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(query)
        });
      })
      .then(function (r) {
        if (!r.ok) throw fail('Synthesis failed', r.status);
        return r.blob();
      })
      .then(function (blob) { return URL.createObjectURL(blob); })
      .catch(function (e) {
        if (e && e.hint === 'local-engine') throw e;
        var err = new Error(row.id + ': Unable to connect to the local engine (not running or not allowing cross-origin requests) ');
        err.hint = 'local-engine';
        err.cause = e;
        throw err;
      });
  }

  function named(code, id) {
    var e = new Error(code);
    e.provider = id;
    return e;
  }

  var Providers = {
    rows: ROWS,

    get: function (id) { return BY_ID[id] || null; },

    ids: function (kind) {
      return ROWS.filter(function (r) { return !kind || r.kind === kind; })
        .map(function (r) { return r.id; });
    },

    credentials: function (tts) {
      tts = tts || {};
      var row = BY_ID[tts.provider] || BY_ID.openai;
      var c = row.creds;
      var model = pick(tts, c.model, row.defaults && row.defaults.model);
      if (row.id === 'openai' && String(tts.mode || '') === 'clone') {
        model = pick(tts, c.modelClone, model);
      }
      return {
        id: row.id,
        capabilities: row.capabilities,
        baseUrl: pick(tts, c.baseUrl, row.defaults && row.defaults.baseUrl),
        apiKey: pick(tts, c.apiKey),
        model: model,
        voice: pick(tts, c.voice, row.defaults && row.defaults.voice),
        /* Only fish names one today; '' on every other row. */
        voiceAsmr: pick(tts, c.voiceAsmr)
      };
    },

    sttCredentials: function (stt) {
      stt = stt || {};
      var row = BY_ID[stt.provider] && BY_ID[stt.provider].kind === 'stt'
        ? BY_ID[stt.provider]
        : ROWS.filter(function (r) { return r.kind === 'stt'; })[0];
      if (!row) return { id: '', capabilities: {}, baseUrl: '', apiKey: '', model: '' };
      var c = row.creds;
      return {
        id: row.id,
        capabilities: row.capabilities,
        baseUrl: pick(stt, c.baseUrl, row.defaults && row.defaults.baseUrl),
        apiKey: pick(stt, c.apiKey),
        model: pick(stt, c.model, row.defaults && row.defaults.model)
      };
    },

    idsOfKind: function (kind) {
      return ROWS.filter(function (r) { return r.kind === kind; })
        .map(function (r) { return r.id; });
    },

    speakLocal: function (creds, ctx) {
      var row = BY_ID[creds && creds.id];
      if (!row || !row.capabilities.local) return Promise.reject(named('NOT_LOCAL', creds && creds.id));
      return voicevoxSpeak(row, { text: ctx.text, fetch: ctx.fetch, creds: creds });
    },

    isLocal: function (id) {
      var row = BY_ID[id];
      return !!(row && row.capabilities.local);
    }
  };

  global.Providers = Providers;
})(typeof window !== 'undefined' ? window : globalThis);
