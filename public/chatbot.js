/* =========================================================
   ASTRO CHATBOT — chatbot.js
   Builds the widget, talks to the Flask backend, and gently
   reminds visitors to chat every 8–9 minutes while it's closed.
   ========================================================= */
(function () {
  "use strict";

  /* ---------------- Settings (edit these) ---------------- */
  var CONFIG = {
    name: "Astro",
    // Where the Flask backend lives. If you open the page through Flask (port 5000)
    // this is a relative URL; if you use VS Code "Live Server" (port 5500) it calls Flask directly.
    apiUrl: "/api/chat",

    // Reminder bubble: shown at a random moment between min and max, then repeats.
    // Defaults to 8–9 MINUTES. For seconds instead, use: minSeconds: 8, maxSeconds: 9
    reminderMinSeconds: 8 * 60,
    reminderMaxSeconds: 9 * 60,
    reminderVisibleMs: 9000,

    storageKey: "astro_chat_v1",
    maxHistory: 12
  };

  var REMINDERS = [
    "Hi, I'm <strong>Astro</strong>. Need help with video editing, design or social media?",
    "Have a project in mind? <strong>Ask me</strong> about services, skills or pricing.",
    "Curious about Hassam's work? I can show you his <strong>skills &amp; experience</strong>.",
    "Want to get in touch? I can share the <strong>best way to contact</strong> Hassam."
  ];

  var WELCOME =
    "Hi there! I'm **Astro**, Hassam's virtual assistant. I can tell you about his services, skills, projects and experience, or help you get in touch. What would you like to know?";

  var SUGGESTIONS = [
    "What services do you offer?",
    "What are Hassam's top skills?",
    "Tell me about his experience",
    "How can I contact him?"
  ];

  /* ---------------- Icons ---------------- */
  var ICON = {
    chat: '<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.5-4.6A8 8 0 1 1 21 12z"/><path d="M9 10.5h6M9 14h3.5"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    spark: '<svg viewBox="0 0 24 24"><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/><path d="M19 3v3M17.5 4.5h3"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
    reset: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>'
  };

  /* ---------------- State ---------------- */
  var history = [];          // [{role:'user'|'assistant', content:'...'}]
  var isOpen = false;
  var isBusy = false;
  var reminderTimer = null;
  var hideTimer = null;
  var reminderIndex = 0;
  var el = {};

  /* ---------------- Helpers ---------------- */
  function esc(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function inline(t) {
    return t
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  // Tiny, safe markdown renderer: paragraphs, **bold**, lists, links.
  function render(md) {
    var lines = esc(md).split("\n");
    var html = "", list = null;
    lines.forEach(function (raw) {
      var line = raw.replace(/\s+$/, "");
      var m = line.match(/^\s*(?:[-*\u2022]|\d+[.)])\s+(.*)$/);
      if (m) {
        var tag = /^\s*\d+[.)]/.test(line) ? "ol" : "ul";
        if (list !== tag) { if (list) html += "</" + list + ">"; html += "<" + tag + ">"; list = tag; }
        html += "<li>" + inline(m[1]) + "</li>";
      } else {
        if (list) { html += "</" + list + ">"; list = null; }
        if (line.trim()) html += "<p>" + inline(line) + "</p>";
      }
    });
    if (list) html += "</" + list + ">";
    return html;
  }

  function rand(min, max) { return Math.random() * (max - min) + min; }

  /* ---------------- Build UI ---------------- */
  function build() {
    var root = document.createElement("div");
    root.className = "astro";
    root.setAttribute("role", "complementary");
    root.setAttribute("aria-label", CONFIG.name + " chat assistant");
    root.innerHTML =
      '<div class="astro-panel" id="astroPanel" role="dialog" aria-label="Chat with ' + CONFIG.name + '" aria-hidden="true">' +
        '<div class="astro-head">' +
          '<div class="astro-avatar">' + ICON.spark + '</div>' +
          '<div class="astro-id"><div class="astro-name">' + CONFIG.name + '</div><div class="astro-sub">Portfolio assistant &middot; Online</div></div>' +
          '<button class="astro-iconbtn" id="astroReset" type="button" aria-label="Start a new chat" title="New chat">' + ICON.reset + '</button>' +
          '<button class="astro-iconbtn" id="astroMin" type="button" aria-label="Close chat" title="Close">' + ICON.close + '</button>' +
        '</div>' +
        '<div class="astro-body" id="astroBody" aria-live="polite"></div>' +
        '<div class="astro-foot">' +
          '<form class="astro-form" id="astroForm" autocomplete="off">' +
            '<textarea class="astro-input" id="astroInput" rows="1" maxlength="1000" placeholder="Ask Astro anything&hellip;" aria-label="Your message"></textarea>' +
            '<button class="astro-send" id="astroSend" type="submit" aria-label="Send message" disabled>' + ICON.send + '</button>' +
          '</form>' +
          '<p class="astro-note">AI assistant &middot; answers may not always be perfect</p>' +
        '</div>' +
      '</div>' +
      '<div class="astro-nudge" id="astroNudge" role="status">' +
        '<span class="astro-nudge-text" id="astroNudgeText"></span>' +
        '<button class="astro-nudge-x" id="astroNudgeX" type="button" aria-label="Dismiss reminder">' + ICON.close + '</button>' +
      '</div>' +
      '<button class="astro-launcher" id="astroLauncher" type="button" aria-label="Open chat with ' + CONFIG.name + '" aria-expanded="false" aria-controls="astroPanel">' +
        ICON.chat.replace("<svg", '<svg class="ico-chat"') +
        ICON.close.replace("<svg", '<svg class="ico-close"') +
        '<span class="astro-badge" id="astroBadge">1</span>' +
      '</button>';
    document.body.appendChild(root);

    el.root = root;
    el.panel = root.querySelector("#astroPanel");
    el.body = root.querySelector("#astroBody");
    el.form = root.querySelector("#astroForm");
    el.input = root.querySelector("#astroInput");
    el.send = root.querySelector("#astroSend");
    el.launcher = root.querySelector("#astroLauncher");
    el.nudge = root.querySelector("#astroNudge");
    el.nudgeText = root.querySelector("#astroNudgeText");
    el.badge = root.querySelector("#astroBadge");

    el.launcher.addEventListener("click", toggle);
    root.querySelector("#astroMin").addEventListener("click", function () { setOpen(false); el.launcher.focus(); });
    root.querySelector("#astroReset").addEventListener("click", resetChat);
    root.querySelector("#astroNudgeX").addEventListener("click", function (e) { e.stopPropagation(); hideNudge(); });
    el.nudge.addEventListener("click", function () { setOpen(true); });
    el.form.addEventListener("submit", function (e) { e.preventDefault(); submit(el.input.value); });
    el.input.addEventListener("input", function () { autosize(); el.send.disabled = isBusy || !el.input.value.trim(); });
    el.input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!el.send.disabled) submit(el.input.value); }
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && isOpen) { setOpen(false); el.launcher.focus(); } });
  }

  function autosize() {
    el.input.style.height = "auto";
    el.input.style.height = Math.min(el.input.scrollHeight, 110) + "px";
  }

  /* ---------------- Messages ---------------- */
  function scrollDown() { el.body.scrollTop = el.body.scrollHeight; }

  function addMessage(role, text, opts) {
    opts = opts || {};
    var row = document.createElement("div");
    row.className = "astro-msg " + (role === "user" ? "user" : "bot") + (opts.error ? " error" : "");
    var bubble = document.createElement("div");
    bubble.className = "astro-bubble";
    bubble.innerHTML = role === "user" ? "<p>" + esc(text).replace(/\n/g, "<br>") + "</p>" : render(text);
    if (role !== "user") {
      var mini = document.createElement("div");
      mini.className = "astro-mini";
      mini.innerHTML = ICON.spark;
      row.appendChild(mini);
    }
    row.appendChild(bubble);
    el.body.appendChild(row);
    scrollDown();
    return row;
  }

  function showTyping() {
    var row = document.createElement("div");
    row.className = "astro-msg bot";
    row.id = "astroTyping";
    row.innerHTML = '<div class="astro-mini">' + ICON.spark + '</div><div class="astro-bubble"><span class="astro-typing" aria-label="Astro is typing"><i></i><i></i><i></i></span></div>';
    el.body.appendChild(row);
    scrollDown();
  }
  function hideTyping() { var t = document.getElementById("astroTyping"); if (t) t.remove(); }

  function showChips() {
    removeChips();
    var wrap = document.createElement("div");
    wrap.className = "astro-chips";
    wrap.id = "astroChips";
    SUGGESTIONS.forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "astro-chip"; b.textContent = s;
      b.addEventListener("click", function () { submit(s); });
      wrap.appendChild(b);
    });
    el.body.appendChild(wrap);
    scrollDown();
  }
  function removeChips() { var c = document.getElementById("astroChips"); if (c) c.remove(); }

  /* ---------------- Persistence ---------------- */
  function save() {
    try { sessionStorage.setItem(CONFIG.storageKey, JSON.stringify(history.slice(-40))); } catch (e) { /* ignore */ }
  }
  function load() {
    try {
      var raw = sessionStorage.getItem(CONFIG.storageKey);
      var parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) history = parsed.filter(function (m) { return m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"); });
    } catch (e) { history = []; }
  }

  function startConversation() {
    el.body.innerHTML = "";
    if (history.length) {
      history.forEach(function (m) { addMessage(m.role, m.content); });
    } else {
      addMessage("bot", WELCOME);
      showChips();
    }
  }

  function resetChat() {
    history = [];
    save();
    isBusy = false;
    el.input.value = ""; autosize(); el.send.disabled = true;
    startConversation();
    el.input.focus();
  }

  /* ---------------- Sending ---------------- */
  function submit(text) {
    text = (text || "").trim();
    if (!text || isBusy) return;
    removeChips();
    addMessage("user", text);
    history.push({ role: "user", content: text });
    save();
    el.input.value = ""; autosize();
    setBusy(true);
    showTyping();

    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 60000);

    fetch(CONFIG.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history.slice(-CONFIG.maxHistory) }),
      signal: controller.signal
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (r) {
        hideTyping();
        if (r.ok && r.data.reply) {
          history.push({ role: "assistant", content: r.data.reply });
          save();
          addMessage("bot", r.data.reply);
        } else {
          addMessage("bot", r.data.error || "Sorry, something went wrong. Please try again.", { error: true });
        }
      })
      .catch(function (err) {
        hideTyping();
        var msg = err && err.name === "AbortError"
          ? "That took too long. Please try again."
          : "I can't reach the server right now. Make sure the Astro backend is running (python app.py).";
        addMessage("bot", msg, { error: true });
      })
      .then(function () {
        clearTimeout(timeout);
        setBusy(false);
        if (isOpen) el.input.focus();
      });
  }

  function setBusy(v) {
    isBusy = v;
    el.send.disabled = v || !el.input.value.trim();
  }

  /* ---------------- Open / close ---------------- */
  function toggle() { setOpen(!isOpen); }

  function setOpen(open) {
    isOpen = open;
    el.root.classList.toggle("is-open", open);
    el.launcher.setAttribute("aria-expanded", String(open));
    el.launcher.setAttribute("aria-label", (open ? "Close chat with " : "Open chat with ") + CONFIG.name);
    el.panel.setAttribute("aria-hidden", String(!open));
    if (open) {
      hideNudge();
      el.badge.classList.remove("show");
      setTimeout(function () { el.input.focus(); scrollDown(); }, 250);
    }
    scheduleReminder();   // restart the 8–9 minute cycle whenever the state changes
  }

  /* ---------------- Reminder every 8–9 minutes ---------------- */
  function showNudge() {
    el.nudgeText.innerHTML = REMINDERS[reminderIndex++ % REMINDERS.length];
    el.nudge.classList.add("show");
    el.badge.classList.add("show");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideNudge, CONFIG.reminderVisibleMs);
  }
  function hideNudge() {
    clearTimeout(hideTimer);
    el.nudge.classList.remove("show");
  }

  function scheduleReminder() {
    clearTimeout(reminderTimer);
    if (isOpen) return;   // never interrupt an open chat
    var delay = rand(CONFIG.reminderMinSeconds, CONFIG.reminderMaxSeconds) * 1000;
    reminderTimer = setTimeout(function () {
      if (!isOpen && !document.hidden) showNudge();
      scheduleReminder();
    }, delay);
  }

  /* ---------------- Init ---------------- */
  function init() {
    if (document.querySelector(".astro")) return;
    load();
    build();
    startConversation();
    scheduleReminder();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
