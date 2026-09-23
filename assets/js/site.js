(function () {
  var d = document, root = d.documentElement;
  var motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  var reduce = motionQuery.matches;

  /* a data-autoplay clip is fetched and started only as it nears the screen, and never under reduced motion */
  if (!reduce && "IntersectionObserver" in window) d.querySelectorAll("video[data-autoplay]").forEach(function (v) {
    new IntersectionObserver(function (es, o) {
      if (es[0].isIntersecting) { o.disconnect(); v.preload = "auto"; v.autoplay = true; }
    }, { rootMargin: "400px" }).observe(v);
  });

  var header = d.querySelector(".site-header");
  function setHeaderH() { if (header) root.style.setProperty("--header-h", header.offsetHeight + "px"); }
  setHeaderH();
  addEventListener("resize", setHeaderH);

  /* ---- mobile menu ---- */
  var toggle = d.querySelector(".nav-toggle");
  if (toggle && header) {
    var setMenu = function (open) {
      header.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    };
    toggle.addEventListener("click", function () { setMenu(!header.classList.contains("nav-open")); });
    d.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.classList.contains("nav-open")) { setMenu(false); toggle.focus(); }
    });
    d.addEventListener("click", function (e) { if (!header.contains(e.target)) setMenu(false); });
    /* tabbing out of the menu closes it, or the next stops sit hidden under the panel; a click on the
       header's blank space moves focus to nothing and leaves it open */
    header.addEventListener("focusout", function (e) { if (e.relatedTarget && !header.contains(e.relatedTarget)) setMenu(false); });
    /* coming back through the back-forward cache restores the page with the menu still open */
    addEventListener("pageshow", function (e) { if (e.persisted) setMenu(false); });
  }

  /* smooth anchor scrolling only after the page has settled, so a #hash on arrival jumps instead of animating */
  addEventListener("load", function () {
    (d.fonts ? d.fonts.ready : Promise.resolve()).then(function () { root.classList.add("smooth"); });
  });

  /* ---- home hero: the stills in order, then the clip, then back ---- */
  var hero = d.querySelector(".hero");
  var slides = hero ? [].slice.call(hero.querySelectorAll(".hero-slide")) : [];
  var clip = hero ? hero.querySelector("video[data-src]") : null;
  if (slides.length && !reduce) {
    var cur = 0, timer = 0;
    function turn() {
      cur = cur + 1 >= slides.length ? -1 : cur + 1;
      slides.forEach(function (s, k) { s.classList.toggle("is-on", k === cur); });
      if (clip) {
        /* the clip is fetched two stills ahead, so it has ~13 s to buffer 1.8 MB and does not stutter on
           a slow connection; it still costs nothing at page load, and under reduced motion or without
           script it is never fetched at all. currentTime is reset so every cycle starts from the top.
           preload goes to "auto" first: leaving it at "none" while asking the element to load makes
           Chrome fetch metadata, suspend, then resume with a range request, and that resumed transfer
           fails against jekyll serve about two times in three (MEDIA_ERR_NETWORK, a dead hero). The
           attribute stays "none" in the HTML, so a visitor who never reaches this line fetches nothing. */
        if (cur >= slides.length - 2 && !clip.getAttribute("src")) { clip.preload = "auto"; clip.src = clip.getAttribute("data-src"); clip.load(); }
        if (cur === -1) { clip.currentTime = 0; var p = clip.play(); if (p && p.catch) p.catch(function () {}); }
        else clip.pause();
      }
      timer = setTimeout(turn, cur === -1 ? 9000 : 6500);
    }
    function start() {
      if (d.hidden) { addEventListener("visibilitychange", start, { once: true }); return; }
      /* fetch the remaining stills now, and start the clock only once they are ready to paint */
      Promise.all(slides.map(function (s) {
        /* the portrait <source> first: set after src, the browser would fetch both files */
        var so = s.previousElementSibling; if (so && so.hasAttribute("data-srcset")) so.srcset = so.getAttribute("data-srcset");
        s.src = s.getAttribute("data-src") || s.src;
        return (s.decode ? s.decode() : Promise.resolve()).then(function () { return s; }, function () { s.remove(); return null; });
      })).then(function (ok) {
        if (motionQuery.matches) return;   /* it was switched on while the stills were decoding */
        slides = ok.filter(Boolean);
        if (slides.length) timer = setTimeout(turn, cur === -1 ? 9000 : 6500);
      });
    }
    /* after load, so the later stills do not compete with the first one, the largest paint */
    addEventListener("load", start);
    motionQuery.addEventListener("change", function (e) {
      if (!e.matches) return;
      clearTimeout(timer); timer = 0; cur = 0;
      slides.forEach(function (s, k) { s.classList.toggle("is-on", k === 0); });
      if (clip) clip.pause();
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
    /* Where the clicked card sat BEFORE it opened. The toggle event fires after the state has already
       changed, so the card has expanded into a full-width row by then and its own movement is invisible
       to us; we have to take the reading on the click that precedes it. */
    var openedFrom = null;
    d.addEventListener("click", function (ev) {
      var s = ev.target.closest && ev.target.closest("details.person[id] > summary");
      openedFrom = s && !s.parentNode.open ? s.parentNode.getBoundingClientRect().top : null;
    }, true);

    /* the toggle event does not bubble, so listen for it on the way down */
    d.addEventListener("toggle", function (ev) {
      var t = ev.target;
      if (!t.matches || !t.matches("details.person[id]")) return;
      if (t.open) {
        people.forEach(function (p) { if (p !== t) p.open = false; });
        /* Opening re-flows the grid twice over: this card becomes a full-width row, and any card that
           was open above it collapses. Put the page back so the card stays under the pointer. */
        if (openedFrom !== null) {
          var moved = t.getBoundingClientRect().top - openedFrom;
          if (moved) scrollBy({ top: moved, behavior: "instant" });
        }
        history.replaceState(null, "", "#" + t.id);
      } else if (location.hash === "#" + t.id) {
        history.replaceState(null, "", location.pathname + location.search);
      }
      openedFrom = null;
    }, true);

    /* arriving with #slug: open that card. The browser's own fragment scroll then lands it at its
       scroll-margin, so there is nothing more to do; re-centring on load moved it a second time. */
    var wanted = location.hash.length > 1 && d.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (wanted && wanted.matches("details.person")) wanted.open = true;
  }

  /* ---- copy a link to the clipboard ---- */
  d.addEventListener("click", function (ev) {
    var btn = ev.target.closest && ev.target.closest(".copy-link");
    if (!btn) return;
    var url = btn.dataset.url;
    var label = btn.parentNode.querySelector(".share-label");

    /* the share label doubles as the live region: it says what happened, then goes back to "Share" */
    function say(text, done) {
      btn.classList.toggle("is-copied", done);
      btn.querySelector(".i-link").hidden = done;
      btn.querySelector(".i-ok").hidden = !done;
      btn.setAttribute("aria-label", done ? "Link copied" : "Copy link");
      btn.title = done ? "Link copied" : "Copy link";
      if (label) label.textContent = text;
      clearTimeout(btn._t);
      if (text !== "Share") btn._t = setTimeout(function () { say("Share", false); }, 1800);
    }
    function confirmed() { say("Link copied", true); }
    function failed() { say("Copy failed", false); }

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
      if (ok) confirmed(); else failed();
    }

    if (navigator.clipboard) navigator.clipboard.writeText(url).then(confirmed, fallback);
    else fallback();
  });

  /* ---- publications: filter ---- */
  var filter = d.getElementById("pub-filter");
  if (filter) {
    var pubs = [].slice.call(d.querySelectorAll(".pub"));
    var pubYears = [].slice.call(d.querySelectorAll(".pub-year"));
    var older = d.querySelector("details.collapsed");
    var none = d.querySelector(".pub-none");
    var rail = d.querySelector(".years");
    /* accents and case are ignored, and each entry also answers to its year */
    function fold(s) { return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
    var haystack = pubs.map(function (p) { return fold(p.textContent + " " + ((p.closest(".pub-year") || {}).id || "")); });
    filter.addEventListener("input", function () {
      var q = filter.value.trim();
      /* every word must appear, in any order; a pasted doi.org link is matched on the DOI alone */
      var terms = fold(q).replace(/(https?:\/\/)?(dx\.)?doi\.org\//g, "").split(/\s+/).filter(Boolean);
      var shown = 0;
      pubs.forEach(function (p, i) { p.hidden = !!q && !terms.every(function (t) { return haystack[i].indexOf(t) >= 0; }); if (!p.hidden) shown++; });
      pubYears.forEach(function (s) {
        var empty = !!q && !s.querySelector(".pub:not([hidden])");
        s.hidden = empty;
        /* a chip pointing at a hidden year is a dead link, so it goes with it */
        var chip = rail && rail.querySelector('a[href="#' + s.id + '"]');
        if (chip) chip.hidden = empty;
      });
      /* while a query is running, open the pre-Northwestern list if it has matches, so nothing hides */
      if (older) older.open = !!q && !!older.querySelector(".pub:not([hidden])");
      if (none) {
        none.textContent = !q ? "" : (shown ? shown + (shown === 1 ? " paper" : " papers") : "No papers match.");
      }
      /* the rail's active year is computed from what is on screen, which just changed */
      dispatchEvent(new Event("scroll"));
    });
  }

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
      var visible = sections.filter(function (s) { return !s.hidden; });
      if (!visible.length) { years.classList.remove("is-shown"); return; }
      var current = visible[0];
      for (var i = 0; i < visible.length; i++) {
        if (visible[i].getBoundingClientRect().top <= line) current = visible[i]; else break;
      }
      if (scrollY + innerHeight >= root.scrollHeight - 2) current = visible[visible.length - 1];
      setActive(current);
      var last = visible[visible.length - 1].getBoundingClientRect();
      var headBottom = head ? head.getBoundingClientRect().bottom : 0;
      years.classList.toggle("is-shown", headBottom < hh && last.bottom > innerHeight * 0.45);
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", function () { active = null; onScroll(); });
    update();
  }
})();
