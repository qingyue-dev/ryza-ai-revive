/* Daily login — rewritten. 青月 */

(function (global) {
  'use strict';

  var KEY = 'ryza.daily.v2';
  var CATCHUP_COST = 30;
  var RESET_HOUR = 7;

  var DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  /* Random reward pool — frozen so it cannot be edited at runtime.
     Every claim (daily or paid catch-up) rolls one entry from here. */
  var POOL = Object.freeze([
    { kind: 'stamina', amount: 'full', text: 'Stamina Refill' },
    { kind: 'stamina', amount: 20, text: 'Stamina +20' },
    { kind: 'stamina', amount: 40, text: 'Stamina +40' },
    { kind: 'stamina', amount: 60, text: 'Stamina +60' },

    { kind: 'money', amount: 50,   text: '50G' },
    { kind: 'money', amount: 100,  text: '100G' },
    { kind: 'money', amount: 150,  text: '150G' },
    { kind: 'money', amount: 250,  text: '250G' },
    { kind: 'money', amount: 350,  text: '350G' },
    { kind: 'money', amount: 500,  text: '500G' },
    { kind: 'money', amount: 750,  text: '750G' },
    { kind: 'money', amount: 1000, text: '1000G' },

    { kind: 'exp', amount: 25,  text: 'EXP +25' },
    { kind: 'exp', amount: 50,  text: 'EXP +50' },
    { kind: 'exp', amount: 75,  text: 'EXP +75' },
    { kind: 'exp', amount: 100, text: 'EXP +100' },
    { kind: 'exp', amount: 150, text: 'EXP +150' },
    { kind: 'exp', amount: 250, text: 'EXP +250' },

    { kind: 'item', id: 'wasser', n: 1, text: 'Distilled Water ×1' },
    { kind: 'item', id: 'wasser', n: 2, text: 'Distilled Water ×2' },
    { kind: 'item', id: 'wasser', n: 3, text: 'Distilled Water ×3' },
    { kind: 'item', id: 'wasser', n: 5, text: 'Distilled Water ×5' },
    { kind: 'item', id: 'apple',  n: 1, text: 'Stamina Apple ×1' },
    { kind: 'item', id: 'apple',  n: 2, text: 'Stamina Apple ×2' },
    { kind: 'item', id: 'apple',  n: 3, text: 'Stamina Apple ×3' },
    { kind: 'item', id: 'ore',    n: 1, text: 'Ore ×1' },
    { kind: 'item', id: 'ore',    n: 2, text: 'Ore ×2' },
    { kind: 'item', id: 'ore',    n: 3, text: 'Ore ×3' },
    { kind: 'item', id: 'uni',    n: 1, text: 'Uni ×1' },
    { kind: 'item', id: 'uni',    n: 2, text: 'Uni ×2' },
    { kind: 'item', id: 'uni',    n: 3, text: 'Uni ×3' },
    { kind: 'item', id: 'relic',  n: 1, text: 'Ancient Relic ×1' },
    { kind: 'item', id: 'relic',  n: 2, text: 'Ancient Relic ×2' },

    { kind: 'big', money: 200, exp: 50,  text: '200G + EXP +50' },
    { kind: 'big', money: 300, exp: 100, text: '300G + EXP +100' },
    { kind: 'big', money: 500, exp: 150, text: '500G + EXP +150' },
    { kind: 'big', money: 750, exp: 250, text: '750G + EXP +250' },
    { kind: 'big', money: 300, exp: 100, stamina: 'full', text: '300G + EXP +100 + Stamina Refill' },

    { kind: 'chest', money: 250,  item: 'wasser', text: 'Chest: 250G + Distilled Water' },
    { kind: 'chest', money: 500,  item: 'apple',  text: 'Chest: 500G + Stamina Apple' },
    { kind: 'chest', money: 500,  item: 'ore',    text: 'Chest: 500G + Ore' },
    { kind: 'chest', money: 750,  item: 'uni',    text: 'Chest: 750G + Uni' },
    { kind: 'chest', money: 1000, item: 'relic',  text: 'Chest: 1000G + Ancient Relic' }
  ]);

  function getRandomReward() { return POOL[rollIndex()]; }

  /* Unbiased random index; crypto first, Math.random as fallback. */
  function rollIndex() {
    try {
      var c = window.crypto || window.msCrypto;
      if (c && c.getRandomValues) {
        var a = new Uint32Array(1), lim = 4294967296 - (4294967296 % POOL.length);
        do { c.getRandomValues(a); } while (a[0] >= lim);
        return a[0] % POOL.length;
      }
    } catch (e) {}
    return Math.floor(Math.random() * POOL.length);
  }

  function nm(id) { return (window.Game && Game.itemName) ? Game.itemName(id) : id; }

  function rewardTextOf(r) {
    if (!r) return '?';
    switch (r.kind) {
      case 'stamina':
        return r.amount === 'full' ? L('dl.r.full', 'Stamina Refill')
                                   : L('dl.r.st', 'Stamina') + ' +' + r.amount;
      case 'money': return r.amount + 'G';
      case 'exp':   return L('dl.r.exp', 'EXP') + ' +' + r.amount;
      case 'item':  return nm(r.id) + '\u00d7' + (r.n || 1);
      case 'big':
        return r.money + 'G + ' + L('dl.r.exp', 'EXP') + ' +' + r.exp +
               (r.stamina === 'full' ? ' + ' + L('dl.r.full', 'Stamina Refill') : '');
      case 'chest': return L('dl.r.chest', 'Chest') + ': ' + r.money + 'G + ' + nm(r.item);
    }
    return r.text || '?';
  }

  /* Local tamper seal for the saved state (edit claimedWeek/log by hand -> mismatch). */
  function _seal(txt) {
    var k = '\u9752\u6708', h = 0x811c9dc5, i;
    txt = String(txt) + '|' + k;
    for (i = 0; i < txt.length; i++) h = (Math.imul(h ^ txt.charCodeAt(i), 0x01000193) ^ (h >>> 13)) >>> 0;
    return h.toString(36);
  }

  /* ─ helpers ─ */
  function L(key, fb)  { return (window.I18n && I18n.tc) ? I18n.tc(key, fb) : fb; }
  function dateStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function gameNow() {
    var d = new Date();
    if (d.getHours() < RESET_HOUR) {
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12, 0, 0);
    }
    return d;
  }
  function gameTodayStr() { return dateStr(gameNow()); }

  function gameDow() {
    var day = gameNow().getDay();
    return (day + 6) % 7;
  }

  function gameWeekStartStr() {
    var now = gameNow();
    var dow = (now.getDay() + 6) % 7;
    var mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow, 12, 0, 0);
    return dateStr(mon);
  }

  /* ── persistent state ── */

  var _celebrate = null;
  var _present   = null;

  function firstLaunchDate() {
    var raw = '';
    try { raw = localStorage.getItem('ryza.firstLaunch.v1') || ''; } catch (e) {}
    if (!raw) {
      raw = gameTodayStr();
      try { localStorage.setItem('ryza.firstLaunch.v1', raw); } catch (e) {}
    }
    return raw;
  }
  function parseYmd(s) {
    var p = String(s || '').split('-');
    return { y: Number(p[0])||0, m: Number(p[1])||0, d: Number(p[2])||0 };
  }
  function dayIndex() {
    var a = parseYmd(firstLaunchDate()), b = parseYmd(gameTodayStr());
    if (!a.y || !b.y) return 0;
    var t0 = Date.UTC(a.y, a.m - 1, a.d), t1 = Date.UTC(b.y, b.m - 1, b.d);
    return Math.max(0, Math.round((t1 - t0) / 86400000));
  }

  /* ── Daily object ── */

  var Daily = {
    dayIndex: dayIndex,
    setCelebrate: function (fn) { _celebrate = typeof fn === 'function' ? fn : null; },
    setPresenter: function (fn) { _present   = typeof fn === 'function' ? fn : null; },

    s: null,

    load: function () {
      var txt = null, tag = null, raw = null, sealed = false;
      try {
        txt = localStorage.getItem(KEY); tag = localStorage.getItem(KEY + '.s');
        sealed = localStorage.getItem(KEY + '.m') === '1';
      } catch (e) {}
      try { raw = JSON.parse(txt || 'null'); } catch (e) {}
      /* Sealed before but seal missing/wrong => edited by hand => lock this week. */
      var tampered = !!(txt && sealed && tag !== _seal(txt));
      Daily.s = Object.assign(
        { weekStart: '', claimedWeek: [], streak: 0, lastClaim: '', log: {} },
        raw || {}
      );
      if (!Daily.s.log || typeof Daily.s.log !== 'object') Daily.s.log = {};
      if (!Array.isArray(Daily.s.claimedWeek)) Daily.s.claimedWeek = [];
      if (tampered) { Daily.s.claimedWeek = [0, 1, 2, 3, 4, 5, 6]; Daily.save(); }

      /* ── weekly reset ── */
      var currentWeekStart = gameWeekStartStr();
      if (Daily.s.weekStart !== currentWeekStart) {
        Daily.s.weekStart = currentWeekStart;
        Daily.s.claimedWeek  = [];
        Daily.s.log = {};
        if (Daily.s.lastClaim) {
          var yesterday = new Date(gameNow().getFullYear(), gameNow().getMonth(), gameNow().getDate() - 1, 12, 0, 0);
          if (Daily.s.lastClaim !== dateStr(yesterday)) {
            Daily.s.streak = 0;
          }
        }
        Daily.save();
      }
      return Daily.s;
    },

    save: function () {
      try {
        var j = JSON.stringify(Daily.s);
        localStorage.setItem(KEY, j);
        localStorage.setItem(KEY + '.s', _seal(j));
        localStorage.setItem(KEY + '.m', '1');
      } catch (e) {}
    },

    available: function () {
      return Daily.s.claimedWeek.indexOf(gameDow()) === -1;
    },
    canCatchup: function (dowIdx) {
      return dowIdx < gameDow() && Daily.s.claimedWeek.indexOf(dowIdx) === -1;
    },

    streak: function () { return Daily.s.streak | 0; },
    weekDayIdx: function () { return gameDow(); },

    /* Reward already rolled for that weekday (null = still a mystery). */
    rewardFor: function (idx) {
      var pi = Daily.s && Daily.s.log ? Daily.s.log[idx] : undefined;
      return (typeof pi === 'number' && POOL[pi]) ? POOL[pi] : null;
    },
    getRandomReward: getRandomReward,

    /* Roll a random reward, give it, remember which one it was. Returns [text]. */
    _applyReward: function (idx) {
      var pi = rollIndex(), r = POOL[pi];
      switch (r.kind) {
        case 'stamina':
          if (r.amount === 'full') Game.refill();
          else if (Game.restore) Game.restore(r.amount);
          else Game.s.stamina = Math.min(Game.max(), (Game.s.stamina || 0) + r.amount);
          break;
        case 'money': Game.addMoney(r.amount); break;
        case 'exp':   Game.addExp(r.amount);   break;
        case 'item':  Game.addItem('you', r.id, r.n || 1); break;
        case 'big':
          Game.addMoney(r.money); Game.addExp(r.exp);
          if (r.stamina === 'full') Game.refill();
          break;
        case 'chest':
          Game.addMoney(r.money); Game.addItem('you', r.item, 1);
          break;
      }
      Daily.s.log[idx] = pi;
      return [rewardTextOf(r)];
    },

    /* ── free daily claim (today) ── */
    claim: function () {
      Daily.load();
      if (!Daily.available()) return { ok: false, reason: 'done' };
      var dow = gameDow();
      var msgs = Daily._applyReward(dow);
      Daily.s.streak++;
      Daily.s.lastClaim = gameTodayStr();
      if (Daily.s.claimedWeek.indexOf(dow) === -1) Daily.s.claimedWeek.push(dow);
      Daily.save();
      var _streak = Daily.s.streak;
      var logText = L('mem.daily', 'Day {n} login streak: {msgs}')
        .replace('{n}', String(_streak)).replace('{msgs}', msgs.join(', '));
      Game.remember(logText);
      if (_celebrate) { try { _celebrate(); } catch (e) {} }
      return { ok: true, day: dow + 1, text: msgs.join(', ') };
    },

    /* ── paid catchup (past unclaimed day this week) ── */
    catchup: function (dowIdx) {
      Daily.load();
      dowIdx = Util.clamp(dowIdx | 0, 0, 6);
      if (!Daily.canCatchup(dowIdx)) return { ok: false, reason: 'not_available' };
      if (!Game.spendMoney(CATCHUP_COST)) return { ok: false, reason: 'no_money' };
      var msgs = Daily._applyReward(dowIdx);
      if (Daily.s.claimedWeek.indexOf(dowIdx) === -1) Daily.s.claimedWeek.push(dowIdx);
      Daily.save();
      var logText = L('dl.catchupLog', 'Bought {day}: {msgs} (-{cost}G)')
        .replace('{day}', L('dl.week.' + DAYS[dowIdx], DAYS[dowIdx]))
        .replace('{msgs}', msgs.join(', '))
        .replace('{cost}', String(CATCHUP_COST));
      Game.remember(logText);
      return { ok: true, day: dowIdx + 1, text: msgs.join(', '), cost: CATCHUP_COST };
    },

    /* ── render ── */
    render: function (root) {
      if (!root) return;
      root.innerHTML = '';
      Daily.load();

      var head = document.createElement('div');
      head.className = 'dl-head';
      head.innerHTML = '<h3></h3><p class="dl-sub"></p><p class="dl-prog"></p>';
      head.querySelector('h3').textContent = L('dl.title', 'Daily login');
      head.querySelector('.dl-sub').textContent = L('dl.subtitle', 'Come say hi every day; streaks pay out.');
      head.querySelector('.dl-prog').textContent  =
        L('dl.progress', 'Streak: {n} days').replace('{n}', String(Daily.streak()));
      root.appendChild(head);

      var strip = document.createElement('div');
      strip.className = 'dl-strip';
      var todayDow = gameDow();

      var weekMonday = gameWeekStartStr().split('-');
      var monDate = new Date(
        parseInt(weekMonday[0]), parseInt(weekMonday[1]) - 1, parseInt(weekMonday[2]), 12, 0, 0
      );

      DAYS.forEach(function (dn, i) {
        var r = Daily.rewardFor(i);
        var cellDate = new Date(monDate.getFullYear(), monDate.getMonth(), monDate.getDate() + i, 12, 0, 0);
        var cellDateStr = (cellDate.getDate()) + '/' + (cellDate.getMonth() + 1);

        var claimed  = Daily.s.claimedWeek.indexOf(i) !== -1;
        var isToday  = i === todayDow;
        var isPast   = i < todayDow && !claimed;
        var isFuture = i > todayDow;

        var cell = document.createElement('div');
        var cls  = 'dl-cell';
        if (claimed)  cls += ' claimed';
        if (isToday && Daily.available()) cls += ' today';
        if (isPast)   cls += ' past';
        if (isFuture) cls += ' future';
        cell.className = cls;

        var icon = claimed ? 'check' : (r && (r.kind === 'chest' || r.kind === 'big')) ? 'present' : 'stamina_apple_filled';

        cell.innerHTML =
          '<span class="dl-wd"></span>' +
          '<span class="dl-date"></span>' +
          '<img alt="" src="assets/icons/' + icon + '.svg">' +
          '<span class="dl-rw"></span>';

        cell.querySelector('.dl-wd').textContent = L('dl.week.' + DAYS[i], DAYS[i]);
        cell.querySelector('.dl-date').textContent = cellDateStr;
        cell.querySelector('.dl-rw').textContent = r ? rewardTextOf(r) : '???';

        /* Catchup button for past unclaimed days */
        if (isPast) {
          /* 作弊开启时补签免费 */
          var isCheat = (typeof Game !== 'undefined') && Game.cheat();
          var buyBtn = document.createElement('button');
          buyBtn.className = 'dl-buy-btn';
          if (isCheat) {
            buyBtn.textContent = '✨ ' + L('dl.free', 'Free (Cheat)');
          } else {
            buyBtn.textContent = '🪙 ' + CATCHUP_COST + 'G — ' + L('dl.buyHint', 'Claim');
          }
          buyBtn.onclick = function (e) {
            e.stopPropagation();
            if (isCheat) {
              Daily._applyReward(i);
              if (Daily.s.claimedWeek.indexOf(i) === -1) Daily.s.claimedWeek.push(i);
              Daily.save();
            } else {
              var res = Daily.catchup(i);
              if (!res.ok) {
                if (_present) { try { _present(res); } catch (er) {} }
                return;
              }
            }
            Daily.render(root);
          };
          cell.appendChild(buyBtn);
        }

        strip.appendChild(cell);
      });
      root.appendChild(strip);

      /* Reset note */
      var resetNote = document.createElement('p');
      resetNote.className = 'dl-reset-note';
      resetNote.textContent = L('dl.resetNote', 'Resets every day at 7AM');
      root.appendChild(resetNote);

      /* Next reward label */
      var goal = document.createElement('p');
      goal.className = 'dl-goal';
      goal.textContent = L('dl.nextRandom', 'Today\'s reward is a surprise!');
      root.appendChild(goal);

      /* Claim button */
      var btn = document.createElement('button');
      btn.className = 'btn primary';
      btn.textContent = Daily.available() ? L('dl.cta', 'Claim today') : L('dl.done', 'Already claimed');
      btn.disabled = !Daily.available();
      btn.onclick = function () {
        var res = Daily.claim();
        if (_present) { try { _present(res); } catch (e) {} }
        if (!res.ok) return;
        Daily.render(root);
      };
      root.appendChild(btn);
    },

    POOL: POOL,
    DAYS: DAYS,
    CATCHUP_COST: CATCHUP_COST
  };

  global.Daily = Daily;
})(window);
