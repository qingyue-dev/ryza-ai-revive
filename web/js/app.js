/* Main controller: boots straight into the game (no login, no official */
   
(function (global) {
  'use strict';

  var MEM_KEY = 'ryza.memory.v1';
  
  var HOME_STAGE = 'stage_01_001_04';
  var RPG_MODES = { chat: 1, story: 1, immersive: 1 };

  var App = {
    history: [],
    memory: [],
    audio: null,
    speaking: false,
    _typeTimer: null,
    _ringAlarm: null,
    _inTutorial: false,
    _lastText: '',
    _invBag: 'you',

    toast: function (msg, isErr) {
      var host = document.getElementById('toast-host');
      var el = document.createElement('div');
      el.className = 'toast' + (isErr ? ' err' : '');
      el.textContent = msg;
      host.appendChild(el);
      setTimeout(function () {
        el.style.transition = 'opacity .3s'; el.style.opacity = '0';
        setTimeout(function () { el.remove(); }, 320);
      }, isErr ? 4200 : 2400);
    },

    buzz: function (ms) {
      if (!Config.section('app').vibration) return;
      if (navigator.vibrate) { try { navigator.vibrate(ms || 18); } catch (e) {} }
    },

    _ensureVoiceGraph: function () {
      if (App._voiceAnalyser || !App.audio) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        App._voiceCtx = new AC();
        var src = App._voiceCtx.createMediaElementSource(App.audio);
        var an = App._voiceCtx.createAnalyser();
        an.fftSize = 512;
        src.connect(an);
        an.connect(App._voiceCtx.destination);
        App._voiceAnalyser = an;
      } catch (e) {}
    },

    esc: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    applyI18n: function (root) {
      var r = root || document;
 
      r.querySelectorAll('[data-i18n]').forEach(function (el) {
        var v = I18n.t(el.getAttribute('data-i18n'));
        if (v) el.textContent = v;
      });
 
      r.querySelectorAll('[data-i18n-title]').forEach(function (el) {
        var v = I18n.tc(el.getAttribute('data-i18n-title'), '');
        if (v) el.title = v;
      });
 
      r.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
        var v = I18n.tc(el.getAttribute('data-i18n-placeholder'), '');
        if (v) el.placeholder = v;
      });
 
      var posBtn = r.getElementById ? r.getElementById('btn-posture') : null;
      if (posBtn) posBtn.textContent = I18n.tc('posture.sit', '↕');
    },

    _syncPanelFrac: function () {
      if (!window.Avatar || Avatar.panelFraction()) return;   // measure once
      var vh = window.innerHeight || 1;
      Avatar.setPanelFraction(Math.min(0.55, Math.min(340, Math.max(240, 0.34 * vh)) / vh));
    },

    _fitUi: function () {
      var el = document.getElementById('phone');
      if (!el) return;
      if (!window.ryzaShell) { el.style.zoom = ''; return; }
      var w = window.innerWidth || el.clientWidth;
      var h = window.innerHeight || el.clientHeight;
      if (!w || !h) return;
      var z = Math.min(w / 420, h / 860);
      z = Math.max(0.8, Math.min(1.25, z));
      if (Math.abs(z - (App._uiZoom || 1)) > 0.02) {
        App._uiZoom = z;
        el.style.zoom = String(z);
        if (window.Avatar && Avatar.resize) Avatar.resize();
      }
    },

    /* boot */
    init: function () {
      (function () {
        var saved = Config.section('app').lang;
        if (!saved) {
          var nav = ((navigator.language || navigator.userLanguage || '') + ',' + (navigator.languages || []).join(',')).toLowerCase();
          if (nav.indexOf('zh-tw') !== -1 || nav.indexOf('zh-hant') !== -1) saved = 'zh-tw';
          else if (nav.indexOf('zh') !== -1) saved = 'zh';
          else if (nav.indexOf('ja') !== -1) saved = 'ja';
          else if (nav.indexOf('id') !== -1) saved = 'id';
          else if (nav.indexOf('hi') !== -1) saved = 'hi';
          else if (nav.indexOf('pt') !== -1) saved = 'pt-br';
          else if (nav.indexOf('en') !== -1) saved = 'en';
          else saved = 'en';
        }
        I18n.setLang(saved);
      })();
      App.applyI18n(document);
      
      /* 启动作弊引擎：读档、校验、开看门狗。请勿删除 —— 青月 */
      if (window.Ψ_x9) window.Ψ_x9.ι0();
      var inpEl = document.getElementById('input');
      if (inpEl) inpEl.placeholder = I18n.tc('input.hint', inpEl.placeholder);
      document.getElementById('overlay-title').classList.remove('hidden');
      document.getElementById('btn-title-start').disabled = true;

      App.audio = new Audio();
      App.audio.preload = 'auto';
      App.audio.crossOrigin = 'anonymous';
      try { App.memory = JSON.parse(localStorage.getItem(MEM_KEY) || '[]'); }
      catch (e) { App.memory = []; }

      Game.load();
      Daily.load();
      Quests.ensure();
      try { if (window.Memory) Memory.load(); } catch (e) {}

      App._bindChrome();
      App._bindTalk();
      App._bindOverlays();
      Game.on(function () { App.refreshHud(); App._syncOpenViews(); });

      App._wirePorts();

      Promise.all([Config.hydrate(), World.init(), VoiceBank.load(), Sound.init()]).then(function () {
        Sound.setCatalog(Object.keys(World.scenes || {}));
        var st = Config.section('state');
        Sound.setPlace(st.stage, st.tod, World.backgroundFor(st.stage));
        App._tickDay();
        App._syncPanelFrac();
        Avatar.init(function () {
          App._loadSceneFor(st.stage, st.tod);
          App._tickTime();
        });
        setInterval(App._tickTime, 30000);
        document.addEventListener('visibilitychange', function () {
          if (!document.hidden) App._tickTime();
        });
        App.updateHud();
        App.renderWorld();
        window.RyzaAlarmNative = {
          onFire: function (a) { try { Alarm._nativeFire(a); } catch (e) {} }
        };
        if (window.RyzaAlarm && Alarm.setNative) Alarm.setNative(window.RyzaAlarm);
        Alarm.load();
        Alarm.render(document.getElementById('alarm-list'), App.playFile);
        Alarm.start(App._onAlarm);
        Quests.render(document.getElementById('quest-list'), {});
        Daily.render(document.getElementById('daily-body'));
        App.renderSkins();
        App.buildSettings();
        App.buildCharaForm();
        App.renderMemory();
        if (window.Daily && Daily.dayIndex) Welcome.bumpDay(Daily.dayIndex());
        Welcome.render(document.getElementById('welcome-body'));
        if (window.Fx) Fx.init();
        App._fitUi();
        window.addEventListener('resize', function () {
          App._fitUi();
          App._syncPanelFrac();
        });

        Onboarding.showTitle(function () {
          if (!Onboarding.isDone()) {
            App._inTutorial = true;
            Onboarding.start(function () {
              App._inTutorial = false;
              App.enterGame(true);
            });
          } else App.enterGame(false);
        });
      }).catch(function (e) {
        App._bootError = e;
        App.toast('Failed to load the asset index: ' + e.message, true);
      });
    },

    _wirePorts: function () {
      Avatar.setNotice(App.toast);
      Avatar.setVoiceSource(function () {
        return { analyser: App._voiceAnalyser, paused: !App.audio || App.audio.paused };
      });
      if (Memory.setLLM) {
        Memory.setLLM(function (sys, body, opts) { return Api.complete(sys, body, opts); });
      }
      if (window.LongTerm && LongTerm.setLLM) {
        LongTerm.setLLM(function (sys, body, opts) {
          return Api.complete(sys, body, Object.assign({ standalone: true }, opts || {}));
        });
      }
      if (Nsfw.setSink) {
        Nsfw.setSink(function (name) {
          Avatar.setAtlasVariant(name, function () {
          });
        });
      }
      if (Api.setScreenState) {
        Api.setScreenState(function () {
          return (Avatar.screenState && Avatar.screenState()) || { emotion: '', attitude: '' };
        });
      }
      if (World.setNotice) World.setNotice(App.toast);
      if (Quests.setNotice) Quests.setNotice(App.toast);
      if (Quests.setNavigator) Quests.setNavigator(function (view) { App.showView(view); });
      if (Alarm.setEditor) Alarm.setEditor(function (id) { App._editAlarm(id); });
      var celebrate = function () {
        if (window.Sound) Sound.se('quest_clear');
        if (window.Fx) Fx.burstConfetti();
      };
      if (Quests.setCelebrate) Quests.setCelebrate(celebrate);
      if (Daily.setCelebrate) Daily.setCelebrate(celebrate);
      if (Quests.setGenerator) {
        Quests.setGenerator(function (history, body, opts) { return Api.chat(history, body, opts); });
      }
      if (Quests.setPresenter) {
        Quests.setPresenter(function (res) {
          if (!res) return;
          if (res.sail) App._onSailed();
          if (res.line) {
            if (res.faint) App._showFaint();
            else App.showBubble(res.line);
            if (window.Sound) {
              if (res.ok) Sound.se('quest_clear');
              else if (!res.faint) Sound.se('touch_start');
            }
          }
          App.refreshHud();
        });
      }
      if (Daily.setPresenter) {
        Daily.setPresenter(function (res) {
          if (!res) return;
          if (!res.ok) { App.toast(I18n.t('dl.already')); return; }
          App.toast(I18n.t('dl.got') + res.text);
          Welcome.mark('login_bonus', Daily.streak());
          Welcome.bumpDay(Daily.streak());
          App.refreshHud();
        });
      }
      if (window.CrfStore) {
        Avatar.setPageSource(function (skinId, pageName) {
          return CrfStore.pageUrl(skinId, pageName);
        });
        CrfStore.entries().then(function (list) {
          if (!list.length) return;
          var base = Avatar.skinsIndex || [];
          list.forEach(function (e) { base.push(e); });
          Avatar.skinsIndex = base;
        }).catch(function () { });
      }
      if (window.Turn) {
        Turn.setTurnCanceller(function (reason) { return Api.newTurn(reason); });
        Turn.setSynth(function (text, meta) {
          var st2 = Config.section('state');
          var replyL = (window.Langs && Langs.llm) ? Langs.llm() : 'ja';
          var ttsL = (window.Langs && Langs.tts) ? Langs.tts() : replyL;
          var alreadyTranslated = !!(meta && meta.translated);
          var prep = (!alreadyTranslated && ttsL !== replyL && Api.translate) ? Api.translate(text, ttsL) : Promise.resolve(text);
          return prep.then(function (t) {
            if (window.Voice && Voice.noteAssistantSpeech) Voice.noteAssistantSpeech(t);
            return Api.speak(t, ttsL, (meta && meta.mode) || st2.mode, (meta && meta.emotion) || '')
              .then(function (url) {
                if (window.VoiceCache && url) {
                  try {
                    App._voiceSeq = (App._voiceSeq || 0) + 1;
                    var key = 'v' + App._voiceSeq + ':' + t.slice(0, 40);
                    App._lastVoiceKey = key;
                    fetch(url).then(function (r) { return r.blob(); }).then(function (bl) {
                      return VoiceCache.put(key, bl, { text: t, url: '' });
                    }).catch(function () {});
                  } catch (e) {}
                }
                return url;
              });
          });
        });
        Turn.setPlayer(function (url, signal, meta) {
          return App.playSpeech(url, signal, meta && meta.fx);
        });
        Turn.on(function (ev) {
          if (ev.type !== 'error') return;
          var msg = (ev.error && ev.error.message) || '';
          App.toast(msg === 'NO_KEY' ? I18n.t('toast.needKey') : msg === 'NO_MODEL' ? I18n.t('toast.needModel') : I18n.t('toast.ttsFail') + msg, true);
        });
      }
      if (window.Voice) {
        var sttReady = function () {
          return !!String((Config.section('stt') || {}).baseUrl || '').trim();
        };
        Voice.setEcho(window.Echo);
        Voice.setSpeaker(function () { return !!(window.Turn && Turn.isSpeaking()); });
        Voice.setCapture(window.Stt || null);
        Voice.setEngine(function () {
          var pref = (Config.section('stt') || {}).engine || 'auto';
          if (pref !== 'auto') return pref;
          var shell = !!window.ryzaShell || /Android/i.test((navigator && navigator.userAgent) || '');
          return (shell && sttReady()) ? 'capture' : 'auto';
        });
        Voice.setTranscriberReady(sttReady);
        Voice.setLang(function () {
          var lg = (window.Langs && Langs.voice && Langs.voice()) || (window.Langs && Langs.llm && Langs.llm()) || 'ja';
          return (window.Langs && Langs.sttTag) ? Langs.sttTag(lg) : lg;
        });
        App._micNotice = function (code, isErr) {
          var c = String(code || '');
          if (c === 'mic.on' || c === 'mic.off' || c === 'mic.empty') return;
          if (c === 'mic.denied' || c === 'mic.unsupported' || c === 'mic.unstable' ||
              c === 'mic.nodevice' || c === 'mic.switched' || c === 'mic.noTranscriber') {
            App.toast(I18n.t(c), !!isErr);
            return;
          }
          App.toast(I18n.t('mic.failed') + c.replace(/^mic\.error:/, ''), !!isErr);
        };
        Voice.setNotice(App._micNotice);
        if (window.Stt) {
          Stt.setTranscriber(function (blob, opts) { return Api.transcribe(blob, opts); });
          Stt.setNotice(App._micNotice);
          Stt.setLang(function () {
            return (window.Langs && Langs.voice && Langs.voice()) ||
                   (window.Langs && Langs.llm && Langs.llm()) || 'ja';
          });
        }
        Voice.setSink(function (text) { App._onVoiceTranscript(text); });
        Voice.setBargeIn(null);
        if (window.Turn) {
          Turn.on(function (ev) {
            if (ev.type === 'end' || ev.type === 'cancel') Voice.noteAssistantSpeechEnded(ev.reason);
            if (ev.type === 'speak') Voice.noteAssistantSpeechStarted();
            if (ev.type === 'state' || ev.type === 'end' || ev.type === 'cancel') App._syncMic();
          });
        }
        App._syncBargeIn();
      }
      App._setupMic();
    },

    enterGame: function (fromOnboard) {
      var bar = document.getElementById('input-bar');
      if (bar) bar.classList.remove('spot');
      var st = Config.section('state');
      Sound.setPlace(st.stage, st.tod, World.backgroundFor(st.stage));
      Sound.setRoute('talk');
      var firstEntry = !App._entered;
      App._entered = true;
      if (firstEntry) {
        App._showDisclosure();
        App._dailyNudge();
      }
      if (fromOnboard) return;
      App.greet();
    },

    _tickDay: function () {
      var st = Config.section('state');
      var today = new Date().toDateString();
      if (st.lastDayDate && st.lastDayDate !== today) {
        Config.set('state.day', (st.day || 1) + 1);
      }
      if (st.lastDayDate !== today) Config.set('state.lastDayDate', today);
      Daily.load();
      App._dailyBadge();
    },

    _dailyNudge: function () {
      Daily.load();
      if (!Daily.available()) return;
      if (App._nudged) return;
      App._nudged = true;
      setTimeout(function () {
        if (App._inTutorial) return;
        App.toast(I18n.t('dl.title') + ' · ' + I18n.t('dl.cta'));
      }, 3200);
    },

    _dailyBadge: function () {
      var dot = document.getElementById('daily-dot');
      if (dot) dot.classList.toggle('hidden', !Daily.available());
    },

    _showDisclosure: function () {
      if (App._disclosed) return;
      App._disclosed = true;
      App.toast(I18n.t('toast.ai'));
    },

    _loadSceneFor: function (stageId, tod) {
      var curtain = document.getElementById('scene-curtain');
      if (curtain) curtain.classList.add('on');
      var bg = World.backgroundFor(stageId);
      Avatar.loadScene(bg, tod, function (err) {
        if (err) { }
        setTimeout(function () {
          if (curtain) curtain.classList.remove('on');
        }, 280);
        if (window.Avatar && Avatar.shouldResetPosture && Avatar.shouldResetPosture()) {
          Config.set('state.posture', 'posture_standing');
        }
        App.updateHud();
      });
    },

    _ripple: function (x, y) {
      var layer = document.getElementById('ripple-layer');
      if (!layer) return;
      var el = document.createElement('div');
      el.className = 'tap-ripple';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      layer.appendChild(el);
      setTimeout(function () { if (el.remove) el.remove(); }, 720);
    },

    /* chrome */
    _bindChrome: function () {
      var drawer = document.getElementById('drawer');
      var scrim = document.getElementById('scrim');
      var open = function (on) {
        drawer.classList.toggle('open', on);
        scrim.classList.toggle('on', on);
      };
      document.getElementById('btn-menu').onclick = function () { open(true); };
      scrim.onclick = function () { open(false); };

      document.querySelectorAll('.drawer-list li').forEach(function (li) {
        li.onclick = function () {
          var act = li.getAttribute('data-action');
          if (act === 'newTalk') { open(false); App._confirmNewTalk(); return; }
          if (act === 'lang') { open(false); App._openLangSheet(); return; }
          if (act === 'toggleChara') { App._toggleChara(); return; }
          if (act === 'fullscreen') { open(false); App._toggleFullscreen(); return; }
          if (act === 'changelog') { open(false); App._openChangelog(); return; }
          document.querySelectorAll('.drawer-list li').forEach(function (x) {
            x.classList.remove('active');
          });
          li.classList.add('active');
          App.showView(li.getAttribute('data-view'));
          open(false);
        };
      });

      var st = Config.section('state');
      document.querySelectorAll('.mode-pill[data-mode]').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-mode') === st.mode);
        b.onclick = function () {
          var prevMode = st.mode;
          Config.set('state.mode', b.getAttribute('data-mode'));
          document.querySelectorAll('.mode-pill[data-mode]').forEach(function (x) {
            x.classList.toggle('active', x === b);
          });
          App.updateHud();
          if (window.Avatar && Avatar.resize) Avatar.resize();
          if (window.Avatar && Avatar.onModeChange &&
              b.getAttribute('data-mode') !== prevMode) {
            Avatar.onModeChange();
          }
          document.getElementById('sheet-mode').classList.add('hidden');
        };
      });
      document.querySelectorAll('.mode-pill[data-style]').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-style') === st.style);
        b.onclick = function () {
          Config.set('state.style', b.getAttribute('data-style'));
          document.querySelectorAll('.mode-pill[data-style]').forEach(function (x) {
            x.classList.toggle('active', x === b);
          });
          if (App._syncVoicePill) App._syncVoicePill();
        };
      });

      var vbtn = document.getElementById('btn-voice');
      var vcanvas = document.getElementById('lottie-voice');
      var vsync = function () {
        var a = Config.section('app'), st = Config.section('state');
        var talking = !!a.voice && st.style === 'voice';
        vbtn.classList.toggle('on', talking);
        vbtn.classList.toggle('off', !talking);
        var lab = document.getElementById('voice-pill-label');
        if (lab) lab.textContent = I18n.t(talking ? 'voice.on' : 'voice.off');
        if (vcanvas) vcanvas.classList.toggle('hidden', !talking);
        var tico = document.getElementById('voice-text-ico');
        if (tico) tico.classList.toggle('hidden', talking);
        if (window.Fx) Fx.setVoice(!!a.voice);
      };
      vbtn.onclick = function () {
        var st = Config.section('state');
        Config.set('state.style', st.style === 'voice' ? 'text' : 'voice');
        vsync();
        document.querySelectorAll('.mode-pill[data-style]').forEach(function (x) {
          x.classList.toggle('active', x.getAttribute('data-style') === st.style);
        });
        if (st.style !== 'voice' && App.audio) App.audio.pause();
      };
      App._syncVoicePill = vsync;
      vsync();
      
      var side = document.getElementById('side-menu');
      var sideClose = function (fn) {
        return function () {
          side.classList.remove('open');
          document.body.classList.remove('side-open');
          fn();
        };
      };
      document.getElementById('btn-expand').onclick = function () {
        side.classList.toggle('open');
        document.body.classList.toggle('side-open', side.classList.contains('open'));
      };
      document.addEventListener('click', function (e) {
        if (!side.classList.contains('open')) return;
        if (e.target.closest && e.target.closest('#side-menu,#btn-expand')) return;
        side.classList.remove('open');
        document.body.classList.remove('side-open');
      }, true);
      document.getElementById('sm-shop').onclick = sideClose(function () { App.showView('quest'); });
      document.getElementById('sm-skin').onclick = sideClose(function () { App.showView('skin'); });
      document.getElementById('sm-save').onclick = sideClose(function () {
        App.showView('chara');
      });
      document.getElementById('sm-full').onclick = sideClose(function () { App._toggleFullscreen(); });
      document.getElementById('sm-chara').onclick = sideClose(function () { App._toggleChara(); });
      document.getElementById('sm-settings').onclick = sideClose(function () { App.showView('settings'); });
      document.getElementById('sm-changelog').onclick = sideClose(function () { App._openChangelog(); });
      document.getElementById('sm-map').onclick = sideClose(function () { App.showView('world'); });
      var postureBtn = document.getElementById('btn-posture');
      if (postureBtn) postureBtn.onclick = function () {
        App.setPosture(Avatar.postureKey() === 'posture_standing'
          ? 'posture_sitting' : 'posture_standing');
      };
      var skinBtn = document.getElementById('btn-chara-skin');
      if (skinBtn) skinBtn.onclick = function () { App.showView('skin'); };
      var hudMode = document.getElementById('hud-mode');
      if (hudMode) hudMode.onclick = function () { /* current-mode label */ };
      document.getElementById('hud-place').onclick = function () { App.showView('world'); };
      document.getElementById('btn-map').onclick = function () { App.showView('world'); };
      document.getElementById('btn-quest-sheet').onclick = function () { App.showView('quest'); };
      var logT = document.getElementById('btn-log-toggle');
      if (logT) logT.onclick = function () {
        var phone = document.getElementById('phone');
        var open = phone.classList.toggle('panel-collapsed');
        var arrow = document.querySelector('#btn-log-toggle img');
        if (arrow) arrow.style.transform = open ? 'rotate(180deg)' : '';
      };
      var spd = document.getElementById('btn-speed');
      if (spd) spd.onclick = function () { App._cycleTextSpeed(); };
      var nt = document.getElementById('btn-newtalk');
      if (nt) nt.onclick = function () { App._confirmNewTalk(); };
      var logHead = document.getElementById('log-head');
      if (logHead) logHead.onclick = function () {
        document.getElementById('sheet-mode').classList.toggle('hidden');
      };
      ['hud-stamina', 'hud-money', 'hud-level'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.onclick = function () { App.renderStatus(); document.getElementById('sheet-status').classList.remove('hidden'); };
      });
      document.getElementById('btn-bag').onclick = function () {
        App.renderInv();
        document.getElementById('sheet-inv').classList.toggle('hidden');
      };
      document.querySelectorAll('#inv-tabs [data-bag]').forEach(function (b) {
        b.onclick = function () {
          App._invBag = b.getAttribute('data-bag');
          document.querySelectorAll('#inv-tabs [data-bag]').forEach(function (x) {
            x.classList.toggle('active', x === b);
          });
          App.renderInv();
        };
      });
      document.getElementById('btn-tod').onclick = function () {
        var next = World.nextTod(Config.section('state').tod);
        App._setTod(next);
        Config.set('state.todManualUntil', Date.now() + 30 * 60000);  // don't auto-clobber for 30 min
        if ((Config.section('app').timeMode) === 'flow') {
          Config.set('state.gameHour', World.todStartHour(next));
          Config.set('state.gameClockAt', Date.now());
        }
      };
      document.getElementById('world-area').onchange = function (e) {
        if (window.WorldMap && WorldMap.mode === 'map') {
          WorldMap.areaId = e.target.value;
          WorldMap.reset();
          App.renderWorld();
          return;
        }
        World.jumpArea(e.target.value, Config.section('state').stage, App.gotoStage);
      };
      document.getElementById('btn-quest-new').onclick = function () {
        var hasKey = !!(Config.section('llm').apiKey);
        if (hasKey) App.toast(I18n.t('toast.questGen'));
        Quests.generate(hasKey).then(function (q) {
          App.toast(I18n.t('quest.newOk') + '「' + q.title + '」');
          Quests.render(document.getElementById('quest-list'), {});
        });
      };
      document.getElementById('btn-alarm-new').onclick = function () { App._newAlarm(); };
      var rp = document.getElementById('btn-replay');
      if (rp) rp.onclick = function () { App.replayLastVoice(); };
      var vf = document.getElementById('btn-voicefav');
      if (vf) vf.onclick = function () { App.favLastVoice(); };
      var zi = document.getElementById('btn-zoom-in');
      var zo = document.getElementById('btn-zoom-out');
      var zr = document.getElementById('btn-zoom-reset');
      if (zi) zi.onclick = function () { Avatar.zoomBy(Avatar.PLAYER_ZOOM_STEP); };
      if (zo) zo.onclick = function () { Avatar.zoomBy(-Avatar.PLAYER_ZOOM_STEP); };
      if (zr) zr.onclick = function () { Avatar.zoomReset(); };
      var qt = document.getElementById('btn-quick-toggle');
      if (qt) {
        qt.onclick = function () {
          var on = !document.body.classList.contains('quick-collapsed');
          App.setQuickCollapsed(on);
        };
      }
      App.setQuickCollapsed(!!(Config.section('app') || {}).quickCollapsed, true);
      var stageEl = document.getElementById('stage');
      if (stageEl) {
        stageEl.addEventListener('wheel', function (ev) {
          if (!App._viewIsTalk()) return;
          ev.preventDefault();
          Avatar.zoomBy(ev.deltaY < 0 ? Avatar.PLAYER_ZOOM_STEP : -Avatar.PLAYER_ZOOM_STEP);
        }, { passive: false });
      }
      var wmBtn = document.getElementById('btn-world-mode');
      if (wmBtn) wmBtn.onclick = function () { App.toggleWorldMode(); };
      var crfBtn = document.getElementById('btn-crf-zip');
      var crfFile = document.getElementById('crf-file-zip');
      if (crfBtn && crfFile) {
        crfBtn.onclick = function () { crfFile.click(); };
        crfFile.onchange = function () {
          var f = crfFile.files && crfFile.files[0];
          crfFile.value = '';
          if (!f) return;
          App.toast('Importing…');
          CrfStore.importZip(f).then(function (v) {
            return CrfStore.get(v.id).then(function (rec) {
              var base = Avatar.skinsIndex || [];
              base.push(CrfStore.entryFor(rec));
              Avatar.skinsIndex = base;
              Config.set('state.skin', v.id);
              App.renderSkins();
              App.toast('Imported: ' + v.id);
            });
          }).catch(function (e) {
            App.toast('Import failed: ' + e.message, true);
          });
        };
      }
      var crfRm = document.getElementById('btn-crf-remove');
      if (crfRm) {
        crfRm.onclick = function () {
          var list = CrfStore.list();
          if (!list.length) { App.toast('No imported outfits'); return; }
          var last = list[list.length - 1];
          CrfStore.remove(last.id).then(function () {
            Avatar.skinsIndex = (Avatar.skinsIndex || []).filter(function (x) {
              return x.id !== last.id;
            });
            App.renderSkins();
            App.toast('Removed: ' + last.id);
          }).catch(function (e) { App.toast('Failed to remove: ' + e.message, true); });
        };
      }
      var peopleBtn = document.getElementById('btn-world-people');
      if (peopleBtn) peopleBtn.onclick = function () { App._showPeople(); };
      document.getElementById('btn-memory-clear').onclick = function () {
        if (!confirm(I18n.t('memory.clearLogAsk'))) return;
        App.memory = []; App.saveMemory(); App.renderMemory();
      };
      var addBtn = document.getElementById('btn-memory-add');
      if (addBtn) addBtn.onclick = function () { App._editMemory(null); };
      var flushBtn = document.getElementById('btn-memory-flush');
      if (flushBtn) flushBtn.onclick = function () {
        if (!window.Memory) return;
        Memory.flushNow().then(function () {
          App.toast(I18n.t('toast.memFlushed'));
          App.renderMemory();
        });
      };
      document.getElementById('btn-settings-reset').onclick = function () {
        if (confirm('Reset all settings to default?')) {
          Config.reset(); App.buildSettings(); App.buildCharaForm();
          App.toast(I18n.t('toast.saved'));
        }
      };
    },

    /* 当前是否在对话页（滚轮缩放只在这里生效，避免影响列表滚动） */
    _viewIsTalk: function () {
      var v = document.getElementById('view-talk');
      return !!(v && v.classList.contains('active'));
    },

    showView: function (name) {
      document.querySelectorAll('.view').forEach(function (v) {
        v.classList.toggle('active', v.id === 'view-' + name);
      });
      document.getElementById('sheet-mode').classList.add('hidden');
      document.getElementById('sheet-inv').classList.add('hidden');
      document.getElementById('sheet-status').classList.add('hidden');
      var npcSheet = document.getElementById('sheet-npc');
      if (npcSheet) npcSheet.classList.add('hidden');
      var langSheet = document.getElementById('sheet-lang');
      if (langSheet) langSheet.classList.add('hidden');
      if (name === 'world') {
        Welcome.milestone('map');
        Sound.setRoute('world');
        App.renderWorld();
      } else {
        Sound.setRoute('talk');
      }
      if (name === 'memory') App.renderMemory();
      if (name === 'skin') { Welcome.milestone('skin'); App.renderSkins(); }
      if (name === 'welcome') Welcome.render(document.getElementById('welcome-body'));
      if (name === 'alarm') Welcome.milestone('alarm');
      if (name === 'quest') Quests.render(document.getElementById('quest-list'), {});
      if (name === 'daily') Daily.render(document.getElementById('daily-body'));
    },

    _syncOpenViews: function () {
      var q = document.getElementById('view-quest');
      if (q && q.classList.contains('active')) {
        Quests.render(document.getElementById('quest-list'), {});
      }
      var d = document.getElementById('view-daily');
      if (d && d.classList.contains('active')) Daily.render(document.getElementById('daily-body'));
      var wv = document.getElementById('view-world');
      if (wv && wv.classList.contains('active')) App.renderWorld();
      if (!document.getElementById('sheet-status').classList.contains('hidden')) App.renderStatus();
      if (!document.getElementById('sheet-inv').classList.contains('hidden')) App.renderInv();
      App.refreshHud();
    },

    /* Single write path for the sit/stand choice: store it, cross-fade the
       skeleton swap (the skin_change SE + veil are the source's own costume
       feedback), and let Avatar.resize() re-solve the camera for the new
       posture. Available wherever the worn outfit has both variants. */
    setPosture: function (posture) {
      if (posture !== 'posture_standing' && posture !== 'posture_sitting') return;
      Config.set('state.posture', posture);
      var veil = document.getElementById('skin-veil');
      if (veil) veil.classList.add('veil-on');
      if (window.Sound) Sound.se('skin_change');
      Avatar.loadSkin(Config.section('state').skin, function () {
        setTimeout(function () { if (veil) veil.classList.remove('veil-on'); }, 260);
        App.updateHud();
      });
    },

    updateHud: function () {
      var st = Config.section('state');
      document.getElementById('hud-mode').textContent = I18n.t('mode.' + st.mode) || st.mode;
      var place = World.find(st.stage);
      document.getElementById('hud-place').textContent =
        place ? World.placeLabel(st.stage, place.stage) : st.stage;
      document.getElementById('hud-tod').textContent = World.todLabel(st.tod);
      var postureBtn = document.getElementById('btn-posture');
      if (postureBtn) {
        var both = window.Avatar && Avatar.postureSwitchable && Avatar.postureSwitchable();
        postureBtn.classList.toggle('hidden', !both);
        postureBtn.textContent = both
          ? (Avatar.postureKey() === 'posture_standing'
              ? I18n.t('posture.sit') : I18n.t('posture.stand'))
          : '';
      }
      var todBtn = document.getElementById('btn-tod-label');
      if (todBtn) todBtn.textContent = World.todLabel(st.tod);
      var dd = document.getElementById('drawer-day');
      if (dd) dd.textContent = I18n.tf('drawer.days', '同伴 {n} 天', { n: (st.day || 1) });
      var ln = document.getElementById('log-name');
      if (ln) ln.textContent = I18n.tc('chara.ryza', 'ライザ');
      var ls = document.getElementById('log-sub');
      if (ls) ls.textContent = I18n.t('mode.sub.' + st.mode) || I18n.t('mode.' + st.mode) || st.mode;
      App._syncSpeedBtn();
      App.refreshHud();
    },

    /* RPG strip: apples (StaminaAppleRow) + coin + level. */
    refreshHud: function () {
      var chip = document.getElementById('hud-stamina');
      if (chip) {
        var a = Game.apples();
        var html = '';
        for (var i = 0; i < a.slots; i++) {
          html += '<img alt="" src="assets/icons/' +
            (i < a.filled ? 'stamina_apple_filled' : 'stamina_apple_empty') + '.svg">';
        }
        /* 作弊时体力显示无限 */
        html += ' <b>' + (Game.cheat() ? '∞' : Game.s.stamina) + '</b>';
        chip.innerHTML = html;
      }
      var m = document.getElementById('hud-money-n');
      /* official purse pill groups thousands: 43,000 */
      if (m) m.textContent = Game.cheat() ? '∞'
        : String(Game.s.money).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      var lv = document.getElementById('hud-level');
      if (lv) lv.textContent = 'Lv' + Game.level();
      App._dailyBadge();
    },

    gotoStage: function (stageId) {
      var st = Config.section('state');
      Config.set('state.stage', stageId);
      App._loadSceneFor(stageId, st.tod);
      Sound.setPlace(stageId, st.tod, World.backgroundFor(stageId));
      Sound.setRoute('talk');
      App.renderWorld();
      App.updateHud();
      var place = World.find(stageId);
      if (place) App.toast(I18n.tf('talk.mapMove', '来到：{name}', {
        name: World.placeLabel(stageId, place.stage)
      }));
      var npcs = World.npcsAt(stageId, st.day || 1);
      var names = Game.meetCharas(npcs, st.day);
      if (names.length) Game.remember(names.join('、') + ' と出会った。');
      Quests.progressEvent('explore');
      App.showView('talk');
    },

    _setTod: function (tod) {
      if (!World.isTod(tod)) return;
      var s = Config.section('state');
      var prev = s.tod;
      if (tod === prev) return;
      Config.set('state.tod', tod);
      if (prev === 'ngt' && tod === 'mor' && s.stage === HOME_STAGE) {
        Game.refill();
        Game.remember('Slept soundly at a safe home.');
        App.toast(I18n.t('stamina.slept'));
      }
      App._loadSceneFor(s.stage, tod);
      Sound.setPlace(s.stage, tod, World.backgroundFor(s.stage));
      App.updateHud();
    },

    /* Time passage. 'real' mirrors the official AppServerClock (the scene
       follows the device wall clock); 'flow' runs an in-game clock that ticks
       at app.flowSpeed in-game minutes per real minute and that the LLM can
       also push (see _applySceneDelta); 'manual' leaves it to the 🌤 button.
       A manual tap suppresses auto-sync briefly so a hand-set time isn't
       immediately clobbered. */
    _tickTime: function () {
      if (!window.World || !window.Config) return;
      var app = Config.section('app'), s = Config.section('state');
      var mode = app.timeMode || 'real';
      if (mode === 'manual') return;
      var now = Date.now();
      if ((s.todManualUntil | 0) > now) return;
      var target;
      if (mode === 'real') {
        target = World.hourToTod(new Date().getHours());
      } else {
        var nh = World.flowHour(s.gameHour, s.gameClockAt, now, app.flowSpeed);
        Config.set('state.gameHour', nh);
        Config.set('state.gameClockAt', now);
        target = World.hourToTod(nh);
      }
      if (target && target !== s.tod) App._setTod(target);
    },

    /* The clock line fed to the LLM every turn: day count + current band +
       hour. Official scene.time_bucket is a FACT pushed TO marionette, not a
       command; only local flow mode teaches/accepts a clock write. */
    _clockBlock: function (st) {
      var mode = (Config.section('app').timeMode) || 'real';
      var hour = mode === 'flow' ? Math.floor(Number(st.gameHour) || 12) : mode === 'manual' ? World.todStartHour(st.tod) : new Date().getHours();
      return '## 現在時刻\n- 同伴 ' + (st.day || 1) + '日目／' +
        World.todLabel(st.tod) + '（約' + hour + '時）';
    },

    /* Talk → map / time of day / sleep. Source: detectEntryMapMove,
       scene.current_stage, scene.time_bucket. Game.applyDelta does not
       know World, so App applies this after the numeric reducer. */
    _applySceneDelta: function (d) {
      if (!d || typeof d !== 'object' || !window.World) return;
      var scene = (d.scene && typeof d.scene === 'object') ? d.scene : {};
      var sleep = d.sleep === true || d.sleep === 'true' || d.sleep === 1 ||
                  scene.sleep === true;
      if (sleep) {
        App._sleepHome();
        return;
      }
      var raw = d.current_stage || d.stage || d.map_move || scene.current_stage;
      if (d.map_moved && !raw) raw = scene.current_stage;
      var s = Config.section('state');
      var fromStage = s.stage, fromTod = s.tod;
      var dest = fromStage;
      if (raw != null && String(raw).trim()) {
        var id = World.resolveStage(String(raw).trim());
        if (id) {
          if (World.locked(World.areaOf(id))) App.toast(I18n.t('world.lockedToast'), true);
          else dest = id;
        }
      }
      
      /* Official: time_bucket is pushed TO the model (AppServerClock), never
         written back. real/manual ignore LLM tod/time_advance/game_hour.
         flow is the local extension where the LLM may drive one shared clock 
          */
      var nextTod = fromTod;
      if (World.llmDrivesClock()) {
        var tod = d.tod || d.time_bucket || scene.time_bucket;
        var gh = Number(d.game_hour != null ? d.game_hour : NaN);
        var adv = Number(d.time_advance != null ? d.time_advance : (d.advance_hours != null ? d.advance_hours : NaN));
        var cur = Number(s.gameHour); if (!(cur >= 0 && cur < 24)) cur = 12;
        var nowMs = Date.now();
        if (!isNaN(gh)) cur = ((gh % 24) + 24) % 24;
        else if (!isNaN(adv)) cur = ((cur + adv) % 24 + 24) % 24;
        else if (tod && World.isTod(tod) && tod !== fromTod) cur = World.todStartHour(tod);
        else cur = World.flowHour(cur, s.gameClockAt, nowMs, Config.section('app').flowSpeed);
        Config.set('state.gameHour', cur);
        Config.set('state.gameClockAt', nowMs);
        nextTod = World.hourToTod(cur);
      }
      if (fromTod === 'ngt' && nextTod === 'mor' && dest === HOME_STAGE) {
        Game.refill();
        Game.remember('Slept soundly at a safe home.');
        App.toast(I18n.t('stamina.slept'));
      }
      if (nextTod !== fromTod) Config.set('state.tod', nextTod);
      if (dest !== fromStage) App.gotoStage(dest);
      else if (nextTod !== fromTod) {
        App._loadSceneFor(fromStage, nextTod);
        Sound.setPlace(fromStage, nextTod, World.backgroundFor(fromStage));
        App.updateHud();
      }
    },

    renderWorld: function () {
      var st = Config.section('state');
      var sel = document.getElementById('world-area');
      World.fillAreaSelect(sel, st.stage);
      var fields = document.getElementById('world-fields');
      if (window.WorldMap && WorldMap.mode === 'map') {
        var view = document.getElementById('view-world');
        if (view) view.classList.add('map-mode');
        WorldMap.render(fields, st, {
          onPickStage: App.gotoStage,
          onPickArea: function (areaId) {
            var sel2 = document.getElementById('world-area');
            if (sel2) sel2.value = areaId;
          },
          onToggleList: function () { App.toggleWorldMode(); }
        });
      } else {
        var view2 = document.getElementById('view-world');
        if (view2) view2.classList.remove('map-mode');
        World.render(fields, document.getElementById('world-npcs'), st.stage, App.gotoStage);
      }
    },

    /* 地图 / 网格 模式切换 */
    toggleWorldMode: function () {
      if (!window.WorldMap) return;
      var m = WorldMap.toggle();
      var btn = document.getElementById('btn-world-mode');
      if (btn) {
        var label = btn.querySelector('span');
        if (label) label.textContent = (m === 'map') ? 'List' : 'Map';
      }
      App.renderWorld();
    },

    /* source: world_map/widgets/area_bottom_sheet.dart + character_avatar */
    _showPeople: function () {
      var st = Config.section('state');
      var day = st.day || 1;
      var list = [], title;
      if (World.mapLevel === 'stages' && World.mapFieldId) {
        list = World.npcsInField(World.mapFieldId, day);
        var pack = World.findField(World.mapFieldId);
        title = pack ? World.placeLabel(pack.field.id, pack.field.name) : I18n.t('world.here');
        list.forEach(function (n) { if (!n.where) n.where = n.stage; });
      } else if (World.mapLevel === 'fields' && World.mapAreaId) {
        list = World.npcsInArea(World.mapAreaId, day);
        var area = World.areas().filter(function (a) { return a.id === World.mapAreaId; })[0];
        title = area ? World.placeLabel(area.id, area.name) : I18n.t('world.areas');
        list.forEach(function (n) { n.where = (n.where || []).join(' / '); });
      } else {
        list = World.npcsAt(st.stage, day);
        var place = World.find(st.stage);
        title = place ? World.placeLabel(st.stage, place.stage) : I18n.t('world.here');
      }
      var sheet = document.getElementById('sheet-npc');
      var root = document.getElementById('npc-sheet-list');
      var head = document.getElementById('npc-sheet-title');
      if (!sheet || !root) return;
      head.textContent = I18n.t('world.peopleOf') + '：' + title;
      root.innerHTML = '';
      if (!list.length) {
        root.innerHTML = '<div class="empty">' + I18n.t('world.empty') + '</div>';
      }
      list.forEach(function (n) {
        var row = document.createElement('div');
        row.className = 'npc-sheet-row';
        var img = document.createElement('img');
        img.src = World.iconFor(n.id);
        img.onerror = function () { img.style.visibility = 'hidden'; };
        var box = document.createElement('div');
        box.className = 'npc-sheet-box';
        var nm = document.createElement('div');
        nm.className = 'npc-name';
        var seen = Game.s.met_charas.indexOf(n.id) !== -1;
        nm.textContent = n.name + (seen ? '' : ' ？');
        var nt = document.createElement('div');
        nt.className = 'npc-note';
        nt.textContent = [n.note, n.where].filter(Boolean).join(' · ');
        box.appendChild(nm); box.appendChild(nt);
        row.appendChild(img); row.appendChild(box);
        row.onclick = function () {
          App.toast(n.name + (n.note ? '：' + n.note : ''));
        };
        root.appendChild(row);
      });
      sheet.classList.remove('hidden');
    },

    /* ---------------------------------------------------------- voice input
       Hidden unless the host has a recogniser, and its state has to be honest:
       lit = listening, dimmed = she is talking, so it is visible WHY nothing is
       being heard instead of the mic silently swallowing words. */
    _setupMic: function () {
      var btn = document.getElementById('btn-mic');
      if (!btn) return;
      if (!window.Voice || !Voice.available()) { btn.classList.add('hidden'); return; }
      btn.classList.remove('hidden');
      if (!btn.querySelector('img')) {
        var img = document.createElement('img');
        img.src = 'assets/icons/voicetoggle.svg';
        img.alt = '';
        btn.appendChild(img);
      }
      btn.onclick = function () {
        if (Config.section('app').stt === 'off') Config.set('app.stt', 'webSpeech');
        Voice.toggle();
      };
      Voice.onState(function () { App._syncMic(); });
      App._syncMic();
    },

    _syncMic: function () {
      var btn = document.getElementById('btn-mic');
      if (!btn || !window.Voice) return;
      var on = Voice.isListening();
      var blocked = on && !!(window.Turn && Turn.isSpeaking());
      btn.classList.toggle('listening', on);
      btn.classList.toggle('blocked', blocked);
      btn.title = I18n.t(on ? 'mic.stop' : 'mic.start');
    },

    /* Barge-in is armed only when the player turned it on. Kept in one place so
       the settings switch and boot agree. */
    _syncBargeIn: function () {
      if (!window.Voice || !Voice.setBargeIn) return;
      var on = !!Config.section('app').bargeIn;
      Voice.setBargeIn(on ? function () {
        if (window.Turn) Turn.interrupt('user-barge-in');
      } : null);
    },

    /* An accepted transcript — Echo and the half-duplex gate already had their
       say. It lands in the input box exactly like typed text, and auto-send goes
       through the send button so there is one send path, not two. */
    _onVoiceTranscript: function (text) {
      var inp = document.getElementById('input');
      if (!inp) return;
      inp.value = text;
      if (!Config.section('app').autoSend) return;
      var delay = Math.max(0, Number(Config.section('app').autoSendDelay) || 2000);
      if (App._autoSendTimer) clearTimeout(App._autoSendTimer);
      App._autoSendTimer = setTimeout(function () {
        App._autoSendTimer = null;
        if (String(inp.value).trim() !== String(text).trim()) return;
        var send = document.getElementById('btn-send');
        if (send) send.click();
      }, delay);
    },

    /* -------------------------------------------------------------- talk */
    _bindTalk: function () {
      var input = document.getElementById('input');
      var send = document.getElementById('btn-send');
      var go = function () {
        var text = input.value.trim();
        if (!text || App.speaking) return;
        input.value = '';
        App.say(text);
      };
      send.onclick = go;
      input.onkeydown = function (e) { if (e.key === 'Enter') go(); };
      var hitEl = document.getElementById('avatar-hit');
      hitEl.onclick = function (ev) {
        if (App._dragMoved) { App._dragMoved = false; return; }
        if (App._inTutorial) { Onboarding.tutorialAdvance(); return; }
        var rect = ev.target.getBoundingClientRect();
        var z = (window.Avatar && Avatar.cssZoom) ? Avatar.cssZoom(ev.target) : 1;
        var x = (ev.clientX - rect.left) / z, y = (ev.clientY - rect.top) / z;
        var part = Avatar.hitPartAt(x, y);
        if (!part) return;
        App._ripple(x, y);
        var overlay = Avatar.poke(part);
        Welcome.mark('touch');
        App.buzz();
        if (window.Sound) {
          Sound.se('touch_start');
          if (overlay) Sound.tapVoice(overlay);
        }
      };
      
      /* 拖动立绘（报告：只能缩放背景、立绘拖不动）。阈值 6px：手指抖动仍算点
         击（分部位点击必须活着），超过阈值才接管，并在随后的 click 里让位。*/
      App._bindDrag(hitEl);
      var retry = document.getElementById('btn-retry');
      if (retry) retry.onclick = function () {
        document.getElementById('retry-bar').classList.add('hidden');
        if (App._lastText) App.say(App._lastText);
      };
    },

    _bindOverlays: function () {
      document.getElementById('onb-next').onclick = function () { Onboarding.next(); };
      document.getElementById('onb-skip').onclick = function () { Onboarding.skip(); };
      document.getElementById('overlay-prologue').onclick = function () { Onboarding.prologueNext(); };
      document.getElementById('ring-dismiss').onclick = function () { App._dismissAlarm(); };
      document.getElementById('ring-snooze').onclick = function () { App._snoozeAlarm(); };
      document.getElementById('qc-ok').onclick = function () {
        document.getElementById('overlay-quest-clear').classList.add('hidden');
        if (Quests.pendingAdvance()) {
          Quests.takeNext();
          Quests.render(document.getElementById('quest-list'), {});
          Welcome.mark('mission_clear');   
          var st = Config.section('state');
          var clip = VoiceBank.pick('wellDone', st.mode === 'asmr' ? 'whisper' : 'normal', Alarm.todForHour(new Date().getHours()));
          setTimeout(function () { clip && App.playFile(clip); }, 500);
        }
      };
      document.getElementById('faint-cancel').onclick = function () {
        document.getElementById('overlay-faint').classList.add('hidden');
      };
      document.getElementById('faint-sleep').onclick = function () { App._sleepHome(); };
      document.getElementById('faint-cheat').onclick = function () {
        /* 昏倒界面的作弊按钮：仅在作弊已开启时可见，引擎才是唯一的开关来源 */
        if (!Game.cheat()) {
          Config.set('app.cheat', true);
          App.toast(I18n.t('cheat.on'));
        }
        Game.refill();
        document.getElementById('overlay-faint').classList.add('hidden');
        App.buildSettings();
      };
      document.querySelectorAll('.sheet-handle').forEach(function (h) {
        h.onclick = function () {
          var sheet = h.parentElement;
          if (sheet) sheet.classList.add('hidden');
        };
      });

      /* Close-button (×) inside each sheet header */
      document.querySelectorAll('.sheet-close-btn').forEach(function (btn) {
        btn.onclick = function () {
          var sheet = btn.closest('.sheet');
          if (sheet) sheet.classList.add('hidden');
        };
      });

      /* Click outside an open sheet to close it */
      document.addEventListener('click', function (e) {
        if (e.target.closest('.sheet') || e.target.closest('#btn-log-toggle') ||
            e.target.closest('#hud-stamina') || e.target.closest('#hud-money') ||
            e.target.closest('#hud-level') || e.target.closest('#hud-inv') ||
            e.target.closest('#log-head') || e.target.closest('#btn-world-people') ||
            e.target.closest('#btn-quest-sheet') || e.target.closest('.side-item')) return;
        document.querySelectorAll('.sheet:not(.hidden)').forEach(function (s) {
          s.classList.add('hidden');
        });
      }, true);
    },

    _showFaint: function () {
      var ov = document.getElementById('overlay-faint');
      var cheatBtn = document.getElementById('faint-cheat');
      if (cheatBtn) cheatBtn.classList.toggle('hidden', !Game.cheat());
      if (ov) ov.classList.remove('hidden');
      Avatar.setEmotion('crying', 'deny');
    },

    _sleepHome: function () {
      var st = Config.section('state');
      var tod = st.tod;
      Config.set('state.stage', HOME_STAGE);
      if (World.llmDrivesClock()) {
        tod = 'mor';
        Config.set('state.tod', 'mor');
        Config.set('state.gameHour', World.todStartHour('mor'));
        Config.set('state.gameClockAt', Date.now());
      }
      App._loadSceneFor(HOME_STAGE, tod);
      Sound.setPlace(HOME_STAGE, tod, World.backgroundFor(HOME_STAGE));
      Game.refill();
      Game.remember('Slept soundly at a safe home.');
      document.getElementById('overlay-faint').classList.add('hidden');
      App.showView('talk');
      App.toast(I18n.t('stamina.slept'));
      App.updateHud();
    },

    _onSailed: function () {
      Game.remember('Set Sail From Kurken Island By Ship!');
      App.toast(I18n.t('toast.sailed'));
      App.showView('world');
      App.renderWorld();
    },

    /* ------------------------------------------------------- status sheet */
    renderStatus: function () {
      var root = document.getElementById('status-body');
      if (!root) return;
      root.innerHTML = '';
      var a = Game.apples();
      var appleHtml = '';
      for (var i = 0; i < a.slots; i++) {
        appleHtml += '<img class="apple-mini" alt="" src="assets/icons/' +
          (i < a.filled ? 'stamina_apple_filled' : 'stamina_apple_empty') + '.svg">';
      }
      var e = Game.expIntoLevel();
      function row(k, v) {
        var d = document.createElement('div');
        d.className = 'st-row';
        var kk = document.createElement('span'); kk.className = 'st-k'; kk.textContent = k;
        var vv = document.createElement('span'); vv.className = 'st-v'; vv.innerHTML = v;
        d.appendChild(kk); d.appendChild(vv);
        root.appendChild(d);
        return d;
      }
      function sect(t) {
        var d = document.createElement('div');
        d.className = 'st-sect'; d.textContent = t;
        root.appendChild(d);
      }
      
      /* 满级标记走引擎接口 */
      var isMaxLv = !!(window.Ψ_x9 && window.Ψ_x9.λ6());
      sect(I18n.t('st.level') + ' ' + Game.level() + (isMaxLv ? ' ★MAX' : ''));
      row(I18n.t('stamina') || 'スタミナ', appleHtml + ' <b>' + (Game.cheat() ? '∞' : Game.s.stamina + '/' + Game.max()) + '</b>');
      var expDisplay = isMaxLv
        ? '<b>∞</b> / ∞（MAX · ' + Game.s.exp_total + '）'
        : e.into + ' / ' + e.span + '（' + Game.s.exp_total + '）';
      row(I18n.t('st.exp'), expDisplay);
      row('G', Game.cheat() ? '∞' : String(Game.s.money));
      var q = Quests.active();
      if (q) row(I18n.t('quest.goal'),
        '「' + App.esc(q.title) + '」 ' + (q.step | 0) + '/' + q.need);
      row(I18n.t('st.met'), String(Game.s.met_charas.length));
      if (Game.s.met_charas.length && window.World && World.npcs) {
        var names = Game.s.met_charas.slice(-12).reverse()
          .map(function (id) { return World.npcName(id); }).join('、');
        var nr = document.createElement('div');
        nr.className = 'st-mem';
        nr.textContent = names;
        root.appendChild(nr);
      }
      row(I18n.t('quest.ship'), Game.flag('ship_parts', 0) + ' / 4' + (Game.s.sailed ? ' ⛵' : ''));

      sect(I18n.t('st.memory'));
      var mems = Game.s.memory.slice(-12).reverse();
      if (!mems.length) {
        var e2 = document.createElement('div');
        e2.className = 'empty'; e2.textContent = I18n.t('memory.empty');
        root.appendChild(e2);
      }
      mems.forEach(function (m) {
        var d = document.createElement('div');
        d.className = 'st-mem'; d.textContent = m.text;
        root.appendChild(d);
      });
    },

    /* ------------------------------------------------------ inventory sheet */
    renderInv: function () {
      var which = App._invBag;
      var root = document.getElementById('inv-list');
      root.innerHTML = '';
      var list = Game.bagList(which);
      if (!list.length) {
        root.innerHTML = '<div class="empty">' + I18n.t('inv.empty') + '</div>';
      }
      list.forEach(function (it) {
        var row = document.createElement('div');
        row.className = 'inv-row';
        row.innerHTML = '<span class="inv-name"></span><span class="inv-n"></span>';
        var name = Game.itemName(it.id);
        row.querySelector('.inv-name').textContent = name;
        row.querySelector('.inv-n').textContent = '×' + (it.count || 1);
        row.onclick = function () {
          var inp = document.getElementById('input');
          inp.value = ((inp.value || '') + ' ' + name).trim();
          document.getElementById('sheet-inv').classList.add('hidden');
          App.showView('talk');
          inp.focus();
        };
        root.appendChild(row);
      });
      var cap = document.getElementById('inv-cap');
      if (cap) cap.textContent = I18n.t('inv.cap')
        .replace('{u}', String(Game.bagUsed(which)))
        .replace('{c}', String(Game.bagCap(which)));
      var up = document.getElementById('btn-bag-up');
      if (up) {
        var order = Game.BAG_ORDER;
        var cur = which === 'ryza' ? Game.s.bagRyza : Game.s.bagYou;
        var idx = order.indexOf(cur);
        var next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
        var price = next ? (Game.BAG_UPGRADE_COST[next] || 0) : 0;
        up.classList.toggle('hidden', !next);
        if (next) {
          up.textContent = I18n.t('inv.upgrade').replace('{p}', String(price));
          up.onclick = function () {
            if (Game.upgradeBag(which)) {
              App.toast(I18n.t('inv.upgraded'));
              if (window.Sound) Sound.se('quest_clear');
            } else {
              App.toast(I18n.t('inv.tooSmall'), true);
            }
            App.renderInv();
          };
        }
      }
    },

    /* Scene facts every talk mode gets (source marionette_injection:
       scene.current_stage / time_bucket / cast). Location is on screen
       even in ASMR — without this block the model cannot name a place
       or emit current_stage. */
    _sceneContext: function () {
      var st = Config.section('state');
      var parts = [];
      if (window.World && World.promptBlock) parts.push(World.promptBlock(st));
      parts.push(App._peopleBlock(st));
      if (window.World) parts.push(App._clockBlock(st));
      return parts.filter(Boolean).join('\n\n');
    },

    /* Numeric RPG (stamina / bags / quests) — chat/story/immersive only.
       ASMR/text still receive _sceneContext so they can travel/sleep. */
    _rpgContext: function () {
      var st = Config.section('state');
      if (!RPG_MODES[st.mode]) return '';
      return [Game.promptBlock(), Quests.promptBlock()].filter(Boolean).join('\n\n');
    },

    /* met_charas / npcs here — the official game state fed these to the
       model so Ryza can reference other islanders by name. */
    _peopleBlock: function (st) {
      if (!window.World || !World.npcs) return '';
      var L = ['## People In This World (Excluding Ryza)'];
      var here = World.npcsAt(st.stage, st.day || 1);
      L.push('- People currently in the same location: ' +
        (here.length ? here.map(function (n) {
          return World.npcName(n.id) + (n.note ? '（' + n.note + '）' : '');
        }).join('、') : 'none'));
      var known = {};
      (World.npcs.npcs || []).forEach(function (n) { known[n.id] = n; });
      var met = (Game.s.met_charas || [])
        .map(function (id) { return known[id]; })
        .filter(Boolean).slice(0, 16);
      if (met.length) {
        L.push('- People met so far: ' + met.map(function (n) {
          return World.npcName(n.id) + (n.note ? '（' + n.note + '）' : '');
        }).join('、'));
      }
      if (window.Npc && Npc.promptBlock) {
        var npcBlock = Npc.promptBlock(st, {
          appCfg: Config.section('app'),
          translate: !!(window.Langs && Langs.llm && Langs.ui && Langs.llm() !== Langs.ui())
        });
        if (npcBlock) L.push('', npcBlock);
      }
      return L.join('\n');
    },

    /* re-paint every localized surface after a language change */
    _relocalize: function () {
      App.buildSettings();
      App.buildCharaForm();
      App.updateHud();
      var inp = document.getElementById('input');
      if (inp) inp.placeholder = I18n.tc('input.hint', inp.placeholder);
      Quests.render(document.getElementById('quest-list'), {});
      Daily.render(document.getElementById('daily-body'));
      Welcome.render(document.getElementById('welcome-body'));
      App.renderWorld();
      App.renderStatus();
      if (document.getElementById('skin-grid')) App.renderSkins();
      if (document.getElementById('memory-list')) App.renderMemory();
      if (window.Alarm && Alarm.render) {
        var al = document.getElementById('alarm-list');
        if (al) Alarm.render(al, App.playFile);
      }
      if (App._syncVoicePill) App._syncVoicePill();
      App._syncSpeedBtn();
    },

    _openChangelog: function () {
      if (window.Changelog) Changelog.open();
    },

    _openLangSheet: function () {
      var sheet = document.getElementById('sheet-lang');
      var list = document.getElementById('lang-list');
      if (!sheet || !list) return;
      list.innerHTML = '';
      (I18n.LANGS || []).forEach(function (item) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'mode-pill' + (I18n.lang === item.id ? ' active' : '');
        b.textContent = item.label;
        b.onclick = function () {
          Config.set('app.lang', item.id);
          I18n.setLang(item.id);
          App.applyI18n(document);
          App._relocalize();
          sheet.classList.add('hidden');
        };
        list.appendChild(b);
      });
      sheet.classList.remove('hidden');
    },

    _toggleChara: function () {
      var on = !(Avatar && Avatar.isHidden && Avatar.isHidden());
      if (Avatar && Avatar.setHidden) Avatar.setHidden(on);
      var ico = document.getElementById('ico-toggle-chara');
      if (ico) ico.src = on ? 'assets/icons/chara_show.svg' : 'assets/icons/chara_hide.svg';
    },

    _toggleFullscreen: function () {
      var el = document.getElementById('phone') || document.documentElement;
      var cur = document.fullscreenElement || document.webkitFullscreenElement;
      var req = el.requestFullscreen || el.webkitRequestFullscreen;
      var exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (!cur) {
        req && req.call(el);
        Config.set('app.fullscreen', true);
      } else {
        exit && exit.call(document);
        Config.set('app.fullscreen', false);
      }
    },

    _confirmNewTalk: function () {
      App.openModal({
        title: I18n.t('talk.resetTitle'),
        okLabel: I18n.t('talk.resetOk'),
        build: function (body) {
          var p = document.createElement('p');
          p.className = 'onb-sub';
          p.textContent = I18n.t('talk.resetMsg');
          body.appendChild(p);
        },
        onOk: function () {
          App.history = [];
          if (window.Nsfw) Nsfw.reset();
          App._pages = []; App._pageSel = -1;
          App._clearChat();
          App.showView('talk');
          App.greet();
        }
      });
    },

    greet: function () {
      var st = Config.section('state');
      var line = st.day > 1 ? I18n.tc('greet.n', '……今日も、会えたね。') : I18n.tc('greet.1', '……やあ、会えたね。');
      App.showBubble(line);
      Avatar.setEmotion('happy', 'agree');
    },

    say: function (text) {
      var st = Config.section('state');
      if (!Config.section('llm').apiKey) {
        App.toast(I18n.t('toast.needKey'), true);
        App.showView('settings');
        return;
      }
      if (Game.faint() || !Game.canAct(Game.turnCost(st.mode, st.style))) {
        App.toast(I18n.t('toast.staminaOut'), true);
        App._showFaint();
        return;
      }
      var isRetry = App._failedText === text;
      App._failedText = null;
      if (!isRetry) App._addUserMsg(text);
      App._lastText = text;
      var retryBar = document.getElementById('retry-bar');
      if (retryBar) retryBar.classList.add('hidden');
      App.speaking = true;
      document.getElementById('btn-send').disabled = true;
      App.showTyping();
      Welcome.mark('talk');
      var turnEpoch = (window.Turn && Turn.beginTurn) ? Turn.beginTurn('say') : null;
      
      /* 本轮用户说的话作为长期记忆的相关度线索（cue），
         并把这一轮记进待归纳队列（攒够 PENDING_MAX 自动归纳一次）。 */
      if (window.LongTerm) {
        try { LongTerm.note('user', text); } catch (e) {}
      }
      Api.chat(App.history, text, {
        mode: st.mode, style: st.style,
        epoch: turnEpoch,
        cue: text,
        rpgContext: App._rpgContext(),
        sceneSection: App._sceneContext(),
        nsfwSection: window.Nsfw ? Nsfw.screenFact() : ''
      })
        .then(function (reply) {
          if (!App._turnCurrent(turnEpoch)) return;
          App.speaking = false;
          if (window.Turn && Turn.finishTurn) Turn.finishTurn();
          document.getElementById('btn-send').disabled = false;
          App.history.push({ role: 'user', content: text });
          App.remember('user', text);
          App.remember('ryza', reply.text);
          try { if (window.Memory) Memory.ingest(text, reply.text); } catch (e) {}

          if (reply.state && typeof reply.state === 'object') {
            Game.applyDelta(reply.state, 'llm');
            App._applySceneDelta(reply.state);
          }
          var cost = Game.turnCost(st.mode, st.style);
          Game.spend(cost, 'talk');

          if (window.Nsfw) Nsfw.onTurn(reply);
          if (reply.emotion || reply.attitude) {
            Avatar.setEmotion(reply.emotion, reply.attitude);
          }
          App.history.push({
            role: 'assistant',
            content: Api.formatHistoryReply(reply.text)
          });
          App._sayReply(reply, turnEpoch);
          
          if (window.LongTerm) {
            try { LongTerm.note('assistant', reply.text); } catch (e) {}
          }
          if (!(reply.state && reply.state.quest)) Quests.progressEvent('talk');
          Quests.render(document.getElementById('quest-list'), {});
        })
        .catch(function (e) {
          if (e && e.stale) return;
          if (!App._turnCurrent(turnEpoch)) return;
          App.speaking = false;
          if (window.Turn && Turn.finishTurn) Turn.finishTurn();
          document.getElementById('btn-send').disabled = false;
          App._failedText = text;
          var bar = document.getElementById('retry-bar');
          if (bar && e.message !== 'NO_KEY') bar.classList.remove('hidden');
          var msg = String(e.message || '');
          var kind = App._failKind(e);
          App.toast(kind === 'nokey' ? I18n.t('toast.needKey') : kind === 'auth' ? I18n.t('toast.llmAuth') : kind === 'model' ? I18n.t('toast.llmModel') : I18n.t('toast.llmFail') + msg, true);
          App.showBubble(I18n.tc('bubble.fail.' + kind,
            kind === 'nokey' ? '（……ねえ、設定でAPIキーを入れないと、あたしの声が届かないみたい。）'
            : kind === 'auth' ? '（……あれ、鍵が合ってないみたい。設定を見直してくれる？）'
            : kind === 'model' ? '（……そのモデル名、あたしには呼べないみたい。設定を確認して。）'
            : kind === 'timeout' ? '（……返事を待ってるのに、届いてないみたい。設定のベースURLとモデル名、見てくれる？）'
            : kind === 'net' ? '（……そのアドレスに辿り着けないみたい。設定のベースURL、合ってる？）'
            : '（……ごめん、今ちょっと繋がらないみたい。少し待ってからもう一回。）'));
        });
    },

    /* 把模型端点的失败归类，让提示指向真正的原因。
       传输层那两条优先看 Api 挂上的 err.code —— 文案已经本地化，不能再拿中文去匹配；
       其余只依据错误文本（各家端点错误码不统一）：
         nokey 没填 Key / auth 401|403 认证失败 / model 模型名不被接受 /
         timeout 端点不回 / net 地址不可达 / other 其余 */
    _failKind: function (err) {
      var code = (err && typeof err === 'object' && err.code) || '';
      if (code === 'timeout' || code === 'net') return code;
      var m = String((err && err.message) || err || '');
      if (m === 'NO_KEY' || /NO_KEY|needKey/i.test(m)) return 'nokey';
      if (/401|403|unauthor|invalid[_ ]api[_ ]key|forbidden/i.test(m)) return 'auth';
      if (/model|not found|unsupported/i.test(m)) return 'model';
      return 'other';
    },

    /* Is the turn with this epoch still the one in charge? Null means there is
       no turn layer (or no canceller was injected), so there is nothing to
       compare against and the caller is treated as current. */
    _turnCurrent: function (epoch) {
      if (epoch == null) return true;
      if (!window.Turn || !Turn.epoch) return true;
      return Turn.epoch() === epoch;
    },

    /* A reply can now carry more than one speaker (web/js/npc.js). Her lines are
       typed and spoken; another islander's lines are text only, and they wait
       until she has finished talking — otherwise the panel gets rewritten
       mid-sentence while her voice is still going. */
    _sayReply: function (reply, turnEpoch) {
      var beats = (window.Npc && Npc.split)
        ? Npc.split(reply.text)
        : [{ speaker: 'ryza', id: '', name: '', text: String(reply.text || '') }];
      if (!beats.length) { App.typeBubble(''); return; }
      var mine = (window.Npc && Npc.spokenText) ? Npc.spokenText(beats) : reply.text;
      var showOriginal = true;
      try {
        var appCfg = Config.section('app') || {};
        if (appCfg.showOriginal === false) showOriginal = false;
      } catch (e) {}
      var others = beats.filter(function (b) {
        if (b.speaker === 'ryza') return false;
        return true;
      });
      if (!showOriginal && others.some(function (b) { return b.speaker === 'translation'; })) {
        mine = '';
      }

      var showOthers = function () {
        var i = 0;
        (function next() {
          if (i >= others.length) return;
          var b = others[i++];
          var lab = Npc.labelFor(b);
          App.typeBubble(lab ? lab + '：' + b.text : b.text, next);
        })();
      };

      App.typeBubble(mine, function () {
        if (!App._turnCurrent(turnEpoch)) return;
        if (mine) App.speakThen(mine, reply.emotion);
        if (!others.length) return;
        if (window.Turn && Turn.isSpeaking()) {
          var off = Turn.on(function (ev) {
            if (ev.type !== 'end' && ev.type !== 'cancel') return;
            off();
            showOthers();
          });
        } else {
          showOthers();
        }
      });
    },

    speakThen: function (text, emotion) {
      var st = Config.section('state');
      var app = Config.section('app');
      if (!app.voice || st.style === 'text' || Config.section('tts').mode === 'off') return;
      Turn.speak(text, {
        mode: st.mode,
        emotion: emotion || (window.Avatar && Avatar.currentEmotion && Avatar.currentEmotion()) || '',
        fx: Api.MODE_PLAY_FX[st.mode] || null,
        ownerId: 'chat'
      });
    },

    /* 重播上一段语音（从缓存取，不重新合成）。 */
    replayLastVoice: function () {
      if (!window.VoiceCache || !App._lastVoiceKey) { App.toast('No voice line to replay'); return; }
      VoiceCache.urlFor(App._lastVoiceKey).then(function (url) {
        if (!url) { App.toast('This voice line is no longer cached'); return; }
        var a = App.audio;
        if (!a) return;
        try {
          a.src = url;
          a.playbackRate = 1;
          a.play().catch(function () {});
          Avatar.setTalking(true);
          a.onended = function () { Avatar.setTalking(false); try { URL.revokeObjectURL(url); } catch (e) {} };
        } catch (e) { App.toast('Replay failed'); }
      }).catch(function () { App.toast('Replay failed'); });
    },

    /* 收藏 / 取消收藏上一段语音（收藏的片段不会被字节预算逐出） */
    favLastVoice: function () {
      if (!window.VoiceCache || !App._lastVoiceKey) { App.toast('No voice line to favorite'); return; }
      var on = VoiceCache.toggleFav(App._lastVoiceKey);
      App.toast(on ? 'Voice line favorited' : 'Removed from favorites');
    },

    /* Shared end-of-audio bookkeeping. The rate reset is not cosmetic: ASMR
       plays at 0.93× and a missed reset made the next alarm/tap clip play
       detuned (AUDIT 8). */
    _stopAudio: function (url, holdMs) {
      var a = App.audio;
      if (a) {
        try { a.pause(); } catch (e) {}
        a.playbackRate = 1;
      }
      Avatar.setTalking(false);
      if (url) URL.revokeObjectURL(url);
      App._bubbleHold(holdMs);
    },

    /* Speech playback for Turn: identical bookkeeping to playUrl, plus the
       abort path so an interruption stops the audio mid-utterance and returns
       immediately instead of waiting for the clip to end. */
    playSpeech: function (url, signal, fx) {
      var a = App.audio;
      return new Promise(function (resolve) {
        var done = false;
        function clean() {
          if (!a) return;
          a.removeEventListener('ended', settle);
          a.removeEventListener('error', stop);
          if (signal) signal.removeEventListener('abort', stop);
        }
        function settle() { if (done) return; done = true; clean(); resolve(); }
        function stop() { App._stopAudio(url, 1600); settle(); }
        if (!a) { settle(); return; }
        a.addEventListener('ended', settle);
        a.addEventListener('error', stop);
        if (signal) {
          if (signal.aborted) { stop(); return; }
          signal.addEventListener('abort', stop);
        }
        Promise.resolve(App.playUrl(url, fx)).catch(function () { stop(); });
      });
    },

    /* fx: optional { rate, gain } per-mode playback shaping (see
       Api.MODE_PLAY_FX — ASMR slows and softens even on endpoints that
       ignore voice instructions). */
    playUrl: function (url, fx) {
      App._ensureVoiceGraph();
      if (App._voiceCtx && App._voiceCtx.state === 'suspended') {
        App._voiceCtx.resume().catch(function () {});
      }
      var a = App.audio;
      a.src = url;
      var base = (window.Sound && Sound._gain) ? Sound._gain('voice')
        : (Number(Config.section('app').volume) || 0.9);
      a.volume = Math.max(0, Math.min(1, base * ((fx && fx.gain) || 1)));
      a.playbackRate = (fx && fx.rate) || 1;
      a.onended = function () { App._stopAudio(url, 1600); };
      Avatar.setTalking(true);
      App._bubbleKeep();
      var playing = a.play();
      if (playing && typeof playing.catch === 'function') {
        playing.catch(function () { Avatar.setTalking(false); });
      }
      App.buzz();
      return playing;
    },

    _pauseVoice: function () {
      if (App.audio) { try { App.audio.pause(); } catch (e) {} }
      if (Avatar && Avatar.setTalking) Avatar.setTalking(false);
    },

    playFile: function (path, vol, force) {
      if (!force && !Config.section('app').voice) return;
      App._ensureVoiceGraph();
      if (App._voiceCtx && App._voiceCtx.state === 'suspended') {
        App._voiceCtx.resume().catch(function () {});
      }
      var a = App.audio;
      a.src = path;
      a.volume = vol != null ? vol : ((window.Sound && Sound._gain) ? Sound._gain('voice')
        : (Number(Config.section('app').volume) || 0.9));
      Avatar.setTalking(true);
      if (window.Alarm && Alarm.loadEnv) {
        Alarm.loadEnv(path).then(function (env) {
          if (env && Avatar.setTalkingEnvelope) Avatar.setTalkingEnvelope(env);
        });
      }
      a.onended = function () { Avatar.setTalking(false); };
      a.play().catch(function () { Avatar.setTalking(false); });
      App.buzz();
    },

    /* ------------------------------------------------- log panel lifecycle
       2026-09-07 UI pass: the floating auto-fading bubble is gone. The
       official talk screen keeps a bottom log panel — avatar + name + mode
       description, the current line, page dots for the last few replies, and
       a ⇧ that expands the whole running conversation. _bubbleKeep/_bubbleHold
       stay as no-op seams (playUrl/speakThen still call them); nothing
       self-hides anymore, so the old fade race is structurally impossible. */
    _pages: [],
    _pageSel: -1,
    _typeGen: 0,
    _bubbleKeep: function () {
      if (App._bubbleTimer) { clearTimeout(App._bubbleTimer); App._bubbleTimer = null; }
    },
    _bubbleHold: function () { },
    _bubbleReveal: function () { },

    /* the pill's own two official placeholder states (input.hint lives in
       the CONTENT table → tc; input.waiting is a UI key → t) */
    _inputHint: function (waiting) {
      var inp = document.getElementById('input');
      if (!inp) return;
      inp.placeholder = waiting ? I18n.t('input.waiting') : I18n.tc('input.hint', inp.placeholder);
    },

    /* kept as no-ops: older call sites still reference them */
    _pushPage: function () {},
    _renderDots: function () {},
    _cycleTextSpeed: function () {
      var cur = Config.textSpeed();
      var idx = 0;
      Config.TEXT_SPEEDS.forEach(function (o, i) { if (o.v === cur) idx = i; });
      var nxt = Config.TEXT_SPEEDS[(idx + 1) % Config.TEXT_SPEEDS.length];
      Config.set('app.textSpeed', nxt.v);
      App._syncSpeedBtn();
    },
    _syncSpeedBtn: function () {
      var b = document.getElementById('btn-speed');
      if (!b) return;
      var cur = Config.textSpeed();
      var label = { 30: '×1', 18: '×1.5', 12: '×2', 8: '×3' };
      b.textContent = label[cur] || (cur <= 10 ? '×3' : cur <= 15 ? '×2' : cur <= 24 ? '×1.5' : '×1');
    },

    /* a new line always brings the panel back (official: she never talks
       into a collapsed strip) */
    _panelUp: function () {
      var phone = document.getElementById('phone');
      if (phone && phone.classList.contains('panel-collapsed')) {
        phone.classList.remove('panel-collapsed');
        var arrow = document.querySelector('#btn-log-toggle img');
        if (arrow) arrow.style.transform = '';
      }
    },

    /* ---- chat log: every message (yours and hers) is a row in one list.
       Rows are appended, never replaced; the list auto-scrolls to the bottom. */
    _chatList: function () { return document.getElementById('chat-list'); },
    _clearChat: function () {
      var l = App._chatList(); if (l) l.innerHTML = '';
      App._curAi = null;
    },
    _nearBottom: function () {
      var b = document.getElementById('log-body');
      return !b || (b.scrollHeight - b.scrollTop - b.clientHeight) < 90;
    },
    _addMsg: function (role, text) {
      var list = App._chatList();
      if (!list) return null;
      var row = document.createElement('div');
      row.className = 'msg ' + role;
      var bub = document.createElement('div');
      bub.className = 'bubble';
      bub.textContent = text || '';
      row.appendChild(bub);
      list.appendChild(row);
      /* keep the DOM light on very long sessions */
      while (list.children.length > 200) list.removeChild(list.firstChild);
      App._scrollLog(true);
      return bub;
    },
    _addUserMsg: function (text) { App._addMsg('user', text); },
    /* the AI row currently being filled: reuse the typing-dots row if there is one */
    _takeAi: function () {
      var el = App._curAi;
      if (el && el.isConnected) { App._curAi = null; return el; }
      App._curAi = null;
      return App._addMsg('ai', '');
    },

    showTyping: function () {
      App._panelUp();
      var vig = document.getElementById('vignette');
      if (App._curAi && App._curAi.isConnected) App._curAi.parentNode.remove();
      var b = App._addMsg('ai', '');
      if (b) {
        b.classList.add('typing', 'speaking');
        b.innerHTML = '<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>';
        App._curAi = b;
      }
      if (vig) vig.classList.add('talk-glow');
      App._inputHint(true);
    },

    showBubble: function (text) {
      App._panelUp();
      var vig = document.getElementById('vignette');
      if (vig) vig.classList.remove('talk-glow');
      if (Config.section('app').showBubble === false) {
        if (App._curAi && App._curAi.isConnected) App._curAi.parentNode.remove();
        App._curAi = null;
        return;
      }
      var b = App._takeAi();
      if (b) { b.classList.remove('typing', 'speaking'); b.textContent = text; }
      App._scrollLog(true);
      App._inputHint(false);
    },

    typeBubble: function (text, done) {
      App._panelUp();
      if (App._typeTimer) clearTimeout(App._typeTimer);
      var gen = ++App._typeGen;
      var vig = document.getElementById('vignette');
      if (!text) {
        if (App._curAi && App._curAi.isConnected) App._curAi.parentNode.remove();
        App._curAi = null;
        if (vig) vig.classList.remove('talk-glow');
        App._inputHint(false);
        done && done();
        return;
      }
      var b = App._takeAi();
      if (!b) { done && done(); return; }
      b.classList.remove('typing');
      b.classList.add('speaking');
      b.textContent = '';
      if (vig) vig.classList.add('talk-glow');
      var speed = Config.textSpeed();
      var i = 0;
      (function step() {
        if (gen !== App._typeGen) return;
        if (i >= text.length) {
          b.classList.remove('speaking');
          if (vig) vig.classList.remove('talk-glow');
          App._inputHint(false);
          done && done();
          return;
        }
        b.textContent = text.slice(0, ++i);
        App._scrollLog();
        App._typeTimer = setTimeout(step, speed);
      })();
    },
    
    /* auto-scroll to the newest line. While she types it only follows if you
       are already at the bottom, so scrolling up to reread isn't yanked back. */
    _scrollLog: function (force) {
      var b = document.getElementById('log-body');
      if (!b) return;
      if (force || App._nearBottom()) {
        b.style.scrollBehavior = 'auto';
        b.scrollTop = b.scrollHeight;
        b.style.scrollBehavior = '';
      }
    },

    /* ------------------------------------------------------------ alarms */
    _onAlarm: function (a, clip) {
      App._ringAlarm = a;
      var ov = document.getElementById('overlay-alarm');
      document.getElementById('ring-time').textContent = a.time || '';
      document.getElementById('ring-type').textContent = I18n.t('alarm.type.' + a.type);
      ov.classList.remove('hidden');
      App.showBubble('（' + I18n.t('alarm.type.' + a.type) + '）');
      Avatar.setEmotion('happy', 'agree');
      var gain = (window.Sound && Sound._gain) ? Sound._gain('voice') : 0.9;
      var vol = Math.max(0, Math.min(1, gain * (Number(a.volume) || 1)));
      if (clip) App.playFile(clip, vol);
      if (a.vibrate !== false) App.buzz([30, 60, 30, 60, 30]);
    },

    _dismissAlarm: function () {
      document.getElementById('overlay-alarm').classList.add('hidden');
      if (App.audio) { try { App.audio.pause(); } catch (e) {} }
      Avatar.setTalking(false);
      App._ringAlarm = null;
    },

    _snoozeAlarm: function () {
      if (App._ringAlarm) Alarm.snooze(App._ringAlarm);
      App._dismissAlarm();
      App.toast(I18n.t('alarm.snooze'));
    },

    /* -------------------------------------------------------- modal forms */
    closeModal: function () {
      document.getElementById('modal-scrim').classList.add('hidden');
    },

    openModal: function (opts) {
      opts = opts || {};
      var scrim = document.getElementById('modal-scrim');
      var form = document.getElementById('modal');
      var body = document.getElementById('modal-body');
      document.getElementById('modal-title').textContent = opts.title || '';
      document.getElementById('modal-ok').textContent = opts.okLabel || I18n.t('form.ok');
      document.getElementById('modal-cancel').textContent = I18n.t('form.cancel');
      body.innerHTML = '';
      (opts.build || function () {})(body);
      App.applyI18n(form);
      scrim.classList.remove('hidden');

      var cancel = function () {
        App.closeModal();
        opts.onCancel && opts.onCancel();
      };
      document.getElementById('modal-cancel').onclick = cancel;
      scrim.onclick = function (e) { if (e.target === scrim) cancel(); };
      form.onsubmit = function (e) {
        e.preventDefault();
        if (opts.onOk && opts.onOk(body) === false) return;
        App.closeModal();
      };
    },

    _fieldEl: function (label, innerHtml) {
      var d = document.createElement('div');
      d.className = 'field';
      var lab = document.createElement('label');
      lab.textContent = label;
      d.appendChild(lab);
      var wrap = document.createElement('div');
      wrap.innerHTML = innerHtml;
      while (wrap.firstChild) d.appendChild(wrap.firstChild);
      return d;
    },

    _newAlarm: function () { App._alarmForm(null); },
    _editAlarm: function (id) { App._alarmForm(id); },

    _alarmForm: function (id) {
      var existing = id ? Alarm.get(id) : null;
      var now = new Date();
      var defTime = existing ? existing.time : (String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'));
      var defType = (existing && existing.type) || 'goodMorning';
      var defStyle = (existing && existing.style) || 'normal';
      var defDays = (existing && existing.days) ? existing.days.slice() : [];
      var defSnooze = (existing && existing.snoozeMin != null) ? existing.snoozeMin : 5;
      var defVol = (existing && existing.volume != null) ? existing.volume : 1;
      var defVib = existing ? existing.vibrate !== false : true;
      if (!/^\d{1,2}:\d{2}$/.test(defTime)) {
        defTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      }

      App.openModal({
        title: existing ? I18n.t('alarm.edit') : I18n.t('alarm.new'),
        okLabel: I18n.t('form.ok'),
        build: function (body) {
          body.appendChild(App._fieldEl(I18n.t('alarm.time'),
            '<input type="time" id="f-alarm-time" value="' + defTime + '" required>'));

          var typeOpts = Alarm.TYPES.map(function (t) {
            return '<option value="' + t + '"' + (t === defType ? ' selected' : '') + '>' + I18n.t('alarm.type.' + t) + '</option>';
          }).join('');
          body.appendChild(App._fieldEl(I18n.t('alarm.kind'),
            '<select id="f-alarm-type">' + typeOpts + '</select>'));

          var styleOpts = Alarm.STYLES.map(function (s) {
            return '<option value="' + s + '"' + (s === defStyle ? ' selected' : '') + '>' + I18n.t('alarm.style.' + s) + '</option>';
          }).join('');
          body.appendChild(App._fieldEl(I18n.t('alarm.tone'), '<select id="f-alarm-style">' + styleOpts + '</select>'));

          var days = document.createElement('div');
          days.className = 'field';
          var lab = document.createElement('label');
          lab.textContent = I18n.t('alarm.days');
          days.appendChild(lab);
          var chips = document.createElement('div');
          chips.className = 'day-chips';
          chips.id = 'f-alarm-days';
          Alarm.WEEK.forEach(function (label, i) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'chip' + (defDays.indexOf(i) >= 0 ? ' on' : '');
            b.setAttribute('data-day', String(i));
            b.textContent = label;
            b.onclick = function () { b.classList.toggle('on'); };
            chips.appendChild(b);
          });
          days.appendChild(chips);
          var hint = document.createElement('div');
          hint.className = 'hint';
          hint.textContent = I18n.t('alarm.everyday') + ' — ' + (I18n.lang === 'en' ? 'leave all off' : (I18n.lang === 'ja' ? '未選択で毎日' : '全不选即每天'));
          days.appendChild(hint);
          body.appendChild(days);

          body.appendChild(App._fieldEl(I18n.t('alarm.snooze') + ' (' + I18n.t('alarm.min') + ')', '<input type="number" id="f-alarm-snooze" min="1" max="30" value="' + defSnooze + '">'));
          body.appendChild(App._fieldEl(I18n.t('alarm.volume'), '<input type="range" id="f-alarm-vol" min="0" max="1" step="0.05" value="' + defVol + '">'));
          var vib = document.createElement('label');
          vib.className = 'switch-row';
          vib.innerHTML = '<span></span><input type="checkbox" id="f-alarm-vib"' +
            (defVib ? ' checked' : '') + '>';
          vib.querySelector('span').textContent = I18n.t('alarm.vibrate');
          body.appendChild(vib);
        },
        onOk: function (body) {
          var time = (body.querySelector('#f-alarm-time').value || '').slice(0, 5);
          if (!/^\d{2}:\d{2}$/.test(time)) { App.toast('Please enter a time', true); return false; }
          var type = body.querySelector('#f-alarm-type').value;
          var style = body.querySelector('#f-alarm-style').value;
          var days = [];
          body.querySelectorAll('#f-alarm-days .chip.on').forEach(function (c) {
            days.push(parseInt(c.getAttribute('data-day'), 10));
          });
          var payload = {
            time: time, type: type, style: style, days: days,
            snoozeMin: parseInt(body.querySelector('#f-alarm-snooze').value, 10) || 5,
            volume: parseFloat(body.querySelector('#f-alarm-vol').value) || 1,
            vibrate: !!body.querySelector('#f-alarm-vib').checked
          };
          if (existing) Alarm.update(existing.id, payload);
          else Alarm.add(payload);
          Alarm.render(document.getElementById('alarm-list'), App.playFile);
          App.toast(I18n.t('toast.saved'));
        }
      });
    },

    /* ------------------------------------------------------------ memory */
    remember: function (who, text) {
      App.memory.push({ who: who, text: text, at: Date.now() });
      if (App.memory.length > 400) App.memory = App.memory.slice(-400);
      App.saveMemory();
    },
    saveMemory: function () {
      try { localStorage.setItem(MEM_KEY, JSON.stringify(App.memory)); } catch (e) {}
    },
    renderMemory: function () {
      var root = document.getElementById('memory-list');
      if (!root) return;
      root.innerHTML = '';
      var T = function (k) { return I18n.t(k); };
      if (window.Memory) {
        var bag = Memory.list();
        var pend = Memory.pendingTurns();
        if (pend) {
          var p = document.createElement('div');
          p.className = 'hint';
          p.textContent = I18n.tf('memory.pending', '未总结 {n} 轮', { n: pend });
          root.appendChild(p);
        }
        function section(title, items) {
          if (!items.length) return;
          var h = document.createElement('div');
          h.className = 'mem-layer';
          h.textContent = title;
          root.appendChild(h);
          items.slice().reverse().forEach(function (c) {
            var el = document.createElement('div');
            el.className = 'card';
            el.innerHTML = '<div class="card-sub t-text"></div>' +
              '<div class="card-acts">' +
              '<button type="button" class="mini-btn t-edit"></button>' +
              '<button type="button" class="mini-btn t-del"></button></div>';
            el.querySelector('.t-text').textContent = c.text;
            el.querySelector('.t-edit').textContent = T('memory.edit');
            el.querySelector('.t-del').textContent = T('memory.del');
            el.querySelector('.t-edit').onclick = function () { App._editMemory(c.id); };
            el.querySelector('.t-del').onclick = function () {
              if (!confirm(T('memory.delAsk'))) return;
              Memory.remove(c.id);
              App.renderMemory();
            };
            root.appendChild(el);
          });
        }
        section(T('memory.summaries'), bag.summaries);
        section(T('memory.sessions'), bag.sessions);
      }
      if (App.memory && App.memory.length) {
        var h2 = document.createElement('div');
        h2.className = 'mem-layer';
        h2.textContent = T('memory.log');
        root.appendChild(h2);
        App.memory.slice().reverse().slice(0, 40).forEach(function (m) {
          var el = document.createElement('div');
          el.className = 'card';
          el.innerHTML = '<div class="card-title"><span class="tag' +
            (m.who === 'ryza' ? '' : ' leaf') + ' t-who"></span></div>' +
            '<div class="card-sub t-text"></div>';
          el.querySelector('.t-who').textContent = m.who === 'ryza' ? 'Ryza' : 'You';
          el.querySelector('.t-text').textContent = m.text;
          root.appendChild(el);
        });
      }
      if (!root.firstChild) {
        root.innerHTML = '<div class="empty">' + T('memory.empty') + '</div>';
      }
    },

    _editMemory: function (id) {
      var existing = id && window.Memory ? Memory.get(id) : null;
      App.openModal({
        title: existing ? I18n.t('memory.edit') : I18n.t('memory.add'),
        okLabel: I18n.t('form.ok'),
        build: function (body) {
          var ta = document.createElement('textarea');
          ta.id = 'mem-edit-text';
          ta.rows = 6;
          ta.value = existing ? existing.text : '';
          body.appendChild(ta);
          if (!existing) {
            var sel = document.createElement('select');
            sel.id = 'mem-edit-layer';
            [['session', I18n.t('memory.sessions')],
             ['summary', I18n.t('memory.summaries')]].forEach(function (p) {
              var o = document.createElement('option');
              o.value = p[0]; o.textContent = p[1];
              sel.appendChild(o);
            });
            body.appendChild(sel);
          }
        },
        onOk: function (body) {
          var text = (body.querySelector('#mem-edit-text') || {}).value || '';
          if (!window.Memory) return;
          if (existing) Memory.update(existing.id, text);
          else {
            var layer = (body.querySelector('#mem-edit-layer') || {}).value || 'session';
            Memory.add(text, layer);
          }
          App.renderMemory();
        }
      });
    },

    _llmModels: [],
    _qwenModels: [],

    _applyPickedModel: function (id) {
      Config.set('llm.model', id);
      var hit = (App._llmModels || []).filter(function (m) { return m.id === id; })[0];
      if (hit && window.Api && typeof Api.setModelMeta === 'function') Api.setModelMeta(hit);
      if (hit && hit.context && !(Number(Config.section('llm').contextWindow) > 0)) {
        Config.set('llm.contextWindow', hit.context);
        App.buildSettings();
      }
    },

    _fetchModels: function () {
      var llm = Config.section('llm');
      if (!llm.apiKey) { App.toast(I18n.t('toast.needKey'), true); return; }
      if (!llm.baseUrl) { App.toast(I18n.t('toast.needUrl'), true); return; }
      App.toast(I18n.t('toast.modelsWait'));
      Api.listModels().then(function (list) {
        App._llmModels = list || [];
        var hit = App._llmModels.filter(function (m) { return m.id === llm.model; })[0];
        if (hit && hit.context && !(Number(llm.contextWindow) > 0)) {
          Config.set('llm.contextWindow', hit.context);
        }
        App.toast(I18n.tf('toast.modelsOk', '已拉取 {n} 个模型', { n: App._llmModels.length }));
        App.buildSettings();
      }).catch(function (e) {
        App.toast(I18n.t('toast.modelsFail') + (e && e.message ? e.message : ''), true);
      });
    },

    _qwenModelSuggestions: function () {
      var ids = [], seen = {};
      function add(id) {
        id = String(id || '').trim();
        if (!id || seen[id]) return;
        seen[id] = 1;
        ids.push(id);
      }
      (Api.QWEN_TTS_MODELS || []).forEach(add);
      (App._qwenModels || []).forEach(function (m) { add(m && m.id); });
      add((Config.section('tts') || {}).qwenModel);
      return ids;
    },

    _fetchQwenModels: function () {
      var tts = Config.section('tts');
      if (!tts.qwenApiKey) { App.toast(I18n.t('toast.needKey'), true); return; }
      App.toast(I18n.t('toast.modelsWait'));
      Api.listQwenTtsModels().then(function (list) {
        App._qwenModels = list || [];
        App.toast(I18n.tf('toast.modelsOk', '已拉取 {n} 个模型', { n: App._qwenModels.length }));
        App.buildSettings();
      }).catch(function (e) {
        App.toast(I18n.t('toast.modelsFail') + (e && e.message ? e.message : ''), true);
      });
    },

    _fishVoiceSuggestions: function () {
      var ids = [], seen = {};
      function add(id) {
        id = String(id || '').trim();
        if (!id || seen[id]) return;
        seen[id] = 1;
        ids.push(id);
      }
      add(Api.FISH_DEFAULT_VOICE);
      add((Config.section('tts') || {}).fishVoice);
      add((Config.section('tts') || {}).fishVoiceAsmr);
      (App._fishVoices || []).forEach(function (v) { add(v && v.id); });
      return ids;
    },

    _fetchFishVoices: function () {
      var tts = Config.section('tts');
      if (!tts.fishApiKey) { App.toast(I18n.t('toast.needKey'), true); return; }
      App.toast(I18n.t('toast.modelsWait'));
      Api.listFishVoices().then(function (list) {
        App._fishVoices = list || [];
        App.toast(I18n.tf('toast.modelsOk', '已拉取 {n} 个模型', { n: App._fishVoices.length }));
        App.buildSettings();
      }).catch(function (e) {
        App.toast(I18n.t('toast.modelsFail') + (e && e.message ? e.message : ''), true);
      });
    },

    /* ------------------------------------------------------------- skins */
    renderSkins: function () {
      fetch('assets/_index/skins.json').then(function (r) { return r.json(); })
        .then(function (skins) {
          var imported = (Avatar.skinsIndex || []).filter(function (x) { return x.imported; });
          if (imported.length) skins = imported.concat(skins);
          var root = document.getElementById('skin-grid');
          var cur = Avatar.outfitOf(Config.section('state').skin);
          var seen = {}, outfits = [];
          skins.forEach(function (s) {
            var oid = Avatar.outfitOf(s.id);
            if (seen[oid]) {
              if (s.hasSpine) seen[oid].hasSpine = true;
              if (!seen[oid].preview && s.preview) seen[oid].preview = s.preview;
              return;
            }
            seen[oid] = { id: oid, hasSpine: !!s.hasSpine, preview: s.preview };
            outfits.push(seen[oid]);
          });
          root.innerHTML = '';
          var hintEl = document.getElementById('skin-posture-hint');
          if (hintEl) {
            hintEl.textContent = I18n.t('skin.postureHint') +
              (window.Avatar && Avatar.postureSwitchable && !Avatar.postureSwitchable()
                ? ' ' + I18n.t('skin.postureOneOnly') : '');
          }
          outfits.forEach(function (s) {
            var el = document.createElement('div');
            var wearable = !!s.hasSpine;
            el.className = 'skin-card' + (s.id === cur ? ' active' : '') + (wearable ? '' : ' locked');
            el.innerHTML = '<img><div class="skin-cap"><span class="t-name"></span>' + '<span class="skin-id"></span></div>';
            var img = el.querySelector('img');
            img.src = s.preview || 'assets/images/chara_placeholder.png';
            img.onerror = function () { img.src = 'assets/images/chara_placeholder.png'; };
            el.querySelector('.t-name').textContent = wearable
              ? I18n.t('skin.wear') : I18n.t('skin.previewOnly');
            el.querySelector('.skin-id').textContent = s.id.replace('crf_skn_002_', '');
            el.onclick = function () {
              if (!wearable) {
                App.toast(I18n.t('skin.previewOnly'), true);
                return;
              }
              Config.set('state.skin', s.id);
              App._switchSkin(s.id);
              App.renderSkins();
            };
            root.appendChild(el);
          });
        });
    },

    _switchSkin: function (id) {
      var veil = document.getElementById('skin-veil');
      veil.classList.add('veil-on');
      if (window.Sound) Sound.se('skin_change');
      setTimeout(function () {
        Avatar.loadSkin(id, function () {
          setTimeout(function () { veil.classList.remove('veil-on'); }, 280);
        });
      }, 160);
    },

    /* -------------------------------------------------------------- forms */
    /* Right-hand button column: hidden/shown by the small ✕ at its head.
       Kept in Config so the choice survives a restart; `silent` skips the
       write when this is only re-applying the stored value at boot. */
    setQuickCollapsed: function (on, silent) {
      document.body.classList.toggle('quick-collapsed', !!on);
      var qt = document.getElementById('btn-quick-toggle');
      if (qt) {
        qt.textContent = on ? '⋯' : '✕';
        qt.title = I18n.t(on ? 'quick.show' : 'quick.hide');
      }
      if (!silent) Config.set('app.quickCollapsed', !!on);
    },

    /* Drag the sprite: pointer capture + a movement threshold, so a tap still
       reaches the part hit-test. Layout px (CSS zoom divided out), forwarded to
       Avatar.panBy which works in world units. */
    _bindDrag: function (el) {
      if (!el) return;
      var drag = { id: null, x: 0, y: 0 };
      el.addEventListener('pointerdown', function (ev) {
        if (App._inTutorial) return;
        drag.id = ev.pointerId; drag.x = ev.clientX; drag.y = ev.clientY;
        App._dragMoved = false;
        try { el.setPointerCapture(ev.pointerId); } catch (e) { }
      });
      el.addEventListener('pointermove', function (ev) {
        if (drag.id !== ev.pointerId) return;
        var z = (window.Avatar && Avatar.cssZoom) ? Avatar.cssZoom(el) : 1;
        var dx = (ev.clientX - drag.x) / z, dy = (ev.clientY - drag.y) / z;
        if (Math.abs(dx) + Math.abs(dy) < 6) return;
        drag.x = ev.clientX; drag.y = ev.clientY;
        App._dragMoved = true;
        if (window.Avatar && Avatar.panBy) Avatar.panBy(dx, dy);
      });
      var end = function (ev) {
        if (drag.id !== ev.pointerId) return;
        drag.id = null;
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    },

    _field: function (wrap, labelKey, value, onInput, opts) {
      opts = opts || {};
      var d = document.createElement('div');
      d.className = 'field';
      var lab = document.createElement('label');
      lab.textContent = labelKey;
      var input = document.createElement(opts.multi ? 'textarea' : 'input');
      if (!opts.multi) input.type = opts.password ? 'password' : (opts.type || 'text');
      input.value = value == null ? '' : value;
      var suggestions = opts.suggestions || [];
      if (opts.list || suggestions.length) {
        var listId = opts.list || ('dl-' + String(labelKey || 'field').replace(/\W+/g, ''));
        input.setAttribute('list', listId);
        var dl = document.createElement('datalist');
        dl.id = listId;
        suggestions.forEach(function (s) {
          if (!s) return;
          var o = document.createElement('option');
          o.value = s;
          dl.appendChild(o);
        });
        d.appendChild(dl);
      }
      input.oninput = function () { onInput(input.value); };
      d.appendChild(lab); d.appendChild(input);
      if (opts.hint) {
        var h = document.createElement('div');
        h.className = 'hint'; h.textContent = opts.hint;
        d.appendChild(h);
      }
      wrap.appendChild(d);
      return d;
    },

    _select: function (wrap, labelKey, value, options, onChange) {
      var d = document.createElement('div');
      d.className = 'field';
      var lab = document.createElement('label');
      lab.textContent = labelKey;
      var sel = document.createElement('select');
      options.forEach(function (o) {
        var op = document.createElement('option');
        op.value = o.v; op.textContent = o.t;
        if (o.v === value) op.selected = true;
        sel.appendChild(op);
      });
      sel.onchange = function () { onChange(sel.value); };
      d.appendChild(lab); d.appendChild(sel);
      wrap.appendChild(d);
      return d;
    },

    _switch: function (wrap, labelKey, value, onChange) {
      var row = document.createElement('div');
      row.className = 'switch-row';
      var span = document.createElement('span');
      span.textContent = labelKey;
      var sw = document.createElement('div');
      sw.className = 'switch' + (value ? ' on' : '');
      sw.onclick = function () {
        var next = !sw.classList.contains('on');
        sw.classList.toggle('on', next);
        onChange(next);
      };
      row.appendChild(span); row.appendChild(sw);
      wrap.appendChild(row);
      return row;
    },

    _range: function (wrap, label, value, onInput) {
      var d = document.createElement('div');
      d.className = 'field';
      var lab = document.createElement('label');
      lab.textContent = label;
      var input = document.createElement('input');
      input.type = 'range';
      input.min = '0'; input.max = '1'; input.step = '0.01';
      input.value = value == null ? 1 : value;
      input.oninput = function () { onInput(parseFloat(input.value)); };
      d.appendChild(lab); d.appendChild(input);
      wrap.appendChild(d);
      return d;
    },

    _title: function (wrap, text) {
      var h = document.createElement('div');
      h.className = 'section-title'; h.textContent = text;
      wrap.appendChild(h);
    },

    /* ------------------------------------------------ settings (settings.js)
       The form assembly lives in its own module now; these are the only names
       other code may call, and they are what scripts/boot_smoke.js drives.
       The generic field primitives above stay here because the alarm form and
       the memory editor use them as well. */
    buildSettings: function () { return Settings.buildSettings(); },
    buildCharaForm: function () { return Settings.buildCharaForm(); },
    _testLlm: function () { return Settings._testLlm(); },
    _testTts: function () { return Settings._testTts(); },
    _renderSlots: function (w) { return Settings._renderSlots(w); }
  };

  global.App = App;
  document.addEventListener('DOMContentLoaded', function () { App.init(); });
})(window);
