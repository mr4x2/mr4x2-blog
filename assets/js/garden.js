const BEE_KEY = "mk-garden-bee";
// Bee pacing, the garden's version of the typing speed in intro.js.
const WANDER_PX_PER_S = 120;
const WANDER_MIN_MS = 700;
const REST_MIN_MS = 1500;
const REST_MAX_MS = 4000;
const WANDERERS = 3;
// The follower is a spring in Apple's terms: it reaches the pointer in about half a second and overshoots a little.
const FOLLOW_RESPONSE_S = 0.5;
const FOLLOW_DAMPING = 0.75;
// It flies beside the pointer, never under it, so it never hides what the reader points at.
const FOLLOW_OFFSET = 18;
// A margin narrower than this has no room for a bee beside the text.
const GUTTER_MIN = 64;
const EDGE = 16;

const root = document.documentElement;
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
let stopGarden = null;

export function syncGarden(origin) {
  const garden = document.querySelector(".garden");
  if (!garden) return;
  stopGarden?.();
  stopGarden = root.hasAttribute("data-garden")
    ? startGarden(garden, origin)
    : null;
}

export function initGarden() {
  reduce.addEventListener("change", () => syncGarden());
  syncGarden();
}

function startGarden(garden, origin) {
  const air = garden.querySelector(".garden-air");
  const bed = garden.querySelector(".garden-bed");
  const template = garden.querySelector("[data-garden-bee]");
  const flowers = [...garden.querySelectorAll(".flower")];
  const ease = getComputedStyle(root).getPropertyValue("--ease-in-out").trim();
  const timers = new Set();
  const listeners = [];
  const wanderers = [];

  const rand = (min, max) => min + Math.random() * (max - min);
  const later = (ms, fn) => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };
  const listen = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);
    listeners.push(() => target.removeEventListener(type, fn, options));
  };
  const makeBee = () => {
    const bee = template.content.firstElementChild.cloneNode(true);
    air.append(bee);
    return bee;
  };
  const place = (bee, p) => {
    bee.style.transform = `translate(${p.x}px, ${p.y}px)`;
  };
  // A bee lands just above the flower's head, 10 units down its 44-unit drawing.
  const onFlower = (flower) => {
    const r = flower.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + (r.height * 10) / 44 - 6 };
  };
  const anyFlower = () => flowers[Math.floor(Math.random() * flowers.length)];

  // Bees stay out of the text column: they use the flower bed, and the margins beside the column when there are any.
  const pickTarget = () => {
    const col = document.querySelector("main").getBoundingClientRect();
    const top =
      document.querySelector(".site-header").getBoundingClientRect().bottom +
      EDGE;
    const bottom = innerHeight - bed.offsetHeight - EDGE;
    const sides = [];
    if (col.left >= GUTTER_MIN)
      sides.push({ side: "left", min: EDGE, max: col.left - EDGE });
    if (innerWidth - col.right >= GUTTER_MIN)
      sides.push({
        side: "right",
        min: col.right + EDGE,
        max: innerWidth - EDGE,
      });
    if (sides.length && bottom > top && Math.random() < 0.4) {
      const s = sides[Math.floor(Math.random() * sides.length)];
      return { x: rand(s.min, s.max), y: rand(top, bottom), side: s.side };
    }
    return { ...onFlower(anyFlower()), side: null };
  };
  // Between a margin and anywhere else, a bee drops into the bed first, so its path never crosses the text.
  const route = (from, to) => {
    const bedY = innerHeight - bed.offsetHeight / 2;
    const points = [from];
    if (from.side && from.side !== to.side) points.push({ x: from.x, y: bedY });
    if (to.side && to.side !== from.side) points.push({ x: to.x, y: bedY });
    points.push(to);
    return points;
  };

  const rest = (bee) =>
    later(rand(REST_MIN_MS, REST_MAX_MS), () => fly(bee, pickTarget()));
  const fly = (bee, to) => {
    const points = route(bee.at, to);
    const legs = points
      .slice(1)
      .map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
    const length = legs.reduce((a, b) => a + b, 0);
    if (length < 1) return rest(bee);
    let travelled = 0;
    const frames = points.map((p, i) => {
      if (i) travelled += legs[i - 1];
      return {
        transform: `translate(${p.x}px, ${p.y}px)`,
        offset: travelled / length,
      };
    });
    bee.classList.toggle("is-right", to.x > bee.at.x);
    bee.classList.add("is-flying");
    bee.at = to;
    place(bee, to);
    bee
      .animate(frames, {
        duration: Math.max(WANDER_MIN_MS, (length / WANDER_PX_PER_S) * 1000),
        easing: ease,
      })
      .finished.then(
        () => {
          bee.classList.remove("is-flying");
          rest(bee);
        },
        () => {},
      );
  };

  const picked = [...flowers]
    .sort(() => Math.random() - 0.5)
    .slice(0, WANDERERS);
  for (const flower of picked) {
    const bee = makeBee();
    bee.at = { ...onFlower(flower), side: null };
    place(bee, bee.at);
    wanderers.push(bee);
    if (!reduce.matches) rest(bee);
  }

  let raf = 0;
  let wake = () => {};
  if (!reduce.matches) {
    const follower = makeBee();
    const inner = follower.firstElementChild;
    follower.classList.add("garden-follower");
    let saved = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(BEE_KEY));
    } catch {}
    // A new garden's bee starts beside the button that turned it on, as if the pointer were there.
    const p = origin
      ? { x: origin.x + FOLLOW_OFFSET, y: origin.y + FOLLOW_OFFSET }
      : (saved ?? onFlower(flowers[Math.floor(flowers.length / 2)]));
    p.x = Math.min(Math.max(p.x, EDGE), innerWidth - EDGE);
    p.y = Math.min(Math.max(p.y, EDGE), innerHeight - EDGE);
    const v = { x: 0, y: 0 };
    let target = { x: p.x, y: p.y };
    let facingRight = false;
    let last = 0;
    const stiffness = ((2 * Math.PI) / FOLLOW_RESPONSE_S) ** 2;
    const damping = (4 * Math.PI * FOLLOW_DAMPING) / FOLLOW_RESPONSE_S;
    place(follower, p);

    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      for (const axis of ["x", "y"]) {
        v[axis] +=
          (stiffness * (target[axis] - p[axis]) - damping * v[axis]) * dt;
        p[axis] += v[axis] * dt;
      }
      place(follower, p);
      const speed = Math.hypot(v.x, v.y);
      if (Math.abs(v.x) > 30) facingRight = v.x > 0;
      const tilt = Math.max(-25, Math.min(25, -v.y / 40));
      inner.style.transform = `scaleX(${facingRight ? -1 : 1}) rotate(${tilt}deg)`;
      follower.classList.toggle("is-flying", speed > 20);
      if (speed < 4 && Math.hypot(target.x - p.x, target.y - p.y) < 0.5) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(step);
    };
    wake = () => {
      if (raf || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(step);
    };
    const aim = (x, y) => {
      target = { x, y };
      wake();
    };
    listen(
      window,
      "pointermove",
      (e) => {
        if (e.pointerType === "touch") return;
        aim(e.clientX + FOLLOW_OFFSET, e.clientY + FOLLOW_OFFSET);
      },
      { passive: true },
    );
    // A touch screen has no hover, so a tap calls the bee, which stops above the finger.
    listen(
      window,
      "pointerdown",
      (e) => {
        if (e.pointerType === "touch")
          aim(e.clientX, e.clientY - 2 * FOLLOW_OFFSET);
      },
      { passive: true },
    );
    // The next page puts the bee back where it was, so it seems to fly on across pages.
    listen(window, "pagehide", () => {
      try {
        sessionStorage.setItem(BEE_KEY, JSON.stringify({ x: p.x, y: p.y }));
      } catch {}
    });
  }

  listen(document, "visibilitychange", () => {
    if (document.hidden) {
      for (const a of air.getAnimations({ subtree: true })) a.pause();
      for (const t of timers) clearTimeout(t);
      timers.clear();
      cancelAnimationFrame(raf);
      raf = 0;
      return;
    }
    for (const a of air.getAnimations({ subtree: true })) a.play();
    if (reduce.matches) return;
    for (const bee of wanderers)
      if (!bee.classList.contains("is-flying")) rest(bee);
    wake();
  });

  return () => {
    for (const t of timers) clearTimeout(t);
    cancelAnimationFrame(raf);
    for (const off of listeners) off();
    air.replaceChildren();
  };
}
