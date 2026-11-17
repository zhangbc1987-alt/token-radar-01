// Token Radar dashboard. Reads window.RADAR (data.js, written by main.ts
// from the same board as board.json) and renders the ranked board, filters
// and a per-protocol detail view. No network: every byte shown is local.
// Deep links: #/protocol/<slug> opens a detail view; #/filter/<tab> and
// #/filter/<tab>/<category> open a filtered board, so screenshots can target views.
(function () {
  'use strict';
  var DATA = window.RADAR;
  var main = document.getElementById('rows');
  if (!DATA || !main) return;

  var state = { tab: 'all', q: '', cat: 'all', chain: 'all', sort: 'rank', dir: 1, sel: null };
  var rows = DATA.rows, live = DATA.live, flagged = DATA.flagged || [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    if (n == null || !isFinite(n)) return 'n/a';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n) {
    if (n == null || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function age(d) {
    if (d == null) return 'unknown';
    if (d >= 365) return (d / 365).toFixed(1) + 'y';
    return d + 'd';
  }
  function tierLabel(t) {
    return t === 'watchlist' ? 'Watchlist' : t === 'early' ? 'Early' : 'Flagged';
  }

  // Header stats.
  var top = rows[0];
  document.getElementById('stats').innerHTML =
    '<div><dt>Snapshot</dt><dd>' + esc(DATA.as_of) + '</dd></div>' +
    '<div><dt>Board</dt><dd>' + rows.length + ' pre-token rows</dd></div>' +
    '<div><dt>Watchlist</dt><dd>' + DATA.watchlist_size + ' (floor $50M)</dd></div>' +
    '<div><dt>Early finds</dt><dd>' + DATA.early_size + '</dd></div>' +
    '<div><dt>Flagged (unranked)</dt><dd>' + DATA.flagged_size + '</dd></div>' +
    '<div><dt>Top implied value</dt><dd>' + esc(top ? top.name : '—') + ' ' + money(top ? top.implied_value_usd : 0) + '</dd></div>';

  // Filter selects.
  function fillSelect(id, values) {
    var el = document.getElementById(id);
    values.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v; o.textContent = v; el.appendChild(o);
    });
  }
  // Filter selects: built from every list the page shows, so a category or
  // chain that only exists on the Flagged or Live tab is still offered there.
  var allRows = rows.concat(flagged, live);
  var allCats = Array.from(new Set(allRows.map(function (r) { return r.category || 'Uncategorised'; }))).sort();
  var allChains = Array.from(new Set(allRows.flatMap(function (r) { return r.chains; }))).sort();
  fillSelect('cat', allCats);
  fillSelect('chain', allChains);

  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    // Flagged rows are unranked by design: listed by TVL, never by implied value.
    // They still honour the column sort: rank, implied value and age have no
    // meaning unranked, so those keys fall back to TVL.
    if (state.tab === 'flagged') {
      var f = flagged.filter(function (r) {
        if (state.cat !== 'all' && (r.category || 'Uncategorised') !== state.cat) return false;
        if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
        if (q && (r.name + ' ' + r.slug).toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
      var fk = state.sort, fd = state.dir;
      var fval = function (r) {
        if (fk === 'name') return r.name.toLowerCase();
        if (fk === 'category') return (r.category || '').toLowerCase();
        if (fk === 'chains') return (r.chains[0] || '').toLowerCase();
        if (fk === 'change_7d') return r.change_7d == null ? -9999 : r.change_7d;
        return r.tvl_usd;
      };
      return f.slice().sort(function (a, b) {
        var va = fval(a), vb = fval(b);
        return (va < vb ? -1 : va > vb ? 1 : (a.slug < b.slug ? -1 : 1)) * fd;
      });
    }
    var list = state.tab === 'live' ? live : rows.filter(function (r) {
      if (state.tab === 'watchlist' && r.tier !== 'watchlist') return false;
      if (state.tab === 'early' && r.tier !== 'early') return false;
      if (state.cat !== 'all' && (r.category || 'Uncategorised') !== state.cat) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (q && (r.name + ' ' + r.slug).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = state.sort, dir = state.dir;
    var val = function (r) {
      if (key === 'name') return r.name.toLowerCase();
      if (key === 'category') return (r.category || '').toLowerCase();
      if (key === 'chains') return (r.chains[0] || '').toLowerCase();
      if (key === 'age_days') return r.age_days == null ? -1 : r.age_days;
      if (key === 'change_7d') return r.change_7d == null ? -9999 : r.change_7d;
      if (key === 'implied_value_usd' && state.tab === 'live') return r.mcap_usd || 0;
      return r[key] == null ? 0 : r[key];
    };
    return list.slice().sort(function (a, b) {
      var va = val(a), vb = val(b);
      return (va < vb ? -1 : va > vb ? 1 : (a.slug < b.slug ? -1 : 1)) * dir;
    });
  }

  function render() {
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tab === state.tab);
    });
    // On the Flagged tab rank, implied value and age sort by TVL instead,
    // so the highlight follows the key that actually sorts.
    var hl = state.tab === 'flagged' && (state.sort === 'rank' || state.sort === 'implied_value_usd' || state.sort === 'age_days') ? 'tvl_usd' : state.sort;
    document.querySelectorAll('#board th').forEach(function (th) {
      th.classList.toggle('sorted', th.dataset.sort === hl);
    });
    var list = visibleRows();
    var total = state.tab === 'live' ? live.length + ' live tokens' : state.tab === 'flagged' ? flagged.length + ' flagged (unranked)' : rows.length + ' rows';
    document.getElementById('count').textContent = list.length + ' of ' + total;
    if (!list.length) {
      main.innerHTML = '<tr><td colspan="8"><div class="empty">Nothing matches this filter. Clear the search or pick another category.</div></td></tr>';
      return;
    }
    main.innerHTML = list.map(function (r) {
      var isLive = state.tab === 'live';
      var isFlag = state.tab === 'flagged';
      var val = isLive ? r.mcap_usd : r.implied_value_usd;
      var chg = r.change_7d;
      var cls = chg == null ? '' : chg >= 0 ? 'up' : 'down';
      var pill = isLive
        ? '<span class="pill live">Live</span>'
        : isFlag
          ? '<span class="pill flagged">Flagged</span>'
          : '<span class="pill ' + r.tier + '">' + tierLabel(r.tier) + '</span>';
      var sub = isLive ? 'mcap ' + money(r.mcap_usd) : isFlag ? 'not ranked · ' + pill : 'rank #' + r.rank + ' · ' + pill;
      return '<tr data-slug="' + esc(r.slug) + '" class="' + (state.sel === r.slug ? 'sel' : '') + '">' +
        '<td class="num">' + (isLive || isFlag ? '—' : r.rank) + '</td>' +
        '<td class="name"><b>' + esc(r.name) + '</b><span>' + esc(r.slug) + ' · ' + sub + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc(r.chains.slice(0, 2).join(', ') || '—') + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num ' + cls + '">' + pct(chg) + '</td>' +
        '<td class="num">' + (isLive || isFlag ? '—' : age(r.age_days)) + '</td>' +
        '<td class="num"><b>' + (isFlag ? 'not ranked' : money(val)) + '</b></td></tr>';
    }).join('');
  }

  // Where the peer multiple comes from: the category median only when the
  // category has at least 3 token-bearing peers; otherwise the whole-market
  // median (the model shrinks toward it, so the label names the source).
  function peerLabel(b) {
    var n = b.peer_count == null ? 0 : b.peer_count;
    var cat = b.category || 'market';
    if (n >= 3) return esc(cat) + ' median mcap/TVL (' + n + ' peers)';
    return 'market median mcap/TVL (' + n + ' peers in ' + esc(cat) + ')';
  }

  function detail(slug) {
    var box = document.getElementById('detail');
    var r = rows.find(function (x) { return x.slug === slug; });
    var lv = !r && live.find(function (x) { return x.slug === slug; });
    var fg = !r && !lv && flagged.find(function (x) { return x.slug === slug; });
    if (!r && !lv && !fg) {
      box.innerHTML = '<h2>Pick a protocol</h2><p class="meta">Click any row to see its implied value, the model breakdown and its farm plan. Deep link: #/protocol/&lt;slug&gt;.</p>';
      return;
    }
    if (fg) {
      box.innerHTML = '<h2>' + esc(fg.name) + '</h2><p class="meta">' + esc(fg.slug) + ' · ' + esc(fg.category || 'Uncategorised') + ' · ' + esc(fg.chains.join(', ')) + ' · <span class="pill flagged">Flagged</span></p>' +
        '<div class="flagbox"><b>Flagged — not ranked:</b> ' + esc(fg.flag_reason) + ' Farm it for yield, not for a new token.</div>' +
        '<p class="meta">TVL ' + money(fg.tvl_usd) + ' · 7d ' + pct(fg.change_7d) + '. Flagged protocols are listed apart so the board never ranks a launch that already happened elsewhere.</p>';
      return;
    }
    if (lv) {
      box.innerHTML = '<h2>' + esc(lv.name) + '</h2><p class="meta">' + esc(lv.slug) + ' · ' + esc(lv.category || 'Uncategorised') + ' · ' + esc(lv.chains.join(', ')) + '</p>' +
        '<div class="big">' + money(lv.mcap_usd) + ' <small>market cap — this token already trades</small></div>' +
        '<p class="meta">TVL ' + money(lv.tvl_usd) + ' · 7d ' + pct(lv.change_7d) + '. Live tokens are shown apart, at the market\u2019s own value; they are never ranked on this board.</p>';
      return;
    }
    var b = r;
    var steps = b.farm_steps.map(function (s, i) {
      var m = s.match(/^(.*?)\s*Cost:\s*(.*?)\s*Time:\s*(.*?)\s*$/);
      if (!m) return '<li>' + esc(s) + '</li>';
      var cost = m[2].replace(/\.$/, ''), time = m[3].replace(/\.$/, '');
      return '<li><b>Step ' + (i + 1) + '.</b> ' + esc(m[1]) + ' <b>Cost:</b> ' + esc(cost) + '. <b>Time:</b> ' + esc(time) + '.</li>';
    }).join('');
    box.innerHTML = '<h2>' + esc(b.name) + '</h2>' +
      '<p class="meta">' + esc(b.slug) + ' · ' + esc(b.category || 'Uncategorised') + ' · ' + esc(b.chains.join(', ') || '—') +
      ' · <span class="pill ' + b.tier + '">' + tierLabel(b.tier) + '</span> · rank #' + b.rank + '</p>' +
      '<div class="big">' + money(b.implied_value_usd) + ' <small>implied value</small></div>' +
      '<table class="breakdown">' +
      '<tr><td>TVL</td><td>' + money(b.tvl_usd) + '</td></tr>' +
      '<tr><td>Peer multiple (' + peerLabel(b) + ')</td><td>×' + b.peer_multiple.toFixed(2) + '</td></tr>' +
      '<tr><td>Growth (7d ' + pct(b.change_7d) + ')</td><td>×' + b.growth_multiplier.toFixed(2) + '</td></tr>' +
      '<tr><td>Maturity (' + age(b.age_days) + ' with no token)</td><td>×' + b.maturity_multiplier.toFixed(2) + '</td></tr>' +
      '<tr><td>Chains (' + b.chains.length + ')</td><td>×' + b.chain_multiplier.toFixed(2) + '</td></tr></table>' +
      '<p class="meta">Listed ' + esc(b.listed_at || 'unknown') + ' · snapshot ' + esc(DATA.as_of) + '. “Records no token” is the record, not proof a token does not exist.</p>' +
      '<h3>Farm plan — 6 steps</h3><ol>' + steps + '</ol>';
  }

  function applyHash() {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/').map(decodeURIComponent);
    if (parts[0] === 'protocol' && parts[1]) {
      state.sel = parts[1];
      render(); detail(state.sel);
      return;
    }
    if (parts[0] === 'filter' && parts[1]) {
      state.tab = ['all', 'watchlist', 'early', 'flagged', 'live'].indexOf(parts[1]) >= 0 ? parts[1] : 'all';
      state.sel = null;
      if (parts[2]) {
        if (allCats.indexOf(parts[2]) >= 0) { state.cat = parts[2]; document.getElementById('cat').value = parts[2]; }
        else if (allRows.some(function (r) { return r.slug === parts[2]; })) { state.sel = parts[2]; }
      }
      render(); detail(state.sel);
      return;
    }
    state.sel = null; render(); detail(null);
  }

  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      state.tab = b.dataset.tab; state.sel = null;
      history.replaceState(null, '', '#/filter/' + state.tab);
      render(); detail(null);
    });
  });
  document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
  document.getElementById('cat').addEventListener('change', function (e) { state.cat = e.target.value; render(); });
  document.getElementById('chain').addEventListener('change', function (e) { state.chain = e.target.value; render(); });
  document.querySelectorAll('#board th').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.dataset.sort;
      if (state.sort === k) state.dir = -state.dir;
      else { state.sort = k; state.dir = k === 'name' || k === 'category' || k === 'chains' ? 1 : -1; }
      render();
    });
  });
  main.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    state.sel = tr.dataset.slug;
    history.replaceState(null, '', '#/protocol/' + state.sel);
    render(); detail(state.sel);
  });
  window.addEventListener('hashchange', applyHash);
  applyHash();
})();
