/* NPC dialogue: a second, third, fourth speaker in a reply that used to belong to Ryza alone.*/

(function (global) {
  'use strict';

  var FREQ = {
    restrained: 'Keep NPC participation minimal. Include no more than 1 NPC only when truly necessary.',
    normal: 'When there is an NPC relevant to the conversation, allow 1 NPC to naturally join in.',
    frequent: 'Naturally include 1 relevant NPC in the conversation every 2–3 turns.',
    lively: 'In most replies, have the most relevant NPC speak up on their own. Include 2 NPCs when necessary.'
  };

  var SPEAKER = [
    { kind: 'narrator', re: /^\s*(?:旁白|ナレーション|narrator|narasi|narração|वर्णन)\s*[:：]\s*/i },
    { kind: 'translation', re: /^\s*(?:译文|譯文|訳文|translation|terjemahan|tradução|अनुवाद)\s*[:：]\s*/i },
    { kind: 'ryza', re: /^\s*(?:莱莎(?:琳)?|ライザ(?:リン)?|ryza|ryza(?:lin)?)\s*[:：]\s*/i },
    { kind: 'npc', re: /^\s*ノンプレイヤーキャラクター\s*\[\s*([^\]\r\n]+?)\s*\]\s*[:：]\s*/ }
  ];

  function world() { return global.World || null; }

  function npcList() {
    var w = world();
    return (w && w.npcs && w.npcs.npcs) || [];
  }

  function resolveId(raw) {
    var s = String(raw == null ? '' : raw).trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return '';
    var want = s.indexOf('npc_') === 0 ? s : 'npc_' + s;
    var list = npcList();
    for (var i = 0; i < list.length; i++) if (list[i].id === want) return want;
    for (var j = 0; j < list.length; j++) if (list[j].id === s) return s;
    return '';
  }

  function nameOf(id, fallback) {
    var w = world();
    if (id && w && typeof w.npcName === 'function') {
      try {
        var n = w.npcName(id);
        if (n) return n;
      } catch (e) { }
    }
    return fallback || id || '';
  }

  function split(text) {
    var body = String(text == null ? '' : text);
    if (!body.trim()) return [];
    var lines = body.split(/\r?\n/);
    var beats = [];
    var current = null;

    function push(kind, id, label, chunk) {
      if (current) beats.push(current);
      current = { speaker: kind, id: id || '', name: label || '', text: chunk || '' };
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var matched = null, m = null;
      for (var s = 0; s < SPEAKER.length; s++) {
        m = SPEAKER[s].re.exec(line);
        if (m) { matched = SPEAKER[s].kind; break; }
      }
      if (matched === 'narrator') { push('narrator', '', '', line.replace(SPEAKER[0].re, '')); continue; }
      if (matched === 'translation') { push('translation', '', '', line.replace(SPEAKER[1].re, '')); continue; }
      if (matched === 'ryza') { push('ryza', '', '', line.replace(SPEAKER[2].re, '')); continue; }
      if (matched === 'npc') {
        var raw = m[1];
        var id = resolveId(raw);
        push('npc', id, nameOf(id, String(raw).trim()), line.replace(SPEAKER[3].re, ''));
        continue;
      }
      push('ryza', '', '', line);
    }
    if (current) beats.push(current);
    return beats.filter(function (b) { return b.text.trim() !== ''; });
  }

  /* Only her own words go to the synthesizer and to the emotion/action path. NPC and narration beats are text on screen, nothing else. */
  function spokenText(beats) {
    return beats.filter(function (b) { return b.speaker === 'ryza'; })
      .map(function (b) { return b.text; })
      .join('\n')
      .trim();
  }

  var TRANS_LABEL = {
    zh: '译文', 'zh-tw': '譯文', ja: '訳文', en: 'Translation',
    hi: 'अनुवाद', id: 'Terjemahan', 'pt-br': 'Tradução'
  };
  function translationLabel() {
    var lang = 'zh';
    try { if (global.Langs && Langs.ui) lang = Langs.ui() || 'zh'; } catch (e) {}
    return TRANS_LABEL[lang] || TRANS_LABEL.zh;
  }

  function labelFor(beat) {
    if (beat.speaker === 'ryza') return '';
    if (beat.speaker === 'narrator') return '';
    if (beat.speaker === 'translation') return translationLabel();
    return beat.name || beat.id || '';
  }

  function stripCues(s) {
    var src = String(s == null ? '' : s);
    var out = '';
    var depth = 0;
    for (var i = 0; i < src.length; i++) {
      var c = src.charAt(i);
      if (c === '[') { depth++; continue; }
      if (c === ']') { if (depth > 0) { depth--; continue; } }
      if (depth === 0) out += c;
    }
    return out.replace(/[ \t]{2,}/g, ' ').trim();
  }

  function hasLabels(text) {
    var body = String(text == null ? '' : text);
    var lines = body.split(String.fromCharCode(10));
    for (var i = 0; i < lines.length; i++) {
      for (var s2 = 0; s2 < SPEAKER.length; s2++) {
        if (SPEAKER[s2].re.exec(lines[i])) return true;
      }
    }
    return false;
  }

  /* 译文正文（多行用换行连接）。**只用于显示**，永远不进 TTS。 */
  function translationText(beats) {
    var list = Array.isArray(beats) ? beats : split(beats);
    return list.filter(function (b) { return b.speaker === 'translation'; })
      .map(function (b) { return b.text; })
      .join(String.fromCharCode(10))
      .trim();
  }

  /* ------------------------------------------------------------- candidates */
  function scoreOf(npc, st, day) {
    var w = world();
    var here = null;
    if (w && typeof w.placement === 'function') {
      try { here = (w.placement(day) || {})[npc.id] || null; } catch (e) { here = null; }
    }
    var score = 0;
    if (here && here === st.stageId) score = 120;
    (npc.bases || []).forEach(function (b) {
      var pct = Number(b.pct) || 0;
      var bs = null;
      if (w && typeof w.find === 'function') {
        try { bs = w.find(b.stageId); } catch (e) { bs = null; }
      }
      if (b.stageId === st.stageId) score = Math.max(score, pct * 100);
      else if (bs && st.fieldId && bs.fieldId === st.fieldId) score = Math.max(score, pct * 50);
      else if (bs && st.areaId && bs.areaId === st.areaId) score = Math.max(score, pct * 25);
    });
    var mv = npc.move || {};
    score += (Number(mv.stage) || 0) * 3 + (Number(mv.field) || 0) * 2 + (Number(mv.area) || 0);
    return score;
  }

  var Npc = {
    FREQ: FREQ,
    hasLabels: hasLabels,
    stripCues: stripCues,
    translationText: translationText,
    translationLabel: translationLabel,
    MIN_SCORE: 1,
    MAX_CANDIDATES: 6,
    split: split,
    spokenText: spokenText,
    labelFor: labelFor,
    resolveId: resolveId,
    nameOf: nameOf,
    candidates: function (stageId, day, limit) {
      var w = world();
      if (!w || !stageId) return [];
      var st = null;
      try { st = w.find(stageId); } catch (e) { st = null; }
      if (!st) return [];
      var out = [];
      npcList().forEach(function (n) {
        if (!n || !n.id) return;
        if (String(n.id).toLowerCase() === 'npc_ryza') return;
        var sc = scoreOf(n, st, day);
        if (sc > Npc.MIN_SCORE) {
          out.push({
            id: n.id, name: nameOf(n.id, n.name), note: n.note || '',
            score: sc, order: n.resolveOrder || 999
          });
        }
      });
      out.sort(function (a, b) { return (b.score - a.score) || (a.order - b.order); });
      return out.slice(0, limit || Npc.MAX_CANDIDATES);
    },

    frequency: function (appCfg) {
      var key = (appCfg && appCfg.npcFrequency) || 'normal';
      return FREQ[key] || FREQ.normal;
    },

    promptBlock: function (st, opts) {
      opts = opts || {};
      var w = world();
      if (!w || !st || !st.stage) return '';
      var cand = Npc.candidates(st.stage, st.day || 1);
      if (!cand.length) return '';
      var L = ['## Characters who may appear in this scene (other than Ryza)'];
      cand.forEach(function (c) {
        L.push('- ' + c.id + ': ' + c.name + (c.note ? ' (' + c.note + ')' : ''));
      });
      L.push('');
      L.push(Npc.frequency(opts.appCfg));
      L.push('Only if an NPC appears this turn, begin their line with "char[ID]:" (use the ID from the list above).');
      L.push('Your own lines (Ryza) start with "ryza:", narration starts with "narrator:". A line with no prefix is treated as Ryza\'s dialogue.');
      L.push('Every line must begin with the speaker. If dialogue spans multiple lines, repeat the speaker prefix on each continuation line.');
      L.push('Do not add emotion/action/voice tags to NPC or narrator lines (those resources do not exist). At most 1 NPC per turn, 2 when absolutely necessary.');

      if (opts.translate) {
        L.push("When the reply language differs from the player's UI language, you may add one translation line immediately after Ryza's dialogue, starting with \"translation:\".");
        L.push('The "translation:" line is shown on screen only and is never spoken aloud (the original is read).');
      }
      L.push('Do not invent details about characters not on the list above. Only their name and role are provided.');
      L.push('Do not place a character in the scene just because they were mentioned in conversation.');
      return L.join('\n');
    },

    _scoreOf: scoreOf
  };

  global.Npc = Npc;
})(typeof window !== 'undefined' ? window : globalThis);
