/* Settings & save slots: the assembly of every form in the settings sheet, the character form, the provider test buttons and the save-slot list */

(function (global) {
  'use strict';

  var SAVE_KEY = 'ryza.saves.v1';

  var Settings = {
    buildSettings: function () {
      var w = document.getElementById('settings-form');
      w.innerHTML = '';
      var T = function (k) { return I18n.t(k); };

      App._title(w, T('settings.llm'));
      App._field(w, T('settings.baseUrl'), Config.section('llm').baseUrl,
        function (v) { Config.set('llm.baseUrl', v); },
        { hint: 'OpenAI-compatible endpoint ending in /v1; you can also place it in config/providers.json for automatic hydration' });
      var models = App._llmModels || [];
      if (models.length) {
        var cur = Config.section('llm').model || '';
        var opts = models.map(function (m) {
          return { v: m.id, t: m.context ? (m.id + ' · ' + m.context) : m.id };
        });
        if (cur && !opts.filter(function (o) { return o.v === cur; }).length) {
          opts.unshift({ v: cur, t: cur });
        }
        App._select(w, T('settings.model'), cur, opts, function (v) {
          App._applyPickedModel(v);
        });
      } else {
        App._field(w, T('settings.model'), Config.section('llm').model,
          function (v) { Config.set('llm.model', v); },
          { hint: T('settings.model.hint') });
      }
      var fetchRow = document.createElement('div');
      fetchRow.className = 'btn-row';
      var bFetch = document.createElement('button');
      bFetch.type = 'button'; bFetch.className = 'btn';
      bFetch.textContent = T('settings.fetchModels');
      bFetch.onclick = function () { App._fetchModels(); };
      fetchRow.appendChild(bFetch);
      w.appendChild(fetchRow);
      App._field(w, T('settings.apiKey'), Config.section('llm').apiKey,
        function (v) { Config.set('llm.apiKey', v); },
        { password: true, hint: T('settings.apiKey.hint') });
      App._field(w, T('settings.temp'), Config.section('llm').temperature,
        function (v) { Config.set('llm.temperature', parseFloat(v) || 1.2); });
      App._field(w, T('settings.maxTokens'), Config.section('llm').maxTokens,
        function (v) { Config.set('llm.maxTokens', Math.max(64, parseInt(v, 10) || 400)); });
      App._field(w, T('settings.historyTurns'), Config.section('llm').historyTurns,
        function (v) { Config.set('llm.historyTurns', Math.max(2, parseInt(v, 10) || 12)); });
      App._field(w, T('settings.context'), Config.section('llm').contextWindow || '',
        function (v) {
          var n = parseInt(v, 10);
          Config.set('llm.contextWindow', n > 0 ? n : 0);
        },
        { hint: T('settings.context.hint') + ' · auto=' + Api.resolvedContext() });
      App._select(w, T('settings.thinking'), Config.section('llm').thinking || 'auto', [
        { v: 'auto', t: T('settings.thinking.auto') },
        { v: 'off', t: T('settings.thinking.off') },
        { v: 'on', t: T('settings.thinking.on') }
      ], function (v) { Config.set('llm.thinking', v); });
      var effort = (window.Api && Api.normalizeEffort) ? Api.normalizeEffort(Config.section('llm').thinkingEffort) : (Config.section('llm').thinkingEffort || 'default');
      var effortChoices = Api.EFFORT_UI;
      if (effort === 'xhigh') effort = 'max';
      if (effortChoices.indexOf(effort) === -1) effort = 'default';
      App._select(w, T('settings.thinkingEffort'), effort,
        effortChoices.map(function (v) {
          return { v: v, t: T('settings.thinkingEffort.' + v) };
        }),
        function (v) { Config.set('llm.thinkingEffort', v); });
      App._select(w, T('settings.thinkingStyle'), Config.section('llm').thinkingStyle || 'auto', [
        { v: 'auto', t: T('settings.thinkingStyle.auto') },
        { v: 'none', t: T('settings.thinkingStyle.none') },
        { v: 'openai', t: T('settings.thinkingStyle.openai') },
        { v: 'openrouter', t: T('settings.thinkingStyle.openrouter') },
        { v: 'qwen', t: T('settings.thinkingStyle.qwen') },
        { v: 'glm', t: T('settings.thinkingStyle.glm') }
      ], function (v) { Config.set('llm.thinkingStyle', v); });

      App._title(w, T('settings.memory'));
      var mem = Config.section('memory') || {};
      App._switch(w, T('settings.memoryOn'), mem.enabled !== false,
        function (v) { Config.set('memory.enabled', v); });
      App._field(w, T('settings.turnsPerSession'), mem.turnsPerSession,
        function (v) { Config.set('memory.turnsPerSession', Math.max(2, parseInt(v, 10) || 8)); });
      App._field(w, T('settings.sessionCap'), mem.sessionCap,
        function (v) { Config.set('memory.sessionCap', Math.max(2, parseInt(v, 10) || 8)); });
      App._field(w, T('settings.summaryCap'), mem.summaryCap,
        function (v) { Config.set('memory.summaryCap', Math.max(2, parseInt(v, 10) || 8)); });

      App._title(w, T('settings.tts'));
      App._select(w, T('settings.tts.provider'), Config.section('tts').provider || 'openai',
        Providers.rows.filter(function (r) { return r.kind === 'tts'; })
          .map(function (r) { return { v: r.id, t: T(r.label) }; }),
        function (v) {
        Config.set('tts.provider', v);
        if (v === 'fish' && Config.section('tts').mode === 'clone') {
          Config.set('tts.mode', 'preset');
        }
        Settings.buildSettings();
      });

      if ((Config.section('tts').provider || 'openai') === 'qwen') {
        App._field(w, T('settings.baseUrl'), Config.section('tts').qwenBaseUrl,
          function (v) { Config.set('tts.qwenBaseUrl', v); },
          { hint: T('settings.qwenBaseHint') });
        App._field(w, T('settings.apiKey'), Config.section('tts').qwenApiKey,
          function (v) { Config.set('tts.qwenApiKey', v); }, { password: true });
        App._field(w, T('settings.qwenModel'), Config.section('tts').qwenModel,
          function (v) { Config.set('tts.qwenModel', v); },
          { hint: T('settings.qwenModel.hint'), suggestions: App._qwenModelSuggestions(), list: 'qwen-model-list' });
        var qFetch = document.createElement('div');
        qFetch.className = 'btn-row';
        var bQFetch = document.createElement('button');
        bQFetch.type = 'button'; bQFetch.className = 'btn';
        bQFetch.textContent = T('settings.fetchModels');
        bQFetch.onclick = function () { App._fetchQwenModels(); };
        qFetch.appendChild(bQFetch);
        w.appendChild(qFetch);
        App._field(w, T('settings.qwenVoice'), Config.section('tts').qwenVoice,
          function (v) { Config.set('tts.qwenVoice', v); },
          { hint: T('settings.qwenVoice.hint'), suggestions: Api.QWEN_TTS_VOICES || [], list: 'qwen-voice-list' });
        App._field(w, T('settings.qwenCloneTarget'), Config.section('tts').qwenCloneTarget,
          function (v) { Config.set('tts.qwenCloneTarget', v); },
          { hint: T('settings.qwenCloneTarget.hint') });
        var crow = document.createElement('div');
        crow.className = 'btn-row';
        var clone = document.createElement('button');
        clone.type = 'button'; clone.className = 'btn';
        clone.textContent = T('settings.cloneQwen');
        clone.onclick = function () {
          App.toast(T('toast.cloning'));
          Api.qwenCloneVoice().then(function (vid) {
            Config.set('tts.qwenVoice', vid);
            Config.set('tts.qwenModel', Config.section('tts').qwenCloneTarget || 'qwen3-tts-vc-2026-01-22');
            App.toast(T('toast.cloneOk'));
            Settings.buildSettings();
          }).catch(function (e) {
            App.toast(T('toast.cloneFail') + e.message, true);
          });
        };
        crow.appendChild(clone);
        w.appendChild(crow);
        App._select(w, T('settings.ttsMode'), Config.section('tts').mode === 'off' ? 'off' : 'clone', [
          { v: 'clone', t: T('settings.ttsMode.clone') },
          { v: 'off', t: T('settings.ttsMode.off') }
        ], function (v) { Config.set('tts.mode', v); Settings.buildSettings(); });
      } else if (Config.section('tts').provider === 'fish') {
        App._field(w, T('settings.baseUrl'), Config.section('tts').fishBaseUrl,
          function (v) { Config.set('tts.fishBaseUrl', v); },
          { hint: T('settings.fishBaseHint'),
            suggestions: ['https://api.fish.audio'], list: 'fish-base-list' });
        var fsurf = document.createElement('div');
        fsurf.className = 'hint';
        fsurf.textContent = T('settings.fishSurface') + ': ' +
          (Api._fishApiRoot ? Api._fishApiRoot(Config.section('tts').fishBaseUrl)
                            : 'https://api.fish.audio');
        w.appendChild(fsurf);
        App._field(w, T('settings.apiKey'), Config.section('tts').fishApiKey,
          function (v) { Config.set('tts.fishApiKey', v); }, { password: true });
        App._field(w, T('settings.fishModel'), Config.section('tts').fishModel,
          function (v) { Config.set('tts.fishModel', v); },
          { hint: T('settings.fishModel.hint'),
            suggestions: Api.FISH_TTS_MODELS || [], list: 'fish-model-list' });
        App._field(w, T('settings.fishVoice'), Config.section('tts').fishVoice,
          function (v) { Config.set('tts.fishVoice', v); },
          { hint: T('settings.fishVoice.hint'),
            suggestions: App._fishVoiceSuggestions(), list: 'fish-voice-list' });
        App._field(w, T('settings.fishVoiceAsmr'), Config.section('tts').fishVoiceAsmr,
          function (v) { Config.set('tts.fishVoiceAsmr', v); },
          { hint: T('settings.fishVoiceAsmr.hint'),
            suggestions: App._fishVoiceSuggestions(), list: 'fish-voice-asmr-list' });
        var fFetch = document.createElement('div');
        fFetch.className = 'btn-row';
        var bFFetch = document.createElement('button');
        bFFetch.type = 'button'; bFFetch.className = 'btn';
        bFFetch.textContent = T('settings.fetchVoices');
        bFFetch.onclick = function () { App._fetchFishVoices(); };
        fFetch.appendChild(bFFetch);
        w.appendChild(fFetch);
        var frow = document.createElement('div');
        frow.className = 'btn-row';
        var fclone = document.createElement('button');
        fclone.type = 'button'; fclone.className = 'btn';
        fclone.textContent = T('settings.cloneFish');
        fclone.onclick = function () {
          App.toast(T('toast.cloningFish'));
          Api.fishCloneVoice().then(function (vid) {
            Config.set('tts.fishVoice', vid);
            App.toast(T('toast.cloneOk'));
            Settings.buildSettings();
          }).catch(function (e) {
            App.toast(T('toast.cloneFail') + e.message, true);
          });
        };
        frow.appendChild(fclone);
        w.appendChild(frow);
        App._field(w, T('settings.styleHint'), Config.section('tts').styleHint,
          function (v) { Config.set('tts.styleHint', v); },
          { hint: T('settings.styleHint.hint') });
        App._select(w, T('settings.ttsMode'), Config.section('tts').mode === 'off' ? 'off' : 'preset', [
          { v: 'preset', t: T('settings.ttsMode.preset') },
          { v: 'off', t: T('settings.ttsMode.off') }
        ], function (v) { Config.set('tts.mode', v); Settings.buildSettings(); });
      } else if (Providers.isLocal(Config.section('tts').provider)) {
        var lrow = Providers.get(Config.section('tts').provider);
        App._field(w, T('settings.baseUrl'),
          Config.section('tts')[lrow.creds.baseUrl.split('.').pop()],
          function (v) { Config.set(lrow.creds.baseUrl, v); },
          { hint: T('settings.localEngineHint') });
        App._field(w, T('settings.localStyle'), Config.section('tts')[lrow.creds.voice.split('.').pop()],
          function (v) { Config.set(lrow.creds.voice, v); });
        App._field(w, T('settings.speakHint'), Config.section('tts').styleHint,
          function (v) { Config.set('tts.styleHint', v); }, { multi: true });
      } else {
      App._field(w, T('settings.baseUrl'), Config.section('tts').baseUrl,
        function (v) { Config.set('tts.baseUrl', v); });
      App._field(w, T('settings.apiKey'), Config.section('tts').apiKey,
        function (v) { Config.set('tts.apiKey', v); },
        { password: true });
      App._select(w, T('settings.ttsMode'), Config.section('tts').mode, [
        { v: 'clone', t: T('settings.ttsMode.clone') },
        { v: 'preset', t: T('settings.ttsMode.preset') },
        { v: 'off', t: T('settings.ttsMode.off') }
      ], function (v) { Config.set('tts.mode', v); Settings.buildSettings(); });
      if (Config.section('tts').mode === 'clone') {
        App._field(w, T('settings.model'), Config.section('tts').modelClone,
          function (v) { Config.set('tts.modelClone', v); },
          { hint: '克隆通道使用的模型 id（服务端提供，如 MiMo 的声音克隆模型）' });
        App._field(w, T('settings.refAudio'), Config.section('tts').reference,
          function (v) { Config.set('tts.reference', v); },
          { hint: '必须是 wav 或 mp3；APK 里的原声是 m4a，需先转码' });
      } else if (Config.section('tts').mode === 'preset') {
        App._field(w, T('settings.model'), Config.section('tts').modelPreset,
          function (v) { Config.set('tts.modelPreset', v); },
          { hint: '预设音色通道使用的模型 id（服务端提供）' });
        App._field(w, T('settings.presetVoice'), Config.section('tts').presetVoice,
          function (v) { Config.set('tts.presetVoice', v); });
      }
      App._field(w, T('settings.styleHint'), Config.section('tts').styleHint,
        function (v) { Config.set('tts.styleHint', v); },
        { hint: T('settings.styleHint.hint') });
      }

      /* ---------------- language matrix: UI / recorded voice / reply / TTS */
      App._title(w, T('nav.lang'));
      var langOpts = Langs.ALL.map(function (o) { return { v: o.v, t: T(o.k) }; });
      App._select(w, T('settings.lang.ui'), Config.section('app').lang, langOpts,
        function (v) {
          Config.set('app.lang', v); I18n.setLang(v); App.applyI18n(document);
          App._relocalize();
        });
      App._select(w, T('settings.lang.voice'), (Config.section('voice') || {}).lang || 'auto', langOpts,
        function (v) { Config.set('voice.lang', v); });
      App._select(w, T('settings.lang.llm'), (Config.section('llm') || {}).lang || 'auto', langOpts,
        function (v) { Config.set('llm.lang', v); });
      App._select(w, T('settings.lang.tts'), (Config.section('tts') || {}).lang || 'auto', langOpts,
        function (v) { Config.set('tts.lang', v); });
      var lh = document.createElement('div');
      lh.className = 'hint'; lh.textContent = T('settings.lang.ttsHint');
      w.appendChild(lh);

      App._title(w, T('settings.app'));
      App._range(w, T('settings.volume'), Config.section('app').volume,
        function (v) {
          Config.set('app.volume', v);
          if (window.Sound) Sound.applyVolumes();
        });
      App._range(w, T('vol.bgm'), (Config.section('audio') || {}).bgm, function (v) {
        Config.set('audio.bgm', v); if (window.Sound) Sound.applyVolumes();
      });
      App._range(w, T('vol.ambient'), (Config.section('audio') || {}).ambient, function (v) {
        Config.set('audio.ambient', v); if (window.Sound) Sound.applyVolumes();
      });
      App._range(w, T('vol.voice'), (Config.section('audio') || {}).voice, function (v) {
        Config.set('audio.voice', v);
      });
      App._range(w, T('vol.se'), (Config.section('audio') || {}).se, function (v) {
        Config.set('audio.se', v);
      });
      
      /* talk speed: the official sheet is icon pills, not a raw ms input. */
      var sp = document.createElement('div');
      sp.className = 'field';
      var spl = document.createElement('label');
      spl.textContent = T('settings.speed');
      sp.appendChild(spl);
      var seg = document.createElement('div');
      seg.className = 'speed-seg';
      Config.TEXT_SPEEDS.forEach(function (o) {
        var b = document.createElement('button');
        b.type = 'button';
        var cur = Config.textSpeed();
        b.className = Math.abs(cur - o.v) < 3 ? 'on' : '';
        b.innerHTML = '<img alt="" src="assets/icons/' + o.icon + '.svg">';
        b.onclick = function () {
          Config.set('app.textSpeed', o.v);
          Settings.buildSettings();
        };
        seg.appendChild(b);
      });
      sp.appendChild(seg);
      w.appendChild(sp);
      App._switch(w, T('settings.voice'), Config.section('app').voice,
        function (v) { Config.set('app.voice', v); if (App._syncVoicePill) App._syncVoicePill(); });
      App._switch(w, T('settings.bubble'), Config.section('app').showBubble !== false,
        function (v) { Config.set('app.showBubble', v); });
      App._switch(w, T('settings.showOriginal'), Config.section('app').showOriginal !== false,
        function (v) { Config.set('app.showOriginal', v); });
      App._switch(w, T('settings.vibration'), Config.section('app').vibration,
        function (v) { Config.set('app.vibration', v); });
      App._switch(w, T('settings.rim'), Config.section('app').rim !== false,
        function (v) { Config.set('app.rim', v); });

      /* NSFW/undress is always enabled — switch removed */
      App._switch(w, T('settings.stt'), Config.section('app').stt !== 'off',
        function (v) {

          Config.set('app.stt', v ? 'on' : 'off');
          if (window.Voice && !v) Voice.stop();
          if (App._setupMic) App._setupMic();
          App._syncMic();
        });

      if (window.Providers && window.Stt) {
        App._select(w, T('settings.stt.engine'), Config.section('stt').engine || 'auto', [
          { v: 'auto', t: T('settings.stt.engine.auto') },
          { v: 'webSpeech', t: T('settings.stt.engine.webSpeech') },
          { v: 'capture', t: T('settings.stt.engine.capture') }
        ], function (v) {
          Config.set('stt.engine', v);
          if (window.Voice) { Voice.stop(); App._setupMic(); }
        });
        var sttProv = Providers.idsOfKind('stt');
        if (sttProv.length) {
          App._select(w, T('settings.stt.provider'), Config.section('stt').provider || sttProv[0],
            sttProv.map(function (id) {
              var r = Providers.get(id);
              return { v: id, t: T((r && r.label) || id) };
            }),
            function (v) { Config.set('stt.provider', v); App.buildSettings(); });
        }
        App._field(w, T('settings.stt.baseUrl'), Config.section('stt').baseUrl,
          function (v) { Config.set('stt.baseUrl', v.trim()); if (window.Voice) App._setupMic(); },
          { hint: T('settings.stt.baseUrl.hint') });
        App._field(w, T('settings.stt.apiKey'), Config.section('stt').apiKey,
          function (v) { Config.set('stt.apiKey', v.trim()); },
          { password: true });
        App._field(w, T('settings.stt.model'), Config.section('stt').model,
          function (v) { Config.set('stt.model', v.trim()); },
          { hint: T('settings.stt.model.hint') });
      }
      App._switch(w, T('settings.autoSend'), Config.section('app').autoSend,
        function (v) { Config.set('app.autoSend', !!v); });
      App._switch(w, T('settings.bargeIn'), !!Config.section('app').bargeIn,
        function (v) { Config.set('app.bargeIn', !!v); App._syncBargeIn(); });

      var bargeBox = document.createElement('div');
      bargeBox.className = 'field';
      var bargeHint = document.createElement('div');
      bargeHint.className = 'hint';
      bargeHint.textContent = T('settings.bargeInHint');
      bargeBox.appendChild(bargeHint);
      w.appendChild(bargeBox);

      App._select(w, T('settings.npcFreq'), Config.section('app').npcFrequency || 'normal', [
        { v: 'restrained', t: T('settings.npcFreq.restrained') },
        { v: 'normal', t: T('settings.npcFreq.normal') },
        { v: 'frequent', t: T('settings.npcFreq.frequent') },
        { v: 'lively', t: T('settings.npcFreq.lively') }
      ], function (v) { Config.set('app.npcFrequency', v); });

      /* ---------------- time passage (official drove it from AppServerClock) */
      App._title(w, T('settings.time'));
      App._select(w, T('settings.timeMode'), Config.section('app').timeMode || 'real', [
        { v: 'real', t: T('time.real') },
        { v: 'flow', t: T('time.flow') },
        { v: 'manual', t: T('time.manual') }
      ], function (v) {
        Config.set('app.timeMode', v);
        if (v === 'flow') {
          Config.set('state.gameHour', new Date().getHours());
          Config.set('state.gameClockAt', Date.now());
          Config.set('state.todManualUntil', 0);
        }
        Settings.buildSettings();
        App._tickTime();
      });
      if ((Config.section('app').timeMode) === 'flow') {
        App._select(w, T('settings.flowSpeed'), String(Config.section('app').flowSpeed || 60), [
          { v: '15',  t: T('speed.slow') },
          { v: '60',  t: T('speed.mid') },
          { v: '180', t: T('speed.fast') },
          { v: '360', t: T('speed.vfast') }
        ], function (v) {
          Config.set('app.flowSpeed', Number(v));
          App._tickTime();
        });
      }

      /* ─── GAME BALANCE / CHEAT ────────────────────────────────────────
           Made by 青月 · 青月出品，必属精品
      */
      /* 作弊设置页：开关只认引擎，不再读配置里的旧标记。请勿删除 —— 青月 */
      App._title(w, T('settings.cheat'));
      var cheatHint = document.createElement('div');
      cheatHint.className = 'hint';
      cheatHint.textContent = T('cheat.masterDesc');
      w.appendChild(cheatHint);

      /* 外层容器只建一次，不要销毁 */
      var _cheatWrapper = document.createElement('div');
      _cheatWrapper.className = 'cheat-section';
      w.appendChild(_cheatWrapper);

      var _CE  = window.Ψ_x9;
      var _masterOn = !!(_CE && _CE.ρb());

      /* 徽章样式只注入一次 */
      if (!document.getElementById('cheat-badge-style')) {
        var _bs = document.createElement('style');
        _bs.id = 'cheat-badge-style';
        _bs.textContent = [
          '.cheat-badge{display:inline-flex;align-items:center;justify-content:center;',
          'width:28px;height:28px;border-radius:50%;font-size:15px;font-weight:700;',
          'flex-shrink:0;transition:background .25s,color .25s;}',
          '.cheat-badge--on{background:rgba(59,130,246,.2);color:#3b82f6;border:2px solid #3b82f6;}',
          '.cheat-badge--off{background:rgba(255,255,255,.07);color:#666;border:2px solid #444;}'
        ].join('');
        document.head.appendChild(_bs);
      }

      /* 子功能面板，只建一次。键名是混淆后的标识，要和引擎里的对应，别改 */
      var _subPanel = document.createElement('div');
      _subPanel.className = 'cheat-panel';

      var _SUBS = [
        { key: 'Fx1', icon: '🛍️',  label: T('cheat.freeBuy'), hint: T('cheat.freeBuyDesc') },
        { key: 'Fq2', icon: '🎯', label: T('cheat.freeQuest'), hint: T('cheat.freeQuestDesc') },
        { key: 'Fc3', icon: '💰', label: T('cheat.unlimCurrency'), hint: T('cheat.unlimCurrencyDesc') },
        { key: 'Fs4', icon: '🍎', label: T('cheat.unlimStamina'), hint: T('cheat.unlimStaminaDesc') },
        { key: 'Fl5', icon: '⭐', label: T('cheat.maxLevel'), hint: T('cheat.maxLevelDesc') },
        { key: 'Fm6', icon: '🗺️', label: T('cheat.unlockMap'), hint: T('cheat.unlockMapDesc') },
        { key: 'Fo7', icon: '✨', label: T('cheat.others'), hint: T('cheat.othersDesc') }
      ];

      var _subBadges = []; /* 每个子功能的状态徽章引用 */

      _SUBS.forEach(function (sub) {
        var row = document.createElement('div');
        row.className = 'cheat-row';
        var lbl = document.createElement('div');
        lbl.className = 'cheat-lbl';
        lbl.innerHTML = '<b>' + sub.icon + ' ' + sub.label + '</b><span>' + sub.hint + '</span>';
        row.appendChild(lbl);
        var badge = document.createElement('span');
        badge.className = _masterOn ? 'cheat-badge cheat-badge--on' : 'cheat-badge cheat-badge--off';
        badge.textContent = _masterOn ? '✔' : '✕';
        row.appendChild(badge);
        _subPanel.appendChild(row);
        _subBadges.push({ badge: badge, row: row, key: sub.key });
      });

      /* 主开关关闭时才显示的锁定提示 */
      var _lockNote = document.createElement('p');
      _lockNote.className = 'cheat-lock-note';
      _lockNote.textContent = T('cheat.lockNote');
      _subPanel.appendChild(_lockNote);

      /* 主开关变化时，同步徽章外观并联动所有子功能 */
      function _applyMasterState(on) {
        _subPanel.classList.toggle('cheat-disabled', !on);
        _lockNote.style.display = on ? 'none' : 'block';
        _subBadges.forEach(function (ref) {
          ref.row.classList.toggle('cheat-sub-disabled', !on);
          ref.badge.className = on ? 'cheat-badge cheat-badge--on' : 'cheat-badge cheat-badge--off';
          ref.badge.textContent = on ? '✔' : '✕';
          if (_CE) _CE.Σa(ref.key, on);
        });
      }
      _applyMasterState(_masterOn);

      /* 主开关，只建一次 */
      App._switch(_cheatWrapper,
        T('cheat.master') + (_masterOn ? ' 🔓' : ' 🔒'),
        _masterOn,
        function (v) {
          if (_CE) _CE.Δ9(v);
          Config.set('app.cheat', v);
          var lbl = _cheatWrapper.querySelector('.switch-label');
          if (lbl) lbl.textContent = T('cheat.master') + (v ? ' 🔓' : ' 🔒');
          App.toast(v ? T('cheat.masterOn') : T('cheat.masterOff'));
          _applyMasterState(v); 
          setTimeout(function () { App.refreshHud(); }, 80);
        });

      _cheatWrapper.appendChild(_subPanel);


      var g = document.createElement('div');
      g.className = 'hint';
      g.textContent = T('stamina.faintMsg');
      w.appendChild(g);

      App._title(w, T('settings.data'));
      var row = document.createElement('div');
      row.className = 'btn-row';
      var bTest = document.createElement('button');
      bTest.className = 'btn'; bTest.textContent = T('settings.testLlm');
      bTest.onclick = function () { Settings._testLlm(); };
      var bTts = document.createElement('button');
      bTts.className = 'btn'; bTts.textContent = T('settings.testTts');
      bTts.onclick = function () { Settings._testTts(); };
      row.appendChild(bTest); row.appendChild(bTts);
      w.appendChild(row);

      var row2 = document.createElement('div');
      row2.className = 'btn-row';
      var bExp = document.createElement('button');
      bExp.className = 'btn'; bExp.textContent = T('settings.export');
      bExp.onclick = function () {
        var txt = Config.exportJSON();
        if (navigator.clipboard) navigator.clipboard.writeText(txt);
        App.toast(I18n.t('toast.copied'));
        console.log(txt);
      };
      var bImp = document.createElement('button');
      bImp.className = 'btn'; bImp.textContent = T('settings.import');
      bImp.onclick = function () {
        var txt = prompt('Paste Configuration JSON');
        if (!txt) return;
        try {
          Config.importJSON(txt);
          Settings.buildSettings();
          Settings.buildCharaForm();
          App.toast(I18n.t('toast.saved'));
        } catch (e) {
          App.toast('Failed to parse configuration: ' + e.message, true);
        }
      };
      row2.appendChild(bExp); row2.appendChild(bImp);
      w.appendChild(row2);

      /* local_save_data_eraser.dart equivalent. */
      var bErase = document.createElement('button');
      bErase.className = 'btn danger'; bErase.textContent = T('settings.erase');
      bErase.onclick = function () {
        App.openModal({
          title: T('settings.erase'),
          okLabel: T('settings.eraseOk'),
          build: function (body) {
            var p = document.createElement('p');
            p.className = 'onb-sub';
            p.textContent = T('settings.eraseMsg');
            body.appendChild(p);
          },
          onOk: function () {
            Config.eraseAll();
            location.reload();
          }
        });
      };
      var row3 = document.createElement('div');
      row3.className = 'btn-row';
      row3.appendChild(bErase);
      w.appendChild(row3);
    },

    _testLlm: function () {
      var llm = Config.section('llm');
      if (!llm.apiKey) { App.toast(I18n.t('toast.needKey'), true); return; }
      App.toast('TEST…');
      Api.chat([], 'Say a short greeting... ', { mode: 'chat', style: 'text', standalone: true })
        .then(function (r) { App.toast('OK：' + r.text); })
        .catch(function (e) { App.toast('FAILED：' + e.message, true); });
    },

    _testTts: function () {
      var tts = Config.section('tts');
      var cred = Providers.credentials(tts);
      if (!cred.capabilities.local && !cred.apiKey) { App.toast(I18n.t('toast.needKey'), true); return; }
      var model = cred.model;
      if (!cred.capabilities.local && cred.id !== 'fish' && Api.isPlaceholderModel(model)) {
        App.toast(I18n.t('toast.needModel'), true); return;
      }
      App.toast('Synthesizing…');
      Api.speak('Hey, can you hear me?').then(function (url) {
        if (!url) { App.toast('Voice is disabled'); return; }
        App.playUrl(url);
        App.toast('OK');
      }).catch(function (e) { App.toast('Failed: ' + e.message, true); });
    },

    buildCharaForm: function () {
      var w = document.getElementById('chara-form');
      w.innerHTML = '';
      var T = function (k) { return I18n.t(k); };
      var c = Config.section('chara'), p = Config.section('profile');

      App._title(w, I18n.tc('chara.ryza', 'Ryza') + ' — ' + I18n.tc('chara.title', 'Character'));
      App._field(w, T('chara.personality'), c.personality,
        function (v) { Config.set('chara.personality', v); });
      App._field(w, T('chara.likes'), c.likes,
        function (v) { Config.set('chara.likes', v); });
      App._field(w, T('chara.dislikes'), c.dislikes,
        function (v) { Config.set('chara.dislikes', v); });
      App._field(w, T('chara.situation'), c.situation,
        function (v) { Config.set('chara.situation', v); });
      App._field(w, T('chara.callMe'), c.callMe,
        function (v) { Config.set('chara.callMe', v); });
      App._field(w, T('chara.extra'), c.extra,
        function (v) { Config.set('chara.extra', v); }, { multi: true });

      App._title(w, I18n.tc('chara.you', 'You') + ' — ' + I18n.tc('nav.profile', 'Profile'));
      App._field(w, T('onb.name'), p.name,
        function (v) { Config.set('profile.name', v); });
      App._field(w, T('onb.birthday'), p.birthday,
        function (v) { Config.set('profile.birthday', v); }, { type: 'date' });
      App._select(w, T('onb.gender'), p.gender || '', [
        { v: '', t: '—' },
        { v: 'female', t: T('onb.gender.female') },
        { v: 'male', t: T('onb.gender.male') },
        { v: 'other', t: T('onb.gender.other') }
      ], function (v) { Config.set('profile.gender', v); });
      App._field(w, T('profile.appearance'), p.appearance,
        function (v) { Config.set('profile.appearance', v); });
      App._field(w, T('profile.background'), p.background,
        function (v) { Config.set('profile.background', v); });
      App._field(w, T('profile.hobby'), p.hobby,
        function (v) { Config.set('profile.hobby', v); });
      App._field(w, T('profile.interest'), p.interest,
        function (v) { Config.set('profile.interest', v); });
      App._field(w, T('profile.futureGoals'), p.futureGoals,
        function (v) { Config.set('profile.futureGoals', v); });
      App._field(w, T('profile.personality'), p.personality,
        function (v) { Config.set('profile.personality', v); });

      App._title(w, T('slot.title'));
      Settings._renderSlots(w);

      var row = document.createElement('div');
      row.className = 'btn-row';
      var b = document.createElement('button');
      b.className = 'btn primary'; b.textContent = T('chara.saveBack');
      b.onclick = function () {
        Config.save();
        App.toast(I18n.t('toast.saved')); App.showView('talk');
      };
      row.appendChild(b);
      var b2 = document.createElement('button');
      b2.className = 'btn danger'; b2.textContent = T('chara.clearMemory');
      b2.onclick = function () {
        if (confirm(T('chara.clearMemory.confirm'))) {
          App.history = []; App.toast(I18n.t('chara.clearMemory.done'));
        }
      };
      row.appendChild(b2);
      w.appendChild(row);
    },

    /* -------------------------------------------------------- save slots */
    _loadSlots: function () {
      var slots;
      try { slots = JSON.parse(localStorage.getItem(SAVE_KEY) || '[]'); }
      catch (e) { slots = []; }
      while (slots.length < 3) slots.push(null);
      return slots.slice(0, 3);
    },

    /* false = nothing was written, and the caller already has been told. */
    _writeSlots: function (slots) {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(slots));
        return true;
      } catch (e) {
        App.toast(I18n.t('slot.saveFail'), true);
        return false;
      }
    },

    _snapshot: function () {
      var st = Config.section('state');
      var place = World.find(st.stage);
      return {
        at: Date.now(),
        day: st.day,
        label: place ? (place.area + ' / ' + place.stage) : st.stage,
        settings: JSON.parse(Config.exportJSON()),
        history: App.history,
        memory: App.memory,
        longmem: window.Memory ? Memory.snapshot() : null,
        game: Game.snapshot(),
        daily: JSON.parse(localStorage.getItem('ryza.daily.v1') || 'null'),
        alarms: Alarm.items
      };
    },

    _applySnapshot: function (snap) {
      if (!snap || !snap.settings) {
        App.toast(I18n.t('slot.loadFail'), true);
        return false;
      }
      Config.importJSON(JSON.stringify(snap.settings));
      App.history = snap.history || [];
      App.memory = snap.memory || [];
      App.saveMemory();
      if (window.Memory) Memory.restore(snap.longmem);
      Game.restoreSnapshot(snap.game);
      try { localStorage.setItem('ryza.daily.v1', JSON.stringify(snap.daily || { lastDate: '', streak: 0, claimedDays: [] })); } catch (e) {}
      Daily.load();
      Quests.ensure();
      Alarm.items = snap.alarms || [];
      Alarm.save();
      var st = Config.section('state');
      Avatar.loadSkin(st.skin);
      App._loadSceneFor(st.stage, st.tod);
      if (window.Sound) {
        Sound.setPlace(st.stage, st.tod, World.backgroundFor(st.stage));
        Sound.setRoute('talk');
      }
      App.updateHud();
      App.renderWorld();
      Alarm.render(document.getElementById('alarm-list'), App.playFile);
      Quests.render(document.getElementById('quest-list'), {});
      Daily.render(document.getElementById('daily-body'));
      App.renderMemory();
      Settings.buildSettings();
      Settings.buildCharaForm();
      App.renderSkins();
      I18n.setLang(Config.section('app').lang);
      App.applyI18n(document);
      return true;
    },

    _renderSlots: function (wrap) {
      var slots = Settings._loadSlots();
      slots.forEach(function (s, i) {
        var row = document.createElement('div');
        row.className = 'slot-row';
        var info = document.createElement('div');
        info.className = 'slot-info';
        if (s) {
          var d = new Date(s.at);
          info.textContent = (i + 1) + '. ' + (s.label || '') + ' · day ' + (s.day || 1) + ' · ' + 'Lv' + (s.game ? 1 + Math.floor(Math.sqrt((s.game.exp_total || 0) / 30)) : '?') + ' · ' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
        } else {
          info.textContent = (i + 1) + '. ' + I18n.t('slot.empty');
        }
        var save = document.createElement('button');
        save.type = 'button';
        save.className = 'mini-btn';
        save.textContent = I18n.t('slot.save');
        save.onclick = function () {
          var all = Settings._loadSlots();
          all[i] = Settings._snapshot();
          if (!Settings._writeSlots(all)) return;
          Settings.buildCharaForm();
          App.toast(I18n.t('toast.saved'));
        };
        var load = document.createElement('button');
        load.type = 'button';
        load.className = 'mini-btn';
        load.textContent = I18n.t('slot.load');
        load.disabled = !s;
        load.onclick = function () {
          var all = Settings._loadSlots();
          if (!all[i]) return;
          if (!Settings._applySnapshot(all[i])) return;
          App.toast(I18n.t('slot.load'));
          App.showView('talk');
        };
        row.appendChild(info);
        row.appendChild(save);
        row.appendChild(load);
        wrap.appendChild(row);
      });
    }
  };

  global.Settings = Settings;
})(typeof window !== 'undefined' ? window : globalThis);
