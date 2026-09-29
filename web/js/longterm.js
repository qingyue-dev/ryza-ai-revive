/* longterm.js — 长期记忆：带日期的条目 + 压缩摘要。*/

(function (global) {
  'use strict';

  var KEY = 'ryza.longterm.v1';
  var ENTRY_LIMIT = 40;
  var DIGEST_MAX = 1600;
  var DIGEST_PROMPT_MAX = 800;l
  var SELECT_LIMIT = 12;
  var SUMMARY_MAX = 120;
  var KEYWORD_MAX = 8;
  var PENDING_MAX = 20;
  var DIALOGUE_MAX = 12000;

  /* 受保护类别：这些条目即使超出上限也不删（只能由新内容取代） */
  var PROTECTED = ['promise', 'confession', 'deep_hurt', 'relationship_turning_point', 'major_life_event'];

  /* 「回忆提示」触发词：命中就提升相关度 */
  var RECENT_CUE = /昨天|前天|之前|上次|还记得|记得|remember|yesterday|昨日|前回|あの時/;

  var CONSOLIDATE_SYS = [
    'You are responsible for maintaining a limited, reliable long-term memory. Output JSON only. Do not include Markdown or explanations.',
    'Format: {"digest":"A chronological narrative summary","entries":[{"date":"YYYY-MM-DD",',
    '"category":"Category","importance":1,"summary":"Concise fact","status":"active",',
    '"keywords":["keywords"]}]}',
    'Merge old memories with recent conversations and remove duplicates; update the original entry when the same event occurs instead of creating a duplicate.',
    'Keep only stable preferences, important experiences, changes in relationships, unfinished commitments, and information that will genuinely be useful in the future;',
    'Remove casual greetings, one-time pleasantries, and redundant information. Maximum ' + ENTRY_LIMIT + ' entries.',
    'Information that is not suitable as a standalone entry but is still worth preserving should be included in digest (in chronological order, ≤ ' + DIGEST_MAX + ' characters).',
    'importance ranges from 1-5. Use promise for vows/commitments, confession for confessions, deep_hurt for profound emotional harm,',
    'relationship_turning_point for relationship turning points, and major_life_event for major life events;',
    'These categories must be assigned importance 5 and must not be deleted unless explicitly withdrawn or resolved in a recent conversation. Do not fabricate dates or details.'
  ].join('\n');

  var _llm = null;
  var _clock = null;

  function nowInfo() {
    if (_clock) return _clock();
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return {
      iso: d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()),
      day: d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
    };
  }

  function clip(s, n) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
  }

  function blank() {
    return { v: 1, updatedAt: '', digest: '', entries: [], pending: [] };
  }

  var state = blank();

  function load() {
    var raw = 'null';
    try { raw = localStorage.getItem(KEY) || 'null'; } catch (e) {}
    var j = null;
    try { j = JSON.parse(raw); } catch (e) {}
    if (j && j.v === 1 && Array.isArray(j.entries)) {
      state = {
        v: 1,
        updatedAt: String(j.updatedAt || ''),
        digest: clip(j.digest, DIGEST_MAX),
        entries: j.entries.filter(validEntry).map(normEntry),
        pending: (j.pending || []).filter(validTurn).slice(-PENDING_MAX)
      };
    } else {
      state = blank();
    }
    return state;
  }

  function persist() {
    try {
      var out = {
        v: 1, updatedAt: state.updatedAt, digest: clip(state.digest, DIGEST_MAX),
        entries: state.entries.slice(0, ENTRY_LIMIT).map(normEntry),
        pending: state.pending.slice(-PENDING_MAX)
      };
      localStorage.setItem(KEY, JSON.stringify(out));
    } catch (e) { }
  }

  function validEntry(e) {
    return e && typeof e === 'object' && typeof e.summary === 'string' && e.summary;
  }
  function normEntry(e) {
    return {
      id: e.id || ('e' + Math.random().toString(36).slice(2, 9)),
      date: clip(e.date, 10) || nowInfo().day,
      category: clip(e.category, 32) || 'general',
      importance: Math.max(1, Math.min(5, parseInt(e.importance, 10) || 3)),
      summary: clip(e.summary, SUMMARY_MAX),
      status: (e.status === 'retired') ? 'retired' : 'active',
      keywords: (Array.isArray(e.keywords) ? e.keywords : [])
        .map(function (k) { return clip(k, 16); }).filter(Boolean).slice(0, KEYWORD_MAX)
    };
  }
  function validTurn(t) {
    return t && (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string';
  }

  function isProtected(e) {
    return PROTECTED.indexOf(e.category) !== -1 || e.importance >= 5;
  }
  
  function score(e, cue) {
    var s = e.importance;
    if (e.status !== 'active') s -= 3;
    if (!cue) return s;
    var low = cue.toLowerCase();
    if (e.date && cue.indexOf(e.date) !== -1) s += 4;
    e.keywords.forEach(function (k) {
      if (k && low.indexOf(String(k).toLowerCase()) !== -1) s += 3;
    });
    if (e.summary && low.indexOf(e.summary.slice(0, 8).toLowerCase()) !== -1) s += 3;
    if (RECENT_CUE.test(cue)) s += 1;
    return s;
  }

  function selectEntries(cue, limit) {
    var live = state.entries.filter(function (e) { return e.status === 'active'; });
    return live
      .map(function (e) { return { e: e, s: score(e, cue) }; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, limit || SELECT_LIMIT)
      .map(function (x) { return x.e; });
  }

  function enforceLimit() {
    if (state.entries.length <= ENTRY_LIMIT) return 0;
    var sorted = state.entries.slice().sort(function (a, b) {
      var pa = isProtected(a) ? 1 : 0, pb = isProtected(b) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return (b.importance - a.importance) || String(b.date).localeCompare(String(a.date));
    });
    var keep = sorted.slice(0, ENTRY_LIMIT);
    var fold = sorted.slice(ENTRY_LIMIT);
    state.entries = keep;
    if (fold.length) {
      var note = fold.map(function (e) { return e.date + ' ' + e.summary; }).join('；');
      state.digest = clip((state.digest ? state.digest + ' ' : '') + note, DIGEST_MAX);
    }
    return fold.length;
  }

  function sameKey(e) {
    var t = String(e.summary || '')
      .replace(/[\s　]+/g, '')
      .replace(/[。、，．,.!！?？「」『』（）()【】\[\]:：;；…—~〜-]/g, '')
      .toLowerCase();
    return String(e.date) + '#' + t.slice(0, 14);
  }

  function parseConsolidation(text) {
    var s = String(text || '').trim();
    /* 模型可能套 ```json ```，剥掉 */
    s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    var i = s.indexOf('{'), j = s.lastIndexOf('}');
    if (i < 0 || j <= i) return null;
    try { return JSON.parse(s.slice(i, j + 1)); } catch (e) { return null; }
  }

  function mergeConsolidation(obj) {
    if (!obj) return false;
    var added = 0;
    if (typeof obj.digest === 'string' && obj.digest.trim()) {
      state.digest = clip(obj.digest, DIGEST_MAX);
    }
    var incoming = (Array.isArray(obj.entries) ? obj.entries : [])
      .filter(validEntry).map(normEntry);
    incoming.forEach(function (ne) {
      var dup = null;
      var key = sameKey(ne);
      state.entries.forEach(function (e) {
        if (dup) return;
        if (sameKey(e) === key) dup = e;
      });
      if (dup) {
        dup.summary = ne.summary;
        dup.importance = Math.max(dup.importance, ne.importance);
        dup.category = ne.category;
        dup.keywords = ne.keywords;
        dup.status = ne.status;
      } else {
        state.entries.push(ne);
        added++;
      }
    });
    enforceLimit();
    state.updatedAt = nowInfo().iso;
    persist();
    return added > 0 || incoming.length > 0;
  }

  var LongTerm = {
    LIMITS: { ENTRY_LIMIT: ENTRY_LIMIT, DIGEST_MAX: DIGEST_MAX, SELECT_LIMIT: SELECT_LIMIT, PENDING_MAX: PENDING_MAX, PROTECTED: PROTECTED },

    _state: function () { return state; },
    _reset: function () { state = blank(); persist(); },

    setLLM: function (fn) { _llm = (typeof fn === 'function') ? fn : null; },
    setClock: function (fn) { _clock = (typeof fn === 'function') ? fn : null; },

    load: load,

    /* 记一轮对话（未归纳）。够 PENDING_MAX 就尝试归纳一次。 */
    note: function (role, text, opts) {
      var t = clip(text, 600);
      if (!t || (role !== 'user' && role !== 'assistant')) return false;
      state.pending.push({ role: role, text: t, at: nowInfo().iso });
      while (state.pending.length > PENDING_MAX) state.pending.shift();
      persist();
      if (!(opts && opts.noConsolidate)) LongTerm.maybeConsolidate();
      return true;
    },

    pendingTurns: function () { return state.pending.length; },

    consolidate: function () {
      if (!_llm) return Promise.resolve(null);
      var body = JSON.stringify({
        now: nowInfo().iso,
        previous: { digest: state.digest, entries: state.entries },
        dialogue: state.pending
      });
      if (body.length > DIALOGUE_MAX) body = body.slice(0, DIALOGUE_MAX);
      return Promise.resolve(_llm(CONSOLIDATE_SYS, body, { maxTokens: 1200 }))
        .then(function (text) {
          var obj = parseConsolidation(text);
          var pending = state.pending.slice();
          state.pending = [];
          if (!obj) {
            var note = pending.map(function (p) { return p.role + ': ' + p.text; }).join(' | ');
            if (!note) note = ' (This round of consolidation did not return usable JSON) ';
            state.digest = clip((state.digest ? state.digest + ' ' : '') + note, DIGEST_MAX);
            persist();
            return null;
          }
          mergeConsolidation(obj);
          return obj;
        })
        .catch(function () {
          return null;
        });
    },

    maybeConsolidate: function () {
      if (state.pending.length < PENDING_MAX) return Promise.resolve(null);
      return LongTerm.consolidate();
    },

    promptBlock: function (cue) {
      var L = [];
      var digest = clip(state.digest, DIGEST_PROMPT_MAX);
      if (digest) {
        L.push('## Long-Term Memory (Overview) ');
        L.push(digest);
      }
      var picked = selectEntries(cue || '', SELECT_LIMIT);
      if (picked.length) {
        L.push('## Long-Term Memory (Events) ');
        picked.forEach(function (e) {
          L.push('- [' + e.date + '] ' + e.summary);
        });
      }
      return L.join('\n');
    },

    add: function (summary, opts) {
      opts = opts || {};
      var ne = normEntry({
        date: opts.date, category: opts.category, importance: opts.importance,
        summary: summary, keywords: opts.keywords
      });
      if (!ne.summary) return null;
      state.entries.push(ne);
      enforceLimit();
      persist();
      return ne;
    },

    list: function (opts) {
      opts = opts || {};
      if (opts.activeOnly) {
        return state.entries.filter(function (e) { return e.status === 'active'; });
      }
      return state.entries.slice();
    },

    digest: function () { return state.digest; },

    /* 受保护/重要条目：给玩家看的「不能忘的事」 */
    protectedEntries: function () {
      return state.entries.filter(isProtected);
    },

    remove: function (id) {
      var n = state.entries.length;
      state.entries = state.entries.filter(function (e) { return e.id !== id; });
      if (state.entries.length === n) return false;
      persist();
      return true;
    },

    /* 导出/导入（换设备用） */
    export: function () {
      return JSON.stringify({
        v: 1, updatedAt: state.updatedAt, digest: state.digest,
        entries: state.entries.map(normEntry)
      });
    },
    import: function (json) {
      var obj = null;
      try { obj = JSON.parse(json); } catch (e) { return false; }
      if (!obj || !Array.isArray(obj.entries)) return false;
      state.digest = clip(obj.digest, DIGEST_MAX);
      obj.entries.filter(validEntry).forEach(function (e) { state.entries.push(normEntry(e)); });
      enforceLimit();
      persist();
      return true;
    },

    /* 供回归直接验的纯函数 */
    _score: score,
    _isProtected: isProtected,
    _select: selectEntries,
    _parse: parseConsolidation,
    _merge: mergeConsolidation
  };

  load();
  global.LongTerm = LongTerm;
})(typeof window !== 'undefined' ? window : globalThis);
