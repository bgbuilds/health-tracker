/* Health Tracker - vanilla JS renderer. No dependencies. */
(function () {
  "use strict";

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmtUpdated(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleString("en-US", {
        month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit"
      });
    } catch (e) { return iso; }
  }

  function fmtMin(min) {
    var h = Math.floor(min / 60), m = Math.round(min % 60);
    return h > 0 ? h + "h " + m + "m" : m + "m";
  }

  function ring(pct, big, small) {
    var r = 40, c = 2 * Math.PI * r;
    var off = c * (1 - Math.min(1, Math.max(0, pct)));
    return (
      '<div class="ring">' +
      '<svg width="96" height="96" viewBox="0 0 96 96">' +
      '<circle cx="48" cy="48" r="' + r + '" fill="none" stroke="#ece5d5" stroke-width="10"/>' +
      '<circle cx="48" cy="48" r="' + r + '" fill="none" stroke="#d97706" stroke-width="10" ' +
      'stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>' +
      "</svg>" +
      '<div class="center"><div class="big">' + esc(big) + '</div>' +
      (small ? '<div class="small">' + esc(small) + "</div>" : "") + "</div></div>"
    );
  }

  function render(meals, health, stale) {
    /* Header */
    var upd = meals.updated || health.updated || "";
    document.getElementById("updated").textContent =
      upd ? "Last updated: " + fmtUpdated(upd) : "";
    if (stale) document.getElementById("stale-note").classList.add("show");

    /* Summary: Day / Week toggle */
    var day = meals.day, goal = meals.proteinGoal || 160;
    var pPct = day.protein / goal;
    document.getElementById("panel-day").innerHTML =
      '<div class="stat-row">' +
      '<div class="stat"><div class="num">' + day.calories.toLocaleString() + '</div><div class="lbl">calories today</div></div>' +
      '<div class="stat"><div class="num">' + day.protein + "g</div>" +
      '<div class="lbl">protein / ' + goal + "g goal</div></div>" +
      "</div>" +
      '<div class="bar"><div style="width:' + Math.min(100, pPct * 100).toFixed(1) + '%"></div></div>' +
      '<div class="protein-line"><span class="big">' + day.protein + "g</span>" +
      '<span class="small">' + Math.max(0, goal - day.protein) + "g to go</span></div>";

    var wk = meals.week, wPct = wk.plants / wk.plantGoal;
    document.getElementById("panel-week").innerHTML =
      '<div class="ring-wrap">' +
      ring(wPct, wk.plants + " / " + wk.plantGoal, "plants") +
      '<div><div style="font-weight:800;font-size:16px">Plant diversity</div>' +
      '<div style="font-size:13px;color:#6b6257;margin-top:4px">' +
      (wk.plantGoal - wk.plants) + " more plants to hit this week's goal of " + wk.plantGoal + ".</div></div>" +
      "</div>";

    var tDay = document.getElementById("tab-day"),
        tWeek = document.getElementById("tab-week");
    function show(which) {
      var isDay = which === "day";
      tDay.classList.toggle("active", isDay);
      tWeek.classList.toggle("active", !isDay);
      document.getElementById("panel-day").style.display = isDay ? "" : "none";
      document.getElementById("panel-week").style.display = isDay ? "none" : "";
    }
    tDay.onclick = function () { show("day"); };
    tWeek.onclick = function () { show("week"); };

    /* Food log */
    document.getElementById("meals").innerHTML = day.meals.map(function (m) {
      var items = m.items.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("");
      var flags = (m.flags || []).map(function (f) {
        return '<span class="flag">' + esc(f) + "</span>";
      }).join("");
      return (
        '<div class="meal"><div class="meal-head">' +
        '<span class="name">' + esc(m.name) + "</span>" +
        '<span class="macros">~' + m.calories + " cal · ~" + m.protein + "g protein</span>" +
        "</div><ul>" + items + "</ul>" +
        (flags ? '<div class="flags">' + flags + "</div>" : "") +
        "</div>"
      );
    }).join("");

    /* Plants */
    document.getElementById("plant-summary").innerHTML =
      '<div class="ring-wrap">' +
      ring(wPct, wk.plants + " / " + wk.plantGoal, "this week") +
      '<div style="font-size:14px">Distinct plants logged this week. Each counts once.</div>' +
      "</div>";
    document.getElementById("plant-chips").innerHTML =
      wk.plantList.map(function (p) { return '<span class="chip">' + esc(p) + "</span>"; }).join("");

    /* Activity */
    document.getElementById("activity-stats").innerHTML =
      '<div class="stat"><div class="num">' + health.steps.toLocaleString() + '</div><div class="lbl">steps</div></div>' +
      '<div class="stat"><div class="num">' + health.activeKcal + '</div><div class="lbl">active kcal</div></div>' +
      '<div class="stat"><div class="num">' + health.distanceKm + '</div><div class="lbl">km</div></div>';

    /* Sleep */
    var s = health.sleep;
    document.getElementById("sleep-main").innerHTML =
      '<div class="protein-line" style="margin-top:0"><span class="big">' +
      esc(s.bedtime) + " → " + esc(s.wake) + "</span>" +
      '<span class="small">' + s.asleepHrs.toFixed(1) + "h asleep</span></div>" +
      (s.note ? '<div style="font-size:13px;color:#6b6257;margin-top:6px">' + esc(s.note) + "</div>" : "");
    document.getElementById("sleep-grid").innerHTML =
      '<div class="stat"><div class="num">' + fmtMin(s.deepMin) + '</div><div class="lbl">deep sleep</div></div>' +
      '<div class="stat"><div class="num">' + fmtMin(s.remMin) + '</div><div class="lbl">REM sleep</div></div>' +
      '<div class="stat"><div class="num">' + s.efficiency + '%</div><div class="lbl">efficiency</div></div>' +
      '<div class="stat"><div class="num">' + s.asleepHrs.toFixed(1) + "h</div>" +
      '<div class="lbl">total asleep</div></div>';

    /* Nutrients */
    document.getElementById("nutri-grid").innerHTML =
      meals.nutrients.map(function (n) {
        return '<div class="nutri"><div class="n">' + esc(n.name) + "</div>" +
          '<div class="p">' + esc(n.pct) + ' <span style="font-size:11px;font-weight:400">DV</span></div>' +
          '<div class="t">' + esc(n.note) + "</div></div>";
      }).join("");
  }

  function errorState() {
    document.getElementById("updated").textContent = "";
    document.getElementById("stale-note").classList.add("show");
    ["panel-day", "meals", "plant-summary", "activity-stats", "sleep-main", "nutri-grid"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = '<p style="font-size:14px;color:#6b6257">Data unavailable right now.</p>';
    });
  }

  function load() {
    Promise.all([
      fetch("./meals.json", { cache: "no-store" }).then(function (r) { if (!r.ok) throw 0; return r.json(); }),
      fetch("./health.json", { cache: "no-store" }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
    ]).then(function (res) {
      render(res[0], res[1], false);
    }).catch(function () {
      if (typeof FALLBACK_MEALS !== "undefined" && typeof FALLBACK_HEALTH !== "undefined") {
        render(FALLBACK_MEALS, FALLBACK_HEALTH, true);
      } else {
        errorState();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
