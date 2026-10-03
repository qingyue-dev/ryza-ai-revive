/* chatstore.js — keeps the running conversation across app restarts.
   Saved: the display log, the AI context (history) and one "pending" slot for a
   message that was sent but not answered yet (so it can be re-sent after the
   player left the app). Everything lives under one localStorage key. */
   
(function (global) {
  'use strict';

  var KEY = 'ryza.chat.v1';
  var LOG_MAX = 200;
  var HIST_MAX = 200;

  function blank() { return { v: 1, log: [], history: [], pending: null, updatedAt: 0 }; }
  var state = blank();

  function cleanLog(a) {
    return (Array.isArray(a) ? a : []).filter(function (m) {
      return m && (m.r === 'u' || m.r === 'a') && typeof m.t === 'string';
    }).slice(-LOG_MAX);
  }
  function cleanHist(a) {
    return (Array.isArray(a) ? a : []).filter(function (m) {
      return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';
    }).slice(-HIST_MAX);
  }

  /* history entries carry a leading screen-state line; drop it for display */
  function stripTag(s) {
    var t = String(s || '');
    var nl = t.indexOf('\n');
    if (nl > 0 && /^\s*[\[<(]/.test(t.slice(0, nl)) && nl < 400) return t.slice(nl + 1).replace(/^\s+/, '');
    return t;
  }

  var ChatStore = {
    KEY: KEY,

    load: function () {
      state = blank();
      try {
        var j = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (j && typeof j === 'object') {
          state.log = cleanLog(j.log);
          state.history = cleanHist(j.history);
          var p = j.pending;
          if (p && typeof p.text === 'string' && p.text) {
            state.pending = { text: p.text, at: Number(p.at) || 0, failed: !!p.failed };
          }
          state.updatedAt = Number(j.updatedAt) || 0;
        }
      } catch (e) { state = blank(); }
      return state;
    },

    save: function () {
      state.updatedAt = Date.now();
      var body;
      try { body = JSON.stringify(state); } catch (e) { return false; }
      try { localStorage.setItem(KEY, body); return true; }
      catch (e) {
        state.log = state.log.slice(-60);
        state.history = state.history.slice(-60);
        try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (e2) { return false; }
      }
    },

    log: function () { return state.log; },
    history: function () { return state.history; },
    pending: function () { return state.pending; },
    hasConversation: function () { return state.log.length > 0; },

    logUser: function (text) {
      state.log.push({ r: 'u', t: String(text || ''), at: Date.now() });
      state.log = state.log.slice(-LOG_MAX);
      ChatStore.save();
    },
    logAi: function (text) {
      state.log.push({ r: 'a', t: String(text || ''), at: Date.now() });
      state.log = state.log.slice(-LOG_MAX);
    },
    setHistory: function (h) { state.history = cleanHist(h); },

    setPending: function (p) {
      state.pending = p ? { text: String(p.text || ''), at: Number(p.at) || Date.now(), failed: false } : null;
      ChatStore.save();
    },
    failPending: function () {
      if (state.pending) { state.pending.failed = true; ChatStore.save(); }
    },
    
    /* the reply landed: record it, refresh the context, and clear the pending slot */
    completeTurn: function (replyText, history) {
      ChatStore.logAi(replyText);
      ChatStore.setHistory(history);
      state.pending = null;
      ChatStore.save();
    },

    /* a save slot was loaded: rebuild the log from its history */
    adoptHistory: function (h) {
      state = blank();
      state.history = cleanHist(h);
      state.log = state.history.map(function (m) {
        return { r: m.role === 'user' ? 'u' : 'a', t: m.role === 'user' ? m.content : stripTag(m.content), at: 0 };
      });
      ChatStore.save();
    },

    /* "New talk": everything about the running conversation is dropped */
    reset: function () {
      state = blank();
      ChatStore.save();
    }
  };

  global.ChatStore = ChatStore;
})(window);
