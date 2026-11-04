/* Desk PWA — Plan B: polls static JSON under d/{DATA_PATH}/ every 15s. No secrets in this file. */
(function () {
  "use strict";
  var POLL_MS = 15000, STALE_S = 90;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };
  var usd = function (v, sign) { if (v == null || isNaN(v)) return "—"; var s = Math.abs(v).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }); return (v < 0 ? "−" : sign ? "+" : "") + s; };
  var pct = function (v) { return v == null ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2) + "%"; };
  var cls = function (v) { return v > 0 ? "pos" : v < 0 ? "neg" : ""; };
  var px = function (v) { return v == null ? "—" : "$" + Number(v).toPrecision(4); };
  var ago = function (iso) { if (!iso) return ""; var s = (Date.now() - Date.parse(iso)) / 1000; return s < 60 ? Math.round(s) + "s" : s < 3600 ? Math.round(s / 60) + "m" : s < 86400 ? Math.round(s / 3600) + "h" : Math.round(s / 86400) + "d"; };
  var tm = function (iso) { return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""; };
  // FOMO URLs come only from publisher JSON (built by links.py); refuse anything else.
  var fomo = function (u) { return typeof u === "string" && u.indexOf("https://fomo.family/") === 0 && u.indexOf("r=savipww") > 0 ? u : null; };

  // --- private link: #d=DATA_PATH&t=APP_TOKEN → localStorage, then scrub from the URL bar
  var h = new URLSearchParams(location.hash.slice(1));
  if (h.get("d")) {
    localStorage.setItem("desk_d", h.get("d"));
    if (h.get("t")) localStorage.setItem("desk_t", h.get("t"));
    history.replaceState(null, "", location.pathname + location.search);
  }
  var D = localStorage.getItem("desk_d");
  if (!D) { $("setup").classList.remove("hidden"); return; }
  var base = "d/" + encodeURIComponent(D) + "/";

  function get(path) {
    return fetch(base + path + "?_=" + Date.now(), { cache: "no-store", referrerPolicy: "no-referrer" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }

  // --- tabs
  document.querySelectorAll("#tabs button").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll("#tabs button").forEach(function (x) { x.classList.toggle("active", x === b); });
      document.querySelectorAll(".tab").forEach(function (t) { t.classList.toggle("active", t.id === "tab-" + b.dataset.tab); });
      var names = { desk: "Desk", activity: "Activity", coins: "Coins", account: "Account" };
      $("title").textContent = names[b.dataset.tab];
      window.scrollTo(0, 0);
    });
  });

  var state = null, chart = null;

  function posItem(p, closed) {
    var v = p.pnl_usd;
    return '<div class="item" data-mint="' + esc(p.mint) + '"><div class="main"><div class="t">' + esc(p.symbol || p.mint.slice(0, 6)) +
      ' <small class="s">' + esc(p.mode) + '</small></div><div class="s">' +
      (closed ? esc(p.exit_reason || "") + " · " + tm(p.closed_at) : usd(p.size_usd) + " @ " + px(p.entry_price) + " · " + ago(p.opened_at)) +
      '</div></div><div class="r"><div class="' + cls(v) + '">' + usd(v, true) + '</div><div class="s ' + cls(v) + '">' + pct(p.pnl_pct) + "</div></div></div>";
  }

  function renderState(s) {
    state = s;
    var m = $("mode");
    m.textContent = s.mode + (s.paused ? " · PAUSED" : "");
    m.className = "pill " + (s.paused ? "paused" : s.mode === "LIVE" ? "live" : "paper");
    var b = s.balance;
    $("equity").textContent = usd(b.equity_usd);
    $("pnl").innerHTML = '<span class="' + cls(b.pnl_pct) + '">' + usd(b.equity_usd - b.start_usd, true) + " (" + pct(b.pnl_pct) + ')</span> <span class="s" style="color:#8e8e93">all time</span>';
    $("cash").textContent = usd(b.cash_usd);
    $("today").innerHTML = '<span class="' + cls(b.realized_today_usd) + '">' + usd(b.realized_today_usd, true) + "</span>";
    $("openc").textContent = s.positions.length + "/" + s.settings.max_open_positions;
    $("positions").innerHTML = s.positions.map(function (p) { return posItem(p, false); }).join("");
    $("closed").innerHTML = s.closed.map(function (p) { return posItem(p, true); }).join("");
    var pl = s.pipeline_24h;
    $("pipeline").innerHTML = [["Seen", pl.candidates], ["Gate ✓", pl.audit_pass], ["Gate ✗", pl.audit_fail], ["BUY", pl.signals_buy], ["Trades", pl.trades], ["W/L", pl.wins + "/" + pl.losses]]
      .map(function (x) { return '<div class="stat"><div class="label">' + x[0] + "</div><div>" + esc(x[1]) + "</div></div>"; }).join("");
    $("coins").innerHTML = s.coins.map(function (c) {
      return '<div class="item" data-mint="' + esc(c.mint) + '"><div class="main"><div class="t">' + esc(c.symbol || c.mint.slice(0, 6)) +
        '</div><div class="s">' + esc(c.name || "") + " · " + ago(c.first_seen) + '</div></div><div class="r"><div>' + px(c.last_price) + '</div><div class="s">' + esc(c.status) + "</div></div></div>";
    }).join("");
    var pr = fomo(s.links.profile), su = fomo(s.links.signup);
    if (pr) $("profile").href = pr; if (su) $("signup").href = su;
    $("agents").innerHTML = Object.keys(s.agents).sort().map(function (k) {
      var a = s.agents[k], ok = a.status === "ok";
      return '<div class="row"><div>' + esc(k) + '</div><span style="color:' + (ok ? "#30d158" : a.status === "degraded" ? "#ff9f0a" : "#ff453a") + '">' + esc(a.status) + " · " + esc(a.age_s) + "s</span></div>";
    }).join("");
    $("settings").innerHTML = Object.keys(s.settings).map(function (k) {
      return '<div class="row"><div>' + esc(k) + "</div><span>" + esc(s.settings[k]) + "</span></div>";
    }).join("");
    $("blockers").innerHTML = (s.blockers || []).map(function (x) { return '<div class="blocker">⛔ ' + esc(x.text) + "</div>"; }).join("");
    $("updated").textContent = new Date(s.generated_at).toLocaleString();
    $("stale").classList.toggle("hidden", (Date.now() - Date.parse(s.generated_at)) / 1000 < STALE_S);
  }

  function renderChart(c) {
    chart = c;
    var pts = (c.points || []).map(function (p) { return [p[0], p[1]]; });
    DeskChart.drawLine($("chart"), pts, { base: state ? state.balance.start_usd : null });
  }

  function renderActivity(a) {
    $("activity").innerHTML = a.events.map(function (e) {
      return '<div class="item"' + (e.mint ? ' data-mint="' + esc(e.mint) + '"' : "") + '><span class="dot ' + esc(e.level) + '"></span><div class="main"><div class="t" style="font-weight:500;white-space:normal">' +
        esc(e.message) + '</div><div class="s">' + esc(e.agent) + " · " + esc(e.kind) + " · " + tm(e.ts) + "</div></div></div>";
    }).join("");
  }

  function openCoin(mint) {
    $("sheet-body").innerHTML = '<p class="foot">Loading…</p>';
    $("sheet").classList.remove("hidden");
    get("coin/" + encodeURIComponent(mint) + ".json").then(function (c) {
      var u = fomo(c.fomo_url), a = c.audit, d = c.dex || {};
      var html = '<h2 style="margin-top:8px">' + esc(c.symbol || "") + ' <small>' + esc(c.name || "") + "</small></h2>" +
        '<div class="hero"><div class="big" style="font-size:34px">' + px(c.last_price) + '</div><div class="s">' +
        "Liq " + usd(d.liquidity_usd) + " · MC " + usd(d.marketCap) + "</div></div>" +
        '<div class="card chart-card"><canvas id="coin-chart" height="140"></canvas></div>';
      if (u) html += '<div class="btns"><a class="btn buy" href="' + esc(u) + '" target="_blank" rel="noopener">Buy on FOMO</a><a class="btn sell" href="' + esc(u) + '" target="_blank" rel="noopener">Sell on FOMO</a></div>';
      if (a) {
        html += "<h2>Gate " + (a.passed ? '<span class="pos">PASS</span>' : '<span class="neg">FAIL</span>') + "</h2><div class=card>" +
          a.layers.map(function (l) { return '<div class="layer"><span>L' + l.layer + " " + esc(l.name) + '</span><span class="' + (l.ok ? "pos" : "neg") + '">' + (l.ok ? "✓ " : "✗ ") + esc(typeof l.value === "object" ? JSON.stringify(l.value) : l.value) + "</span></div>"; }).join("") + "</div>";
      }
      if (c.signals.length) html += "<h2>Signals</h2><div class=card>" + c.signals.map(function (s) { return '<div class="layer"><span>' + esc(s.decision) + " " + esc(s.score) + '</span><span class="s">' + esc(s.reasons.slice(0, 3).join(", ")) + "</span></div>"; }).join("") + "</div>";
      if (c.trades.length) html += "<h2>Trades</h2><div class=card>" + c.trades.map(function (t) { return '<div class="layer"><span>' + esc(t.mode) + " " + esc(t.side) + " " + usd(t.size_usd) + '</span><span class="s">' + px(t.price_usd) + " · " + tm(t.ts) + "</span></div>"; }).join("") + "</div>";
      html += '<p class="foot" style="word-break:break-all">' + esc(c.mint) + "</p>";
      $("sheet-body").innerHTML = html;
      DeskChart.drawLine($("coin-chart"), c.prices || []);
    }).catch(function () { $("sheet-body").innerHTML = '<p class="foot">No detail published for this coin yet.</p>'; });
  }

  document.addEventListener("click", function (e) {
    var it = e.target.closest && e.target.closest("[data-mint]");
    if (it) openCoin(it.dataset.mint);
  });
  $("sheet-close").addEventListener("click", function () { $("sheet").classList.add("hidden"); });
  $("sheet").addEventListener("click", function (e) { if (e.target === $("sheet")) $("sheet").classList.add("hidden"); });
  window.addEventListener("resize", function () { if (chart) renderChart(chart); });

  function tick() {
    get("state.json").then(function (s) {
      renderState(s);
      return Promise.all([get("chart.json").then(renderChart), get("activity.json").then(renderActivity)]);
    }).catch(function () { $("stale").textContent = "Offline — retrying"; $("stale").classList.remove("hidden"); });
  }
  tick();
  setInterval(function () { if (!document.hidden) tick(); }, POLL_MS);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) tick(); });

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
})();
