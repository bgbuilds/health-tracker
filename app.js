/* Health Tracker - vanilla JS renderer. No dependencies. */
(function () {
  "use strict";

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmtUpdatedLong(iso) {
    try {
      var d = new Date(iso);
      var date = d.toLocaleString("en-US", { month: "short", day: "numeric" });
      var time = d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
      return date + " at " + time;
    } catch (e) { return iso; }
  }

  function fmtTime(iso) {
    try {
      return new Date(iso).toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
    } catch (e) { return ""; }
  }

  function fmtDurHm(totalMin) {
    totalMin = Math.round(totalMin);
    var h = Math.floor(totalMin / 60), m = totalMin % 60;
    return h > 0 ? h + "h " + m + "m" : m + "m";
  }

  function weekRange(isoDate) {
    try {
      var d = new Date(isoDate + "T12:00:00");
      var dow = (d.getDay() + 6) % 7; /* Mon = 0 */
      var mon = new Date(d); mon.setDate(d.getDate() - dow);
      var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      var mf = mon.toLocaleString("en-US", { month: "short" }) + " " + mon.getDate();
      var s = (sun.getMonth() === mon.getMonth())
        ? String(sun.getDate())
        : sun.toLocaleString("en-US", { month: "short" }) + " " + sun.getDate();
      return mf + "\u2013" + s + ", " + mon.getFullYear();
    } catch (e) { return ""; }
  }

  function ring(pct, big, small) {
    var r = 42, c = 2 * Math.PI * r;
    var off = c * (1 - Math.min(1, Math.max(0, pct)));
    return (
      '<div class="ring">' +
      '<svg width="104" height="104" viewBox="0 0 104 104">' +
      '<circle cx="52" cy="52" r="' + r + '" fill="none" stroke="#ece5d5" stroke-width="10"/>' +
      '<circle cx="52" cy="52" r="' + r + '" fill="none" stroke="#d97706" stroke-width="10" ' +
      'stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>' +
      "</svg>" +
      '<div class="center"><div class="big">' + esc(big) + "</div>" +
      (small ? '<div class="small">' + esc(small) + "</div>" : "") + "</div></div>"
    );
  }

  /* ---- derived nutrition signals (clearly approximate) ---- */
  var FERMENTED_RE = /tzatziki|yogurt|kefir|kimchi|kombucha|miso|sauerkraut|pickl/i;
  var ULTRA_RE = /simple carbs|ultra-processed|donut|soda|candy|chips|fries/i;
  var PRODUCE_RES = [
    [/cantaloupe/i, "cantaloupe"],
    [/potato/i, "potatoes"],
    [/salad/i, "lunch salad"],
    [/apple/i, "apple"],
    [/carrot/i, "carrots"],
    [/cucumber/i, "cucumber"],
    [/\bpeas?\b/i, "peas"],
    [/lettuce|greens|kale|spinach/i, "greens"],
    [/tomato/i, "tomato"],
    [/broccoli/i, "broccoli"],
    [/berr/i, "berries"],
    [/banana/i, "banana"],
    [/orange/i, "orange"],
    [/pepper/i, "peppers"]
  ];

  function fermentedInfo(meals) {
    var count = 0, example = "";
    meals.forEach(function (m) {
      var hit = (m.items || []).filter(function (i) { return FERMENTED_RE.test(i); })[0];
      if (hit) {
        count++;
        if (!example) example = hit.split("(")[0].trim() + " with " + m.name.toLowerCase();
      }
    });
    return { count: count, example: example || "none logged today" };
  }

  function ultraInfo(meals, totalCal) {
    var cal = 0;
    meals.forEach(function (m) {
      (m.flags || []).forEach(function (f) {
        var keyMatch = f.match(/\(([^)]+)\)/);
        var keys = keyMatch ? keyMatch[1].split(/[\/,]/) : [f];
        var matched = false;
        (m.items || []).forEach(function (it) {
          var low = it.toLowerCase();
          for (var k = 0; k < keys.length; k++) {
            var key = keys[k].trim().toLowerCase();
            if (key && low.indexOf(key) !== -1) {
              var cm = it.match(/~([\d,]+)\s*cal/);
              if (cm) { cal += parseInt(cm[1].replace(/,/g, ""), 10); matched = true; }
              break;
            }
          }
        });
        if (!matched && ULTRA_RE.test(f)) { cal += m.calories || 0; }
      });
    });
    var pct = totalCal > 0 ? (cal / totalCal) * 100 : 0;
    return { cal: cal, pct: pct };
  }

  function produceInfo(meals) {
    var servings = 0, names = [];
    meals.forEach(function (m) {
      (m.items || []).forEach(function (i) {
        if (/donut/i.test(i)) return; /* fruit in the donut does not count */
        for (var k = 0; k < PRODUCE_RES.length; k++) {
          if (PRODUCE_RES[k][0].test(i)) {
            servings++;
            names.push(PRODUCE_RES[k][1]);
            break;
          }
        }
      });
    });
    return { servings: servings, names: names };
  }

  function render(meals, health, stale) {
    var day = meals.day, goal = meals.proteinGoal || 160, wk = meals.week;

    /* Header */
    document.getElementById("week-range").textContent = weekRange(meals.date);
    var upd = meals.updated || health.updated || "";
    document.getElementById("updated").textContent =
      upd ? "Updated " + fmtUpdatedLong(upd) : "";
    if (stale) document.getElementById("stale-note").classList.add("show");

    /* ---- Health summary: Day panel (3 columns) ---- */
    var pPct = day.protein / goal;
    var entries = day.meals.length;
    var col1 =
      '<div class="col">' +
      '<div class="col-label"><span>Food intake \u00b7 today</span><span class="pct">' +
      Math.round(pPct * 100) + "%</span></div>" +
      '<div class="big-serif">' + day.protein + "g protein</div>" +
      '<p class="sub">' + Math.max(0, goal - day.protein) + "g remaining toward the " + goal + "g daily minimum.</p>" +
      '<div class="bar"><div style="width:' + Math.min(100, pPct * 100).toFixed(1) + '%"></div></div>' +
      '<div class="mini-row">' +
      '<div class="mini"><div class="n">~' + day.calories.toLocaleString() + '</div><div class="l">calories today</div></div>' +
      '<div class="mini"><div class="n">' + entries + '</div><div class="l">entries today</div></div>' +
      "</div></div>";

    var mi = (health.distanceKm * 0.621371).toFixed(2);
    var syncT = health.updated ? fmtTime(health.updated) : "";
    var col2 =
      '<div class="col">' +
      '<div class="col-label"><span>Activity \u00b7 today</span></div>' +
      '<div class="big-serif">' + health.steps.toLocaleString() + " steps</div>" +
      '<p class="sub">' + health.activeKcal + " active kcal \u00b7 " + health.distanceKm + " km (" + mi + " mi)</p>" +
      '<div class="sync-note">' + (syncT ? "As of " + syncT + " \u00b7 partial day" : "Partial day") + "</div>" +
      "</div>";

    var s = health.sleep;
    var totalMin = Math.round(s.asleepHrs * 60);
    var coreMin = Math.max(0, totalMin - s.deepMin - s.remMin);
    var wDeep = (s.deepMin / totalMin * 100).toFixed(1),
        wRem = (s.remMin / totalMin * 100).toFixed(1),
        wCore = Math.max(0, 100 - parseFloat(wDeep) - parseFloat(wRem)).toFixed(1);
    var col3 =
      '<div class="col">' +
      '<div class="col-label"><span>Last night\u2019s sleep</span></div>' +
      '<div class="big-serif">' + fmtDurHm(totalMin) + "</div>" +
      '<p class="sub">' + esc(s.bedtime) + "\u2013" + esc(s.wake) + " \u00b7 " + s.efficiency + "% efficiency</p>" +
      '<div class="stackbar">' +
      '<div style="width:' + wDeep + '%;background:var(--deep-blue)"></div>' +
      '<div style="width:' + wRem + '%;background:var(--rem-purple)"></div>' +
      '<div style="width:' + wCore + '%;background:var(--core-green)"></div>' +
      "</div>" +
      '<div class="legend">' +
      '<span><i class="dot" style="background:var(--deep-blue)"></i>Deep ' + fmtDurHm(s.deepMin) + "</span>" +
      '<span><i class="dot" style="background:var(--rem-purple)"></i>REM ' + fmtDurHm(s.remMin) + "</span>" +
      '<span><i class="dot" style="background:var(--core-green)"></i>Core ' + fmtDurHm(coreMin) + "</span>" +
      "</div>" +
      (s.note ? '<div class="sync-note">' + esc(s.note) + "</div>" : "") +
      "</div>";

    document.getElementById("panel-day").innerHTML = col1 + col2 + col3;

    /* ---- Health summary: Week panel ---- */
    var wPct = wk.plants / wk.plantGoal;
    document.getElementById("panel-week").innerHTML =
      '<div class="ring-wrap">' +
      ring(wPct, wk.plants + " / " + wk.plantGoal, "plants") +
      '<div><div style="font-weight:800;font-size:16px">Plant diversity</div>' +
      '<div style="font-size:13px;color:#6f695c;margin-top:4px">' +
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

    /* ---- Daily nutrition signals (4 cards) ---- */
    var ferm = fermentedInfo(day.meals);
    var ultra = ultraInfo(day.meals, day.calories);
    var prod = produceInfo(day.meals);
    var mealNames = day.meals.map(function (m) { return m.name; });
    var mealSummary = mealNames.join(" \u00b7 ");

    var card1 =
      '<div class="sig-card">' +
      '<div class="sig-top"><span class="sig-label">Today\u2019s log</span>' +
      '<span class="sig-target">' + entries + " entries</span></div>" +
      '<div class="sig-big">' + day.calories.toLocaleString() + " cal</div>" +
      '<p class="sig-muted">' + esc(mealSummary) + "</p>" +
      '<div class="sig-tags">' + mealNames.map(function (n) {
        return '<span class="tag">' + esc(n) + "</span>";
      }).join("") + "</div></div>";

    var card2 =
      '<div class="sig-card">' +
      '<div class="sig-top"><span class="sig-label">Fermented foods</span>' +
      '<span class="sig-target">Target 1\u20132 / day</span></div>' +
      '<div class="sig-big">' + ferm.count + " today</div>" +
      '<p class="sig-muted">' + esc(ferm.example) + "</p></div>";

    var uPct = ultra.pct;
    var card3 =
      '<div class="sig-card">' +
      '<div class="sig-top"><span class="sig-label">Ultra-processed share</span>' +
      '<span class="sig-target">Goal under 20%</span></div>' +
      '<div class="sig-big">~' + Math.round(uPct) + "%</div>" +
      '<p class="sig-muted">About ' + ultra.cal + " of " + day.calories.toLocaleString() + " calories</p>" +
      '<div class="up-bar"><div class="up-fill" style="width:' + Math.min(100, uPct).toFixed(1) + '%"></div>' +
      '<div class="up-marker" style="left:20%"></div></div>' +
      '<p class="sig-muted" style="margin-top:8px">Estimate from flagged items; goal marker at 20%.</p></div>';

    var card4 =
      '<div class="sig-card">' +
      '<div class="sig-top"><span class="sig-label">Fruit &amp; vegetables</span>' +
      '<span class="sig-target">Target 5+ / day</span></div>' +
      '<div class="sig-big">' + prod.servings + " today</div>" +
      '<p class="sig-muted">' + (prod.names.length ? esc(prod.names.join(", ")) : "none logged yet") + "</p>" +
      '<p class="sig-muted" style="margin-top:8px">Approximate servings; fruit in the donut doesn\u2019t count.</p></div>';

    document.getElementById("signal-cards").innerHTML = card1 + card2 + card3 + card4;

    /* ---- Plant diversity ---- */
    document.getElementById("plant-summary").innerHTML =
      '<div class="ring-wrap">' +
      ring(wPct, wk.plants + " / " + wk.plantGoal, "this week") +
      '<div style="font-size:14px;max-width:420px">Distinct plants logged this week. Each plant counts once toward the ' +
      wk.plantGoal + "-plant goal.</div>" +
      "</div>";
    document.getElementById("plant-chips").innerHTML =
      wk.plantList.map(function (p) { return '<span class="chip">' + esc(p) + "</span>"; }).join("");

    /* ---- Key nutrients ---- */
    document.getElementById("nutri-grid").innerHTML =
      meals.nutrients.map(function (n) {
        return '<div class="nutri"><div class="n">' + esc(n.name) + "</div>" +
          '<div class="p">' + esc(n.pct) + ' <small>DV</small></div>' +
          '<div class="t">' + esc(n.note) + "</div></div>";
      }).join("");

    /* ---- Food log ---- */
    document.getElementById("foodlog-sub").textContent =
      day.meals.length + " meals \u00b7 ~" + day.calories.toLocaleString() + " cal";
    document.getElementById("food-meals").innerHTML = day.meals.map(function (m) {
      var items = (m.items || []).map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("");
      var flags = (m.flags || []).map(function (f) {
        return '<span class="flag">' + esc(f) + "</span>";
      }).join("");
      return (
        '<div class="meal"><div class="meal-head">' +
        '<span class="name">' + esc(m.name) + "</span>" +
        '<span class="macros">~' + m.calories + " cal \u00b7 ~" + m.protein + "g protein</span>" +
        "</div><ul>" + items + "</ul>" +
        (flags ? '<div class="flags">' + flags + "</div>" : "") +
        "</div>"
      );
    }).join("");
  }

  function errorState() {
    document.getElementById("updated").textContent = "";
    document.getElementById("stale-note").classList.add("show");
    ["panel-day", "signal-cards", "plant-summary", "nutri-grid", "food-meals"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = '<p style="font-size:14px;color:#6f695c">Data unavailable right now.</p>';
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
