/* Daily login — rewritten.
   KEY CHANGES vs original:
   - Game-day boundary: 7:00 AM  (before 7 AM = still yesterday's game day)
   - 7-day weekly strip aligned to real Mon–Sun calendar week
   - Week resets every Monday at 07:00 — claimedWeek clears, streak continues
   - Past unclaimed days in the current week can be bought (CATCHUP_COST G)
   - New user starting mid-week: goes straight to today; past days are buyable
   - Future days are locked (greyed)
   - Claimed days show a checkmark
   - Reward texts driven through i18n (dl.rw.1 … dl.rw.7)
*/
(function (global) {
  'use strict';

  var KEY          = 'ryza.daily.v2';
  var CATCHUP_COST = 30;          /* G per missed day bought retroactively */
  var RESET_HOUR   = 7;           /* new game-day starts at 07:00 */

  var DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  /* Rewards identical to original; texts are i18n'd via dl.rw.N */
  var REWARDS = [
    { day: 1, kind: 'stamina', amount: 'full',  text: 'Stamina refill'         },
    { day: 2, kind: 'money',   amount: 120,      text: '120G'                   },
    { day: 3, kind: 'item',    id: 'wasser', n: 3, text: 'Distilled Water ×3'  },
    { day: 4, kind: 'exp',     amount: 60,       text: 'EXP +60'               },
    { day: 5, kind: 'big',     money: 300, exp: 100, text: '300G + EXP +100 + refill' },
    { day: 6, kind: 'item',    id: 'apple', n: 1, text: 'Stamina Apple ×1'    },
    { day: 7, kind: 'chest',   money: 500, item: 'relic', text: 'Chest: 500G + Ancient Relic' }
  ];

  /* ── helpers ────────────────────────────────────────────────────── */

  function L(key, fb)  { return (window.I18n && I18n.tc) ? I18n.tc(key, fb) : fb; }
  function rewardText(i) { return L('dl.rw.' + (i + 1), REWARDS[i].text); }

  /** local date string "YYYY-M-D" for a Date object */
  function dateStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  /** The "game date" shifts at RESET_HOUR each day */
  function gameNow() {
    var d = new Date();
    if (d.getHours() < RESET_HOUR) {
      /* Before reset hour → still yesterday's game day */
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12, 0, 0);
    }
    return d;
  }
  function gameTodayStr() { return dateStr(gameNow()); }

  /** 0 = Monday … 6 = Sunday (ISO weekday index of game-today) */
  function gameDow() {
    var day = gameNow().getDay(); /* JS: 0=Sun */
    return (day + 6) % 7;
  }

  /** Date string of the Monday that starts the current game week */
  function gameWeekStartStr() {
    var now = gameNow();
    var dow = (now.getDay() + 6) % 7;          /* 0=Mon */
    var mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow, 12, 0, 0);
    return dateStr(mon);
  }

  /* ── persistent state ───────────────────────────────────────────── */

  var _celebrate = null;
  var _present   = null;

  /* Days since first launch (kept for welcome_start_day compatibility) */
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

  /* ── Daily object ────────────────────────────────────────────────── */

  var Daily = {
    dayIndex:     dayIndex,
    setCelebrate: function (fn) { _celebrate = typeof fn === 'function' ? fn : null; },
    setPresenter: function (fn) { _present   = typeof fn === 'function' ? fn : null; },

    s: null,

    load: function () {
      var raw = null;
      try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
      Daily.s = Object.assign(
        { weekStart: '', claimedWeek: [], streak: 0, lastClaim: '' },
        raw || {}
      );

      /* ── weekly reset ─────────────────────────────────────────── */
      var currentWeekStart = gameWeekStartStr();
      if (Daily.s.weekStart !== currentWeekStart) {
        Daily.s.weekStart    = currentWeekStart;
        Daily.s.claimedWeek  = [];
        /* streak only breaks if last claim wasn't yesterday */
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
      try { localStorage.setItem(KEY, JSON.stringify(Daily.s)); } catch (e) {}
    },

    /** True if today's reward is still unclaimed */
    available: function () {
      return Daily.s.claimedWeek.indexOf(gameDow()) === -1;
    },
    /** True if a past day in this week can be bought */
    canCatchup: function (dowIdx) {
      return dowIdx < gameDow() && Daily.s.claimedWeek.indexOf(dowIdx) === -1;
    },

    streak:     function () { return Daily.s.streak | 0; },
    weekDayIdx: function () { return gameDow(); },

    rewardFor: function (idx) { return REWARDS[Util.clamp(idx, 0, 6)]; },

    /* ── apply reward helper ──────────────────────────────────────── */
    _applyReward: function (idx) {
      var r = Daily.rewardFor(idx);
      var msgs = [];
      switch (r.kind) {
        case 'stamina': Game.refill(); msgs.push(rewardText(0)); break;
        case 'money':   Game.addMoney(r.amount); msgs.push(rewardText(1)); break;
        case 'exp':     Game.addExp(r.amount);   msgs.push(rewardText(3)); break;
        case 'item':
          Game.addItem('you', r.id, r.n || 1);
          msgs.push(Game.itemName(r.id) + '×' + (r.n || 1));
          break;
        case 'big':
          Game.addMoney(r.money); Game.addExp(r.exp); Game.refill();
          msgs.push(rewardText(4)); break;
        case 'chest':
          Game.addMoney(r.money); Game.addItem('you', r.item, 1);
          msgs.push(rewardText(6)); break;
      }
      return msgs;
    },

    /* ── free daily claim (today) ──────────────────────────────── */
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

    /* ── paid catchup (past unclaimed day this week) ──────────── */
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

    /* ── render ────────────────────────────────────────────────── */
    render: function (root) {
      if (!root) return;
      root.innerHTML = '';
      Daily.load();

      /* Header */
      var head = document.createElement('div');
      head.className = 'dl-head';
      head.innerHTML = '<h3></h3><p class="dl-sub"></p><p class="dl-prog"></p>';
      head.querySelector('h3').textContent        = L('dl.title', 'Daily login');
      head.querySelector('.dl-sub').textContent   = L('dl.subtitle', 'Come say hi every day; streaks pay out.');
      head.querySelector('.dl-prog').textContent  =
        L('dl.progress', 'Streak: {n} days').replace('{n}', String(Daily.streak()));
      root.appendChild(head);

      /* 7-day strip — aligned to real Mon–Sun week */
      var strip = document.createElement('div');
      strip.className = 'dl-strip';
      var todayDow = gameDow();

      /* Calculate the actual calendar date for each weekday cell */
      var weekMonday = gameWeekStartStr().split('-');
      var monDate = new Date(
        parseInt(weekMonday[0]), parseInt(weekMonday[1]) - 1, parseInt(weekMonday[2]), 12, 0, 0
      );

      REWARDS.forEach(function (r, i) {
        /* Actual calendar date for this weekday slot */
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

        var icon = claimed ? 'check'
                 : (r.kind === 'chest' || r.kind === 'big') ? 'present'
                 : 'stamina_apple_filled';

        cell.innerHTML =
          '<span class="dl-wd"></span>' +
          '<span class="dl-date"></span>' +
          '<img alt="" src="assets/icons/' + icon + '.svg">' +
          '<span class="dl-rw"></span>';

        cell.querySelector('.dl-wd').textContent   = L('dl.week.' + DAYS[i], DAYS[i]);
        cell.querySelector('.dl-date').textContent = cellDateStr;
        cell.querySelector('.dl-rw').textContent   = rewardText(i);

        /* Catchup button for past unclaimed days */
        if (isPast) {
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
              /* Cheat mode: bypass cost, apply reward directly */
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
      resetNote.textContent = L('dl.resetNote', 'Resets every Monday at 07:00 · Past days: ' + CATCHUP_COST + 'G each');
      root.appendChild(resetNote);

      /* Next reward label */
      var goal = document.createElement('p');
      goal.className = 'dl-goal';
      var nextIdx = Util.clamp(todayDow, 0, 6);
      goal.textContent = L('dl.next', 'Next: {r}').replace('{r}', rewardText(nextIdx));
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

    REWARDS: REWARDS,
    DAYS: DAYS,
    CATCHUP_COST: CATCHUP_COST
  };

  global.Daily = Daily;
})(window);
