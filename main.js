(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- 0. Live studio hours (America/New_York) ---------- */
  const HOURS = { 1: [10, 16], 2: [10, 16], 3: [10, 16], 4: [10, 16], 5: [10, 16], 6: [9, 13] };
  const fmt = h => (h > 12 ? h - 12 : h) + (h >= 12 ? ' PM' : ' AM');
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
    const get = t => parts.find(p => p.type === t).value;
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    const now = (+get('hour') % 24) + (+get('minute')) / 60;
    const el = document.querySelector('.js-open');
    const today = HOURS[day];
    if (el) {
      if (today && now >= today[0] && now < today[1]) {
        el.textContent = 'Open now · until ' + fmt(today[1]);
      } else {
        let d = day, tries = 0, label;
        do { d = (d + 1) % 7; tries++; } while (!HOURS[d] && tries < 7);
        if (today && now < today[0]) { d = day; label = 'today'; }
        else label = tries === 1 ? 'tomorrow' : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d];
        el.textContent = 'Closed now · opens ' + label + ' at ' + fmt(HOURS[d][0]);
        el.classList.add('is-closed');
      }
    }
    document.querySelectorAll('.hours [data-days]').forEach(r => {
      if (r.dataset.days.split(',').map(Number).includes(day)) r.classList.add('is-today');
    });
  } catch (e) { /* static hours stay visible */ }

  /* ---------- 1. Luxe index: floating image that trails the cursor ---------- */
  const float = document.querySelector('.float');
  const floatImg = float && float.querySelector('img');
  const rows = document.querySelectorAll('.index__row');
  if (float && fine && window.innerWidth > 760) {
    let x = 0, y = 0, tx = 0, ty = 0, raf = null, on = false, active = null, mx = 0;
    const place = () => {
      if (!active) return;
      const r = active.getBoundingClientRect(), h = float.offsetHeight, w = float.offsetWidth;
      ty = r.top - h - 14 > 90 ? r.top - h - 14 : r.bottom + 14;
      tx = Math.min(Math.max(mx - w / 2, 16), innerWidth - w - 140);
    };
    const tick = () => {
      x += (tx - x) * (reduce ? 1 : 0.14);
      y += (ty - y) * (reduce ? 1 : 0.14);
      float.style.transform = `translate(${x}px, ${y}px)`;
      raf = on || Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(tick) : null;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const idx = document.querySelector('.index');
    idx.addEventListener('mousemove', e => { mx = e.clientX; place(); kick(); });
    window.addEventListener('scroll', () => { if (on) { place(); kick(); } }, { passive: true });
    rows.forEach(row => {
      row.addEventListener('mouseenter', e => {
        const src = row.dataset.img;
        if (!floatImg.src.endsWith(src)) floatImg.src = src;
        active = row; mx = e.clientX; place();
        if (!on) { x = tx; y = ty; }
        on = true; float.classList.add('is-on'); kick();
      });
    });
    idx.addEventListener('mouseleave', () => { on = false; active = null; float.classList.remove('is-on'); });
    rows.forEach(r => { const i = new Image(); i.src = r.dataset.img; });
  }

  /* ---------- 2. Feed: pinned horizontal scroll ---------- */
  const track = document.querySelector('.feed__track');
  const count = document.querySelector('.js-count');
  const plates = track ? [...track.querySelectorAll('figure.plate')] : [];
  let pinProg = null;
  const setCount = () => {
    const head = document.querySelector('.feed__head').getBoundingClientRect();
    const left = head.right > 0 && head.right < innerWidth * 0.5 && head.top < innerHeight * 0.5 ? head.right : 0;
    const mid = (left + innerWidth) / 2;
    let i = 0, best = Infinity;
    plates.forEach((p, n) => { const r = p.getBoundingClientRect(); const d = Math.abs(r.left + r.width / 2 - mid); if (d < best) { best = d; i = n; } });
    if (pinProg !== null) { if (pinProg < 0.03) i = 0; else if (pinProg > 0.97) i = plates.length - 1; }
    if (count) count.textContent = String(i + 1).padStart(2, '0');
  };
  if (track) track.addEventListener('scroll', setCount, { passive: true });

  const initGsap = () => {
    if (!window.gsap || !window.ScrollTrigger || reduce || !track) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add('(min-width: 761px)', () => {
      track.style.overflow = 'visible';
      const dist = () => Math.max(0, track.scrollWidth - track.clientWidth);
      const tween = gsap.to(track, {
        x: () => -dist(),
        ease: 'none',
        onUpdate() { pinProg = this.progress(); setCount(); },
        scrollTrigger: { trigger: '.feed', pin: '.feed__pin', start: 'top top', end: () => '+=' + dist(), scrub: 0.6, invalidateOnRefresh: true }
      });
      return () => { track.style.overflow = ''; tween.kill(); };
    });
    window.addEventListener('load', () => ScrollTrigger.refresh());
  };
  if (document.readyState === 'complete') initGsap(); else window.addEventListener('load', initGsap);

  /* ---------- smooth in-page anchors ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href'); const t = id.length > 1 && document.querySelector(id);
    if (!t) return; e.preventDefault();
    t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    history.replaceState(null, '', id);
  }));

  /* ---------- 3. Wedding inquiry (front-end only; wire to Netlify Forms) ---------- */
  const form = document.querySelector('.form');
  const sent = document.querySelector('.sent');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!form.name.value.trim() || !form.email.value || !form.email.checkValidity()) {
        form.classList.add('is-error');
        (form.name.value.trim() ? form.email : form.name).focus();
        return;
      }
      const first = form.name.value.trim().split(/\s|&|and/)[0];
      sent.querySelector('.js-name').textContent = first ? ', ' + first : '';
      const d = new Date(); let added = 0;
      while (added < 2) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) added++; }
      sent.querySelector('.js-day').textContent = d.toLocaleDateString('en-US', { weekday: 'long' });
      form.hidden = true; sent.hidden = false;
      sent.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    });
  }
})();
