/* historystore.js — Stores past chat sessions so the user can browse and
   resume them. Each entry holds the full log + AI context from ChatStore.
   Sorted newest-first; loading a session bumps its updatedAt to the top.
   
   v2: realtime save (saveOrUpdate), i18n title generated at render time. */

(function (global) {
  'use strict';

  var KEY = 'ryza.chathistory.v1';
  var MAX_SESSIONS = 50;

  var state = [];
  var _activeId = null;

  function uid() {
    return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function persist() {
    try { global.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      var arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr)) {
        state = arr.filter(function (s) {
          return s && s.id && Array.isArray(s.log);
        });
        return;
      }
    } catch (e) {}
    state = [];
  }

  function modeCount(mode) {
    return state.filter(function (s) { return s.mode === mode; }).length;
  }

  function titleFor(mode, num) {
    var T = global.I18n && global.I18n.t ? global.I18n : null;
    var prefix = T ? T.t('history.modeLabel.' + (mode || 'chat')) : ('Ryza ' + (mode || 'Chat'));
    return prefix + ' #' + num;
  }

  function generateDesc(log, onDone) {
    if (!global.Api || typeof Api.complete !== 'function') {
      onDone('');
      return;
    }
    var lang = (global.I18n && global.I18n.lang) ? global.I18n.lang : 'en';
    var langNames = {
      zh: '简体中文', 'zh-tw': '繁體中文', ja: '日本語', en: 'English',
      hi: 'हिन्दी', id: 'Bahasa Indonesia', 'pt-br': 'Português (Brasil)'
    };
    var langName = langNames[lang] || 'English';
    var lines = log.slice(-20).map(function (m) {
      var who = m.r === 'u' ? 'You' : 'Ryza';
      return who + ': ' + String(m.t || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    }).join('\n');

    var sys = 'Summarize this chat log in ONE short sentence (max 15 words) in ' + langName + '. ' + 'Focus on what happened or what was discussed. No quotes, no labels, just the sentence. ' + 'The output MUST stay on a single line with no line breaks. If the content is too long, shorten or truncate it and use "..." at the end instead of creating a new line.';
    Api.complete(sys, lines, { maxTokens: 60, temperature: 0.3 })
      .then(function (text) { onDone((text || '').trim().slice(0, 120)); })
      .catch(function () { onDone(''); });
  }

  var HistoryStore = {
    load: load,
    list: function () { return state.slice(); },
    getActiveId: function () { return _activeId; },
    setActiveId: function (id) { _activeId = id; },
    clearActive: function () { _activeId = null; },
    displayTitle: function (session) {
      if (!session) return '';
      return titleFor(session.mode, session.num || 1);
    },
    saveSession: function (log, history, mode) {
      if (!log || !log.length) return null;
      var id = uid();
      var num = modeCount(mode || 'chat') + 1;
      var entry = {
        id: id,
        num: num,
        mode: mode || 'chat',
        description: '', 
        log: log.slice(),
        history: history ? history.slice() : [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      state.unshift(entry);
      if (state.length > MAX_SESSIONS) state = state.slice(0, MAX_SESSIONS);
      persist();

      generateDesc(log, function (desc) {
        var s = HistoryStore.get(id);
        if (s) { s.description = desc; persist(); }
        if (typeof HistoryStore.onDescReady === 'function') HistoryStore.onDescReady(id, desc);
      });

      return id;
    },

    saveOrUpdate: function (log, history, mode) {
      if (!log || !log.length) return null;

      if (_activeId) {
        var s = HistoryStore.get(_activeId);
        if (s) {
          s.log = log.slice();
          s.history = history ? history.slice() : [];
          s.updatedAt = Date.now(); 
          var idx = state.indexOf(s);
          if (idx > 0) { state.splice(idx, 1); state.unshift(s); }
          persist();
          (function (capturedId) {
            generateDesc(log, function (desc) {
              var sess = HistoryStore.get(capturedId);
              if (sess) { sess.description = desc; persist(); }
              if (typeof HistoryStore.onDescReady === 'function') HistoryStore.onDescReady(capturedId, desc);
            });
          })(_activeId);
          return _activeId;
        }
      }

      _activeId = HistoryStore.saveSession(log, history, mode);
      return _activeId;
    },

    get: function (id) {
      for (var i = 0; i < state.length; i++) {
        if (state[i].id === id) return state[i];
      }
      return null;
    },

    touch: function (id) {
      var idx = -1;
      for (var i = 0; i < state.length; i++) {
        if (state[i].id === id) { idx = i; break; }
      }
      if (idx < 0) return;
      var entry = state.splice(idx, 1)[0];
      entry.updatedAt = Date.now();
      state.unshift(entry);
      persist();
    },

    remove: function (id) {
      if (_activeId === id) _activeId = null;
      state = state.filter(function (s) { return s.id !== id; });
      persist();
    },

    clear: function () { state = []; _activeId = null; persist(); }
  };

  load();
  global.HistoryStore = HistoryStore;
})(typeof window !== 'undefined' ? window : globalThis);
