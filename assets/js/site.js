(function () {
  var d = document, root = d.documentElement;
  var motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  var reduce = motionQuery.matches;

  if (reduce) {
    d.querySelectorAll("video[autoplay]").forEach(function (v) { v.removeAttribute("autoplay"); v.pause(); });
  }

  var header = d.querySelector(".site-header");
  function setHeaderH() { if (header) root.style.setProperty("--header-h", header.offsetHeight + "px"); }
  setHeaderH();
  addEventListener("resize", setHeaderH);

  /* smooth anchor scrolling only after the page has settled, so a #hash on arrival jumps instead of animating */
  addEventListener("load", function () {
    (d.fonts ? d.fonts.ready : Promise.resolve()).then(function () { root.classList.add("smooth"); });
  });

  /* ---- home hero: the clip, then each still, then back ---- */
  var hero = d.querySelector(".hero");
  var slides = hero ? [].slice.call(hero.querySelectorAll(".hero-slide")) : [];
  if (slides.length && !reduce) {
    var cur = -1, timer = 0;
    function turn() {
      cur = cur + 1 >= slides.length ? -1 : cur + 1;
      slides.forEach(function (s, k) { s.classList.toggle("is-on", k === cur); });
      timer = setTimeout(turn, cur === -1 ? 9000 : 6500);
    }
    function start() {
      if (d.hidden) { addEventListener("visibilitychange", start, { once: true }); return; }
      /* fetch the stills now, and count the clip's nine seconds only once they are ready to paint */
      Promise.all(slides.map(function (s) {
        s.src = s.getAttribute("data-src");
        return (s.decode ? s.decode() : Promise.resolve()).then(function () { return s; }, function () { s.remove(); return null; });
      })).then(function (ok) {
        slides = ok.filter(Boolean);
        if (slides.length) timer = setTimeout(turn, 9000);
      });
    }
    start();
    motionQuery.addEventListener("change", function (e) {
      if (!e.matches) return;
      clearTimeout(timer); timer = 0; cur = -1;
      slides.forEach(function (s) { s.classList.remove("is-on"); });
      var clip = hero.querySelector("video"); if (clip) { clip.removeAttribute("autoplay"); clip.pause(); }
    });
  }

  /* ---- scroll reveal ---- */
  var els = [].slice.call(d.querySelectorAll(".reveal"));
  if (els.length) {
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach(function (e) { e.classList.add("is-visible"); });
    } else {
      var vh = innerHeight;
      els.forEach(function (e) {
        if (e.getBoundingClientRect().top < vh) e.classList.add("is-visible", "no-anim");
      });
      root.classList.add("reveal-ready");
      var pending = [], raf = 0;
      function flush() {
        raf = 0;
        pending.sort(function (a, b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; });
        pending.forEach(function (e, i) {
          e.style.setProperty("--reveal-delay", Math.min(i, 4) * 50 + "ms");
          e.classList.add("is-visible");
        });
        pending = [];
      }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { pending.push(en.target); io.unobserve(en.target); }
        });
        if (!raf) raf = requestAnimationFrame(flush);
      }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
      els.forEach(function (e) { if (!e.classList.contains("is-visible")) io.observe(e); });
      /* anything that receives keyboard focus is shown at once */
      d.addEventListener("focusin", function (ev) {
        var r = ev.target.closest && ev.target.closest(".reveal");
        if (r && !r.classList.contains("is-visible")) { r.classList.add("is-visible", "no-anim"); io.unobserve(r); }
      });
    }
  }

  /* ---- team: one bio open at a time, and the open one owns the URL ---- */
  var people = [].slice.call(d.querySelectorAll("details.person[id]"));
  if (people.length) {
    /* the toggle event does not bubble, so listen for it on the way down */
    d.addEventListener("toggle", function (ev) {
      var t = ev.target;
      if (!t.matches || !t.matches("details.person[id]")) return;
      if (t.open) {
        people.forEach(function (p) { if (p !== t) p.open = false; });
        history.replaceState(null, "", "#" + t.id);
      } else if (location.hash === "#" + t.id) {
        history.replaceState(null, "", location.pathname + location.search);
      }
    }, true);

    var wanted = location.hash.length > 1 && d.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (wanted && wanted.matches("details.person")) {
      wanted.open = true;
      /* the browser scrolled to the card while it was still shut, so place it again once it is open */
      addEventListener("load", function () { wanted.scrollIntoView({ block: "center" }); });
    }
  }

  /* ---- copy a link to the clipboard ---- */
  d.addEventListener("click", function (ev) {
    var btn = ev.target.closest && ev.target.closest(".copy-link");
    if (!btn) return;
    var url = btn.dataset.url;

    function confirmed() {
      btn.classList.add("is-copied");
      btn.querySelector(".i-link").hidden = true;
      btn.querySelector(".i-ok").hidden = false;
      btn.setAttribute("aria-label", "Link copied");
      setTimeout(function () {
        btn.classList.remove("is-copied");
        btn.querySelector(".i-link").hidden = false;
        btn.querySelector(".i-ok").hidden = true;
        btn.setAttribute("aria-label", "Copy link");
      }, 1800);
    }

    /* the async clipboard refuses when the document is not focused, so keep the old route in reserve */
    function fallback() {
      var ta = d.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
      d.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = d.execCommand("copy"); } catch (e) {}
      d.body.removeChild(ta);
      btn.focus();
      if (ok) confirmed();
    }

    if (navigator.clipboard) navigator.clipboard.writeText(url).then(confirmed, fallback);
    else fallback();
  });

  /* ---- publications: year timeline ---- */
  var years = d.querySelector(".years");
  var sections = [].slice.call(d.querySelectorAll(".pub-year[id]"));
  if (years && sections.length) {
    var links = [].slice.call(years.querySelectorAll("a"));
    var marker = years.querySelector(".years-marker");
    var head = d.querySelector(".page-head");
    var active = null, ticking = false;

    function setActive(sec) {
      if (sec === active) return;
      active = sec;
      var id = sec.id;
      links.forEach(function (a) {
        var on = a.getAttribute("href") === "#" + id;
        a.classList.toggle("is-active", on);
        if (on) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
        if (on && getComputedStyle(years).position === "sticky") {
          years.scrollTo({ left: a.offsetLeft - years.clientWidth / 2 + a.offsetWidth / 2, behavior: reduce ? "auto" : "smooth" });
        }
        if (on && marker) marker.style.top = (a.offsetTop + a.offsetHeight / 2 - years.clientTop) + "px";
      });
    }

    function update() {
      ticking = false;
      var hh = header ? header.offsetHeight : 0;
      /* a section counts as current once its top reaches where an anchor jump lands it (its scroll margin) */
      var line = (parseFloat(getComputedStyle(sections[0]).scrollMarginTop) || hh + 28) + 4;
      var current = sections[0];
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].getBoundingClientRect().top <= line) current = sections[i]; else break;
      }
      if (scrollY + innerHeight >= root.scrollHeight - 2) current = sections[sections.length - 1];
      setActive(current);
      var last = sections[sections.length - 1].getBoundingClientRect();
      var headBottom = head ? head.getBoundingClientRect().bottom : 0;
      years.classList.toggle("is-shown", headBottom < hh && last.bottom > innerHeight * 0.45);
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", function () { active = null; onScroll(); });
    update();
  }
})();
