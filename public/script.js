(() => {
  "use strict";
  /* ---------- Settings (edit these) ---------- */
  const EMAIL = "your-email@example.com";
  // Optional: paste a Formspree-style endpoint to send forms without opening the visitor's mail app.
  const ENDPOINT = "";

  /* Add new projects here. cat: video | design | social | photo | brand */
  const PROJECTS = [
    { title: "YouTube Video Creation & Editing", cats: ["video"], label: "Video Editing", img: "assets/projects/youtube-editing.svg", desc: "Full-length videos with strong storytelling, clean cuts and engaging pacing.", link: "" },
    { title: "Instagram Reels & TikTok Shorts", cats: ["video", "social"], label: "Short-Form", img: "assets/projects/reels-shorts.svg", desc: "Vertical videos built for attention, with captions, effects and quick transitions.", link: "" },
    { title: "Social Media Post Designing", cats: ["design", "social"], label: "Graphic Design", img: "assets/projects/social-posts.svg", desc: "On-brand posts and announcements for Facebook and Instagram.", link: "" },
    { title: "YouTube Thumbnail Designing", cats: ["design"], label: "Thumbnails", img: "assets/projects/thumbnails.svg", desc: "Eye-catching thumbnails with bold text and strong visual hierarchy.", link: "" },
    { title: "Promotional Video & Ad Creation", cats: ["video"], label: "Promo & Ads", img: "assets/projects/promo-ad.svg", desc: "Short promotional videos that present products and services clearly.", link: "" },
    { title: "Educational & Documentary Videos", cats: ["video"], label: "Documentary", img: "assets/projects/documentary.svg", desc: "Informative videos with clear structure, graphics and narration-friendly editing.", link: "" },
    { title: "Personal Branding Content", cats: ["brand", "design"], label: "Branding", img: "assets/projects/branding.svg", desc: "Visual identity and content that helps individuals stand out.", link: "" },
    { title: "Social Media Content Calendar", cats: ["social"], label: "Strategy", img: "assets/projects/content-calendar.svg", desc: "Monthly plans so every post has a purpose and goes out on time.", link: "" }
  ];
  /* Replace with real feedback. rating: 1-5 shows stars, 0 shows none. Remove placeholder: true when real. */
  const TESTIMONIALS = [
    { name: "Client Name", role: "Company, Role", text: "Add a real testimonial from a client here.", rating: 0, placeholder: true },
    { name: "Client Name", role: "Company, Role", text: "Add a second real testimonial here, or delete this entry.", rating: 0, placeholder: true }
  ];

  const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Navigation */
  const nav = $("#nav"), burger = $("#burger"), panel = $("nav", nav);
  const setNav = o => { panel.classList.toggle("open", o); burger.setAttribute("aria-expanded", o); burger.setAttribute("aria-label", o ? "Close menu" : "Open menu"); document.body.style.overflow = o ? "hidden" : ""; };
  burger.onclick = () => setNav(!panel.classList.contains("open"));
  $$("a", panel).forEach(a => a.onclick = () => setNav(false));
  addEventListener("keydown", e => { if (e.key === "Escape") setNav(false); });

  /* Render projects */
  const grid = $("#pgrid"), empty = $("#empty");
  grid.innerHTML = PROJECTS.map((p, i) => `<button class="pcard rv" data-i="${i}" data-cats="${p.cats.join(" ")}" aria-label="Open project: ${esc(p.title)}"><span class="pimg"><img src="${esc(p.img)}" alt="${esc(p.title)}" loading="lazy" width="800" height="500"><i><b>Learn<br>more</b></i></span><span class="pbody"><em>${esc(p.label)}</em><b>${esc(p.title)}</b><span>${esc(p.desc)}</span></span></button>`).join("");
  $$(".filters button").forEach(b => b.onclick = () => {
    $$(".filters button").forEach(x => x.classList.toggle("on", x === b));
    let n = 0;
    $$(".pcard", grid).forEach(c => { const show = b.dataset.f === "all" || c.dataset.cats.split(" ").includes(b.dataset.f); c.hidden = !show; if (show) n++; });
    empty.hidden = n > 0;
  });
  const dlg = $("#modal");
  grid.addEventListener("click", e => {
    const c = e.target.closest(".pcard"); if (!c) return;
    const p = PROJECTS[c.dataset.i];
    $("#mImg").src = p.img; $("#mImg").alt = p.title; $("#mTag").textContent = p.label; $("#mTitle").textContent = p.title; $("#mDesc").textContent = p.desc;
    $("#mLink").hidden = !p.link; $("#mNote").hidden = !!p.link; if (p.link) $("#mLink").href = p.link;
    dlg.showModal();
  });
  dlg.addEventListener("click", e => { if (e.target === dlg || e.target.dataset.close !== undefined) dlg.close(); });

  /* Render testimonials */
  const track = $("#track");
  track.innerHTML = TESTIMONIALS.map(t => `<article class="card tcard"><div>${t.rating ? `<div class="stars" aria-label="${t.rating} out of 5 stars">${"★".repeat(t.rating)}${"☆".repeat(5 - t.rating)}</div>` : ""}<blockquote>“${esc(t.text)}”</blockquote><cite>${esc(t.name)}<small>${esc(t.role)}</small></cite>${t.placeholder ? '<span class="ph">Editable placeholder</span>' : ""}</div><div class="av" aria-hidden="true">${esc(t.name.trim()[0] || "?")}</div></article>`).join("");
  const step = d => track.scrollBy({ left: d * track.clientWidth, behavior: reduce ? "auto" : "smooth" });
  $("#tPrev").onclick = () => step(-1); $("#tNext").onclick = () => step(1);
  track.addEventListener("keydown", e => { if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); });

  /* Reveal, skill bars, counters */
  $$(".svc .card,.tools .card,.xp .card,.stats .card").forEach((el, i) => el.style.setProperty("--d", (i % 4) * .08 + "s"));
  $$("#pgrid .pcard").forEach((el, i) => el.style.setProperty("--d", (i % 3) * .08 + "s"));
  $$(".tool h3").forEach(h => h.dataset.p = h.nextElementSibling.dataset.level + "%");
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in"); io.unobserve(e.target);
    const bar = $(".bar", e.target); if (bar) $("span", bar).style.width = bar.dataset.level + "%";
  }), { threshold: .15 });
  $$(".rv").forEach(el => io.observe(el));

  /* Active nav link + header state + light parallax */
  const links = $$(".links a");
  const so = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle("act", a.getAttribute("href") === "#" + e.target.id)); }), { rootMargin: "-45% 0px -50% 0px" });
  $$("main section[id]").forEach(s => so.observe(s));
  const img = $(".arch img"), decos = $$(".deco");
  let t = false;
  addEventListener("scroll", () => { if (t) return; t = true; requestAnimationFrame(() => {
    t = false; nav.classList.toggle("sc", scrollY > 40);
    if (!reduce && scrollY < innerHeight) img.style.transform = `translateY(${scrollY * .06}px) scale(1.05)`;
  }); }, { passive: true });

  /* Service "Read more" pre-fills the contact subject */
  $$("[data-subject]").forEach(a => a.addEventListener("click", () => { $("#subject").value = a.dataset.subject.replace(/&amp;/g, "&"); }));

  /* Forms: validate, then send to ENDPOINT or open mail app */
  const bad = (f) => { const v = f.value.trim(); return f.required && (!v || (f.type === "email" && !/^\S+@\S+\.\S+$/.test(v))); };
  const submit = async (form, status, subject, body, okMsg) => {
    let ok = true;
    $$("input,textarea", form).forEach(f => { const b = bad(f); f.classList.toggle("bad", b); f.setAttribute("aria-invalid", b); ok = ok && !b; });
    status.classList.toggle("err", !ok);
    if (!ok) { status.textContent = "Please complete the highlighted fields with valid details."; return; }
    if (ENDPOINT) {
      try {
        const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
        if (!r.ok) throw 0;
        status.textContent = okMsg; form.reset();
      } catch { status.classList.add("err"); status.textContent = "Could not send right now. Please email me directly."; }
    } else {
      location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      status.textContent = "Opening your email app to send this. Thank you!"; form.reset();
    }
  };
  const cf = $("#form");
  cf.addEventListener("submit", e => { e.preventDefault(); const d = new FormData(cf);
    submit(cf, $("#status"), d.get("subject") || "Portfolio enquiry", `${d.get("message")}\n\n${d.get("name")}\n${d.get("email")}\n${d.get("phone") || ""}`, "Message sent. I'll reply soon!"); });
  const nl = $("#nl");
  nl.addEventListener("submit", e => { e.preventDefault(); submit(nl, $("#nlStatus"), "Newsletter subscription", `Please subscribe me: ${$("#nlMail").value}`, "You're subscribed. Thank you!"); });
})();
