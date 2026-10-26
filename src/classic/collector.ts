/** Original vertical collector. Music analysis drives spawning; no recorded audio or assets. */
type Point = { x: number; y: number };
type Shape = Point & {
  radius: number;
  hue: number;
  sides: number;
  hazard: boolean;
  angle: number;
  done?: boolean;
  motif?: number;
  vx?: number;
  vy?: number;
  drift?: number;
  pushed?: boolean;
  waveId?: number;
};
type Tail = Point & { age: number };
type Particle = Point & {
  vx: number;
  vy: number;
  age: number;
  red: boolean;
  hue?: number;
};
export function createCollector(onPulse: () => void = () => {}) {
  const run = {
    x: 0.5,
    y: 0.7,
    targetX: 0.5,
    targetY: 0.7,
    score: 0,
    best: 0,
    mass: 3,
    combo: 0,
    gathered: 0,
    pickupFlash: 0,
    beatFlash: 0,
    coreMotion: 0,
    celebration: 0,
    celebrationPower: 0,
    arriving: false,
    explosion: null as (Point & { age: number }) | null,
    invulnerable: 0,
    respawn: 0,
    slow: 0,
    charge: 0,
    cooldown: 0,
    speed: 0.3,
    energy: 0,
    time: 0,
    distance: 0,
    sequence: 0,
    held: false,
    objects: [] as Shape[],
    tail: [] as Tail[],
    particles: [] as Particle[],
    waves: [] as (Point & { age: number; radius: number; id: number })[],
    blooms: [] as (Point & { age: number; radius: number; hue: number })[],
  };
  let waveSequence = 0;
  let width = 960,
    height = 600;
  const clamp = (v: number, a: number, b: number) =>
    Math.max(a, Math.min(b, v));
  const radius = () => 6 + Math.sqrt(run.mass) * 3;
  const trailLife = () => Math.min(2.4, 0.22 + run.gathered * 0.045);
  const trailCount = () => Math.min(32, 1 + Math.floor(run.gathered / 50));
  const trailPoint = (p: Tail, branch: number): Point => ({
    x:
      p.x +
      (branch === 0 ? 0 : (branch % 2 ? -1 : 1) * Math.ceil(branch / 2)) *
        Math.min(1, p.age) *
        Math.min(0.035, 0.26 / Math.ceil(trailCount() / 2)),
    y: p.y,
  });
  function burst(x: number, y: number, red = false, count = 12, hue = 170) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2,
        v = 0.04 + Math.random() * (red ? 0.45 : 0.17);
      run.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        age: 0,
        red,
        hue,
      });
    }
  }
  function die() {
    burst(run.x, run.y, true, 110);
    run.explosion = { x: run.x, y: run.y, age: 0 };
    run.pickupFlash = 0;
    run.respawn = 1.6;
    run.gathered = 0;
    run.combo = 0;
    run.waves = [];
    run.mass = 0;
    run.charge = 0;
    run.held = false;
    run.tail = [];
  }
  function collect(o: Shape) {
    if (o.done) return;
    o.done = true;
    run.combo++;
    run.gathered++;
    run.pickupFlash = 1;
    run.score +=
      (o.radius < 58 ? 30 : 10) * Math.min(5, 1 + Math.floor(run.combo / 15));
    run.best = Math.max(run.best, run.score);
    run.mass = Math.min(16, run.mass + 0.21);
    burst(o.x, o.y, false, 28, o.hue);
    run.blooms.push({ x: o.x, y: o.y, age: 0, radius: o.radius, hue: o.hue });
    run.blooms = run.blooms.slice(-24);
  }
  function hit(o: Shape) {
    o.done = true;
    burst(o.x, o.y, true, 35);
    if (run.invulnerable > 0 || run.respawn > 0) return;
    die();
  }
  function release() {
    if (run.respawn || run.cooldown || run.celebration) {
      run.charge = 0;
      return;
    }
    run.waves.push({
      x: run.x,
      y: run.y,
      age: 0,
      id: ++waveSequence,
      radius: 0.33 * Math.min(width, height),
    });
    run.cooldown = 2.7;
    run.charge = 0;
    onPulse();
  }
  function tailDistance(o: Point, a: Point, b: Point) {
    const dx = (b.x - a.x) * width,
      dy = (b.y - a.y) * height;
    const u = clamp(
      ((o.x - a.x) * width * dx + (o.y - a.y) * height * dy) /
        (dx * dx + dy * dy || 1),
      0,
      1,
    );
    return Math.hypot(
      (o.x - a.x) * width - u * dx,
      (o.y - a.y) * height - u * dy,
    );
  }
  function beat(band: number, energy: number) {
    if (run.celebration > 0) return;
    run.beatFlash = clamp(energy * 3, 0.15, 1);
    const unlocked = Math.min(8, 4 + Math.max(0, trailCount() - 1));
    const i = run.sequence++,
      complex = energy > 0.22,
      x = clamp(
        0.5 + 0.3 * Math.sin(i * 0.27) + 0.08 * Math.sin(i * 0.61),
        0.08,
        0.92,
      );
    run.objects.push({
      x,
      y: -0.06,
      radius: complex ? 43 + (i % 3) * 7 : 72 + (i % 3) * 10,
      hue: [315, 45, 190, 135, 195, 275, 30, 165][i % unlocked] + band * 2,
      motif: i % unlocked,
      sides: complex ? 5 : 3 + (i % 4),
      hazard: false,
      angle: i * 0.6,
    });
    // Red mines are separate, clearly marked, and never occupy a collectible's path.
    if (
      i > 5 &&
      i %
        Math.max(
          2,
          (complex ? 5 : 9) - Math.floor((Math.min(10, trailCount()) - 1) / 2),
        ) ===
        0
    )
      run.objects.push({
        x: clamp(x + (x > 0.5 ? -0.32 : 0.32), 0.08, 0.92),
        y: -0.12,
        radius: trailCount() >= 5 && i % 2 === 0 ? 90 : 65,
        motif: trailCount() >= 5 && i % 2 === 0 ? 1 : 0,
        drift:
          trailCount() >= 3
            ? (i % 2 ? -1 : 1) * (0.06 + Math.min(10, trailCount()) * 0.008)
            : 0,
        hue: 0,
        sides: 8,
        hazard: true,
        angle: 0,
      });
    if (complex && i % 4 === 0)
      run.objects.push({
        x: clamp(x + 0.12, 0.08, 0.92),
        y: -0.1,
        radius: 41,
        hue: 190,
        motif: 2,
        sides: 3,
        hazard: false,
        angle: 0,
      });
    run.objects = run.objects.slice(-100);
  }
  function reset() {
    Object.assign(run, {
      x: 0.5,
      y: 0.7,
      targetX: 0.5,
      targetY: 0.7,
      score: 0,
      mass: 3,
      combo: 0,
      gathered: 0,
      pickupFlash: 0,
      beatFlash: 0,
      coreMotion: 0,
      celebration: 0,
      celebrationPower: 0,
      arriving: false,
      explosion: null,
      invulnerable: 1.5,
      respawn: 0,
      slow: 0,
      charge: 0,
      cooldown: 0,
      speed: 0.3,
      energy: 0,
      time: 0,
      distance: 0,
      sequence: 0,
      held: false,
      objects: [],
      tail: [],
      particles: [],
      waves: [],
      blooms: [],
    });
  }
  function nextTrack(completed: boolean) {
    if (completed && run.respawn === 0 && run.mass > 0) {
      run.celebration = 3;
      run.celebrationPower = trailCount();
      run.arriving = false;
      run.objects = [];
      run.waves = [];
      run.held = false;
    } else reset();
  }
  function transitionFade() {
    if (run.celebration <= 0) return 0;
    const elapsed = 3 - run.celebration;
    return clamp(Math.min((elapsed - 1.05) / 0.55, (3 - elapsed) / 1.25), 0, 1);
  }
  function step(
    dt: number,
    active: boolean,
    bpm: number,
    energy: number,
    held: boolean,
  ) {
    if (!active) {
      run.held = false;
      run.charge = 0;
      return;
    }
    run.time += dt;
    if (run.celebration > 0) {
      run.celebration = Math.max(0, run.celebration - dt);
      if (!run.arriving && run.celebration < 1.35) {
        const remaining = run.celebration,
          power = run.celebrationPower;
        reset();
        run.celebration = remaining;
        run.celebrationPower = power;
        run.arriving = true;
        run.y = 0.95;
        run.targetY = 0.72;
        run.invulnerable = 2;
      }
    }
    for (const bloom of run.blooms) bloom.age += dt;
    run.blooms = run.blooms.filter((b) => b.age < 0.85).slice(-24);
    run.beatFlash = Math.max(0, run.beatFlash - dt * 3.5);
    run.coreMotion +=
      (clamp(energy * 2.4 + run.beatFlash * 0.4, 0, 1) - run.coreMotion) *
      (1 - Math.exp(-dt * 9));
    run.pickupFlash = Math.max(0, run.pickupFlash - dt * 4);
    if (run.explosion && (run.explosion.age += dt) > 1.3) run.explosion = null;
    run.invulnerable = Math.max(0, run.invulnerable - dt);
    run.cooldown = Math.max(0, run.cooldown - dt);
    run.slow = Math.max(0, run.slow - dt);
    run.energy +=
      (clamp(energy * 2, 0, 1) - run.energy) * (1 - Math.exp(-dt * 1.4));
    const speed =
      ((0.33 * clamp(bpm, 70, 170)) / 108) *
      (1 + run.energy * 0.42) *
      (1 + (Math.min(10, trailCount()) - 1) * 0.07) *
      (run.slow > 0 ? 0.45 + 0.55 * (1 - run.slow / 2.4) : 1);
    run.speed += (speed - run.speed) * (1 - Math.exp(-dt * 2));
    run.distance += run.speed * dt;
    if (run.celebration > 0) {
      run.targetX = 0.5;
      run.targetY = run.arriving ? 0.72 : -0.4;
      run.x += (0.5 - run.x) * (1 - Math.exp(-dt * 3));
      if (run.arriving) run.y += (0.72 - run.y) * (1 - Math.exp(-dt * 3));
      else run.y -= dt * (0.25 + (3 - run.celebration) * 1.5);
    } else {
      run.x += (run.targetX - run.x) * (1 - Math.exp(-dt * 15));
      run.y += (run.targetY - run.y) * (1 - Math.exp(-dt * 15));
    }
    if (run.respawn > 0) {
      run.respawn -= dt;
      if (run.respawn <= 0) {
        run.respawn = 0;
        run.mass = 3;
        run.x = run.targetX = 0.5;
        run.y = run.targetY = 0.86;
        run.combo = 0;
        run.invulnerable = 3.5;
        run.tail = [];
      }
    }
    if (!run.respawn) {
      if (held && !run.held) release();
    } else run.charge = 0;
    run.held = held;
    for (const w of run.waves) w.age += dt;
    const branches = run.respawn
      ? []
      : Array.from({ length: trailCount() }, (_, branch) => {
          const points = run.tail.map((p) => trailPoint(p, branch));
          let left = Infinity,
            right = -Infinity,
            top = Infinity,
            bottom = -Infinity;
          for (const p of points) {
            left = Math.min(left, p.x);
            right = Math.max(right, p.x);
            top = Math.min(top, p.y);
            bottom = Math.max(bottom, p.y);
          }
          return { points, left, right, top, bottom };
        });
    for (const o of run.objects) {
      o.x += ((o.vx ?? 0) + (o.drift ?? 0)) * dt;
      o.y += (run.speed + (o.vy ?? 0)) * dt;
      o.vx = (o.vx ?? 0) * Math.exp(-dt * 1.8);
      o.vy = (o.vy ?? 0) * Math.exp(-dt * 1.8);
      if (o.drift && (o.x < 0.1 || o.x > 0.9)) {
        o.drift *= -1;
        o.x = clamp(o.x, 0.1, 0.9);
      }
      o.angle += dt * 0.45;
      if (!run.respawn) {
        if (
          !o.done &&
          Math.hypot((o.x - run.x) * width, (o.y - run.y) * height) <
            o.radius * 0.75 + radius()
        ) {
          if (o.hazard) hit(o);
          else collect(o);
        }
        for (const w of run.waves) {
          const dx = (o.x - w.x) * width,
            dy = (o.y - w.y) * height;
          const distance = Math.hypot(dx, dy);
          if (
            !o.done &&
            o.waveId !== w.id &&
            distance < w.radius * Math.min(1, w.age / 0.5) + o.radius
          ) {
            const angle = distance > 0.001 ? Math.atan2(dy, dx) : -Math.PI / 2;
            // A single impulse per wave. Neither collect nor destroy anything.
            o.vx = (Math.cos(angle) * 1200) / width;
            o.vy = (Math.sin(angle) * 1200) / height;
            o.waveId = w.id;
            o.pushed = true;
          }
        }
        // Every visible branch collects colors and safely detonates red mines.
        if (!o.done && !run.respawn) {
          const reach = o.radius * 0.7 + 3 + run.mass * 0.3;
          const rx = reach / width,
            ry = reach / height;
          for (const branch of branches) {
            if (o.done) break;
            if (
              o.x < branch.left - rx ||
              o.x > branch.right + rx ||
              o.y < branch.top - ry ||
              o.y > branch.bottom + ry
            )
              continue;
            for (let i = 1; i < branch.points.length; i++) {
              const a = branch.points[i - 1],
                b = branch.points[i];
              if (
                o.x < Math.min(a.x, b.x) - rx ||
                o.x > Math.max(a.x, b.x) + rx ||
                o.y < Math.min(a.y, b.y) - ry ||
                o.y > Math.max(a.y, b.y) + ry
              )
                continue;
              if (tailDistance(o, a, b) < reach) {
                if (o.hazard) {
                  o.done = true;
                  burst(o.x, o.y, true, 35);
                } else collect(o);
                break;
              }
            }
          }
        }
      }
      if (!o.done && o.y - o.radius / height > 1) {
        o.done = true;
        if (!o.hazard && !run.respawn && !o.pushed) {
          run.score -= 15;
          run.combo = 0;
          // A missed collectible costs score only. Only red mines damage the core.
        }
      }
    }
    run.objects = run.objects.filter((o) => !o.done);
    run.waves = run.waves.filter((w) => w.age < 0.75);
    for (const k of run.tail) {
      k.age += dt;
      k.y += run.speed * dt * 0.85;
    }
    if (!run.respawn) run.tail.push({ x: run.x, y: run.y, age: 0 });
    run.tail = run.tail.filter((k) => k.age < trailLife()).slice(-180);
    for (const k of run.particles) {
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      k.age += dt;
    }
    run.particles = run.particles.filter((k) => k.age < 0.9).slice(-400);
  }
  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    width = w;
    height = h;
    const dot = (
      x: number,
      y: number,
      r: number,
      color: string | CanvasGradient,
    ) => {
      ctx.beginPath();
      ctx.arc(x * w, y * h, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    };
    // Three downward-moving layers establish upward flight without moving the camera.
    for (let i = 0; i < 90; i++) {
      const layer = i % 3;
      const x = (i * 0.618033) % 1;
      const y = (i * 0.3819 + run.distance * (0.65 + layer * 0.8)) % 1;
      const size = 0.9 + layer * 0.65;
      const opacity = 0.18 + layer * 0.11;
      const length = (3 + layer * 5) * (0.7 + run.speed * 2);
      ctx.beginPath();
      ctx.moveTo(x * w, y * h - length);
      ctx.lineTo(x * w, y * h);
      ctx.lineWidth = size;
      ctx.strokeStyle = `rgba(176,223,255,${opacity})`;
      ctx.stroke();
      dot(x, y, size, `rgba(210,242,255,${opacity + 0.12})`);
    }
    for (const o of run.objects) {
      ctx.save();
      ctx.translate(o.x * w, o.y * h);
      ctx.rotate(o.hazard ? o.angle : Math.sin(o.angle) * 0.12);
      const r = o.radius;
      ctx.beginPath();
      if (!o.hazard && o.motif === 0) {
        ctx.moveTo(0, r * 0.85);
        ctx.bezierCurveTo(-r * 1.35, 0, -r, -r, -r * 0.45, -r * 0.7);
        ctx.bezierCurveTo(-r * 0.2, -r * 0.7, 0, -r * 0.4, 0, -r * 0.25);
        ctx.bezierCurveTo(
          r * 0.35,
          -r * 1.1,
          r * 1.1,
          -r * 0.7,
          r * 0.85,
          -r * 0.1,
        );
        ctx.bezierCurveTo(r * 0.7, r * 0.3, r * 0.3, r * 0.6, 0, r * 0.85);
      } else if (!o.hazard && (o.motif === 4 || o.motif === 5)) {
        ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
      } else if (!o.hazard && o.motif === 6) {
        ctx.roundRect(-r, -r * 0.65, r * 2, r * 1.3, r * 0.18);
      } else if (!o.hazard && o.motif === 7) {
        ctx.ellipse(
          -r * 0.28,
          r * 0.48,
          r * 0.34,
          r * 0.22,
          -0.3,
          0,
          Math.PI * 2,
        );
      } else if (o.hazard && o.motif === 1) {
        // Armored, jagged diamond. Its circular hit area stays clear and readable.
        for (let i = 0; i < 16; i++) {
          const a = (i * Math.PI) / 8;
          const length = r * (i % 4 === 0 ? 1 : 0.65);
          i
            ? ctx.lineTo(Math.cos(a) * length, Math.sin(a) * length)
            : ctx.moveTo(length, 0);
        }
      } else if (!o.hazard && o.motif === 3) {
        // Four soft lobes form a clover, distinct from the sharp hazards.
        for (let i = 0; i <= 100; i++) {
          const a = (i / 100) * Math.PI * 2;
          const length = r * (0.64 + 0.28 * Math.cos(a * 4));
          const x = Math.cos(a) * length,
            y = Math.sin(a) * length;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
      } else {
        const points = o.hazard ? 16 : o.motif === 1 ? 24 : 10;
        for (let i = 0; i < points; i++) {
          const a = (i / points) * Math.PI * 2 - Math.PI / 2;
          const length =
            r * (i % 2 ? (o.hazard ? 0.55 : o.motif === 1 ? 0.7 : 0.45) : 1);
          const x = Math.cos(a) * length,
            y = Math.sin(a) * length;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fillStyle = o.hazard ? '#781c35cc' : `hsla(${o.hue},75%,48%,.5)`;
      ctx.fill();
      ctx.strokeStyle = o.hazard ? '#ff627f' : `hsl(${o.hue},90%,78%)`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      if (!o.hazard && (o.motif === 4 || o.motif === 5)) {
        for (const scale of o.motif === 5
          ? [0.18, 0.35, 0.55, 0.72]
          : [0.16, 0.25, 0.75]) {
          ctx.beginPath();
          ctx.arc(0, 0, r * scale, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (o.motif === 4) {
          ctx.fillStyle = '#ffffff55';
          ctx.beginPath();
          ctx.moveTo(r * 0.24, 0);
          ctx.lineTo(r * 0.8, -r * 0.3);
          ctx.arc(0, 0, r * 0.85, -0.35, 0.05);
          ctx.closePath();
          ctx.fill();
        }
      } else if (!o.hazard && o.motif === 6) {
        ctx.beginPath();
        ctx.roundRect(-r * 0.75, -r * 0.35, r * 1.5, r * 0.55, r * 0.12);
        ctx.stroke();
        for (const x of [-0.45, 0.45]) {
          ctx.beginPath();
          ctx.arc(x * r, -r * 0.08, r * 0.16, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, r * 0.58);
        ctx.lineTo(-r * 0.4, r * 0.3);
        ctx.lineTo(r * 0.4, r * 0.3);
        ctx.lineTo(r * 0.6, r * 0.58);
        ctx.stroke();
      } else if (!o.hazard && o.motif === 7) {
        ctx.lineWidth = r * 0.12;
        ctx.beginPath();
        ctx.moveTo(0, r * 0.45);
        ctx.lineTo(0, -r * 0.8);
        ctx.bezierCurveTo(r * 0.1, -r * 0.4, r * 0.85, -r * 0.5, r * 0.4, 0);
        ctx.stroke();
      } else if (o.hazard) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.2, -r * 0.2);
        ctx.lineTo(r * 0.2, r * 0.2);
        ctx.moveTo(r * 0.2, -r * 0.2);
        ctx.lineTo(-r * 0.2, r * 0.2);
        ctx.lineWidth = 4;
        ctx.stroke();
      } else if (o.motif === 1) {
        // The sun smiles, even when the track's album palette is dark.
        ctx.fillStyle = '#ffe69c';
        for (const x of [-0.2, 0.2]) {
          ctx.beginPath();
          ctx.arc(x * r, -r * 0.12, r * 0.045, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.3, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.lineCap = 'round';
    // Batch fading segments into eight paths per branch instead of thousands
    // of individual canvas strokes at the maximum trail count.
    const buckets: number[][] = Array.from({ length: 8 }, () => []);
    for (let i = 1; i < run.tail.length; i++) {
      const alpha = clamp(1 - run.tail[i].age / trailLife(), 0, 1);
      buckets[Math.min(7, Math.floor(alpha * 8))].push(i);
    }
    for (let branch = 0; branch < trailCount(); branch++) {
      const points = run.tail.map((p) => trailPoint(p, branch));
      for (let bucket = 0; bucket < 8; bucket++) {
        if (!buckets[bucket].length) continue;
        const alpha = (bucket + 0.5) / 8;
        for (const glow of [true, false]) {
          ctx.beginPath();
          for (const i of buckets[bucket]) {
            const a = points[i - 1],
              b = points[i];
            ctx.moveTo(a.x * w, a.y * h);
            ctx.lineTo(b.x * w, b.y * h);
          }
          ctx.lineWidth =
            (2 + run.mass * 0.35 + run.energy * 3) * (glow ? 4 : 1);
          ctx.strokeStyle = `hsla(${170 + Math.floor(run.gathered / 25) * 35 + branch * 65},85%,75%,${alpha * (glow ? 0.08 : 0.8)})`;
          ctx.stroke();
        }
      }
    }
    for (const wave of run.waves) {
      const fade = Math.max(0, 1 - wave.age / 0.75);
      const front = wave.radius * Math.min(1, wave.age / 0.5);
      // Layered radial waveform, using the current music energy for its ripples.
      for (let layer = 0; layer < 4; layer++) {
        ctx.beginPath();
        for (let i = 0; i <= 160; i++) {
          const angle = (i / 160) * Math.PI * 2;
          const ripple =
            Math.sin(angle * 18 + run.time * 12 + layer) *
            (3 + run.energy * 12) *
            fade;
          const radius = Math.max(0, front - layer * 12 + ripple);
          const x = wave.x * w + Math.cos(angle) * radius,
            y = wave.y * h + Math.sin(angle) * radius;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = `hsla(${175 + layer * 22},100%,80%,${fade * (0.8 - layer * 0.15)})`;
        ctx.lineWidth = layer === 0 ? 4 : 2;
        ctx.stroke();
      }
    }
    for (const bloom of run.blooms) {
      const fade = 1 - bloom.age / 0.85;
      const radius = bloom.radius * (0.4 + bloom.age * 1.5);
      const gradient = ctx.createRadialGradient(
        bloom.x * w,
        bloom.y * h,
        0,
        bloom.x * w,
        bloom.y * h,
        radius,
      );
      gradient.addColorStop(0, `hsla(${bloom.hue},100%,85%,${fade * 0.55})`);
      gradient.addColorStop(1, `hsla(${bloom.hue},100%,65%,0)`);
      dot(bloom.x, bloom.y, radius, gradient);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + bloom.age;
        const x = bloom.x * w + Math.cos(a) * radius,
          y = bloom.y * h + Math.sin(a) * radius;
        ctx.strokeStyle = `hsla(${bloom.hue},100%,85%,${fade})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 6 * fade, y);
        ctx.lineTo(x + 6 * fade, y);
        ctx.moveTo(x, y - 6 * fade);
        ctx.lineTo(x, y + 6 * fade);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    if (run.charge > 0) {
      ctx.setLineDash([3, 8]);
      ctx.beginPath();
      ctx.arc(
        run.x * w,
        run.y * h,
        (0.1 + 0.23 * run.charge) * Math.min(w, h),
        0,
        Math.PI * 2,
      );
      ctx.strokeStyle = '#d5fff266';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const k of run.particles) {
      ctx.globalAlpha = 1 - k.age / 0.9;
      dot(
        k.x,
        k.y,
        k.red ? 3 : 3.5,
        k.red ? '#ff7488' : `hsl(${k.hue ?? 170},100%,80%)`,
      );
    }
    ctx.globalAlpha = 1;
    if (run.explosion) {
      const e = run.explosion,
        fade = Math.max(0, 1 - e.age / 1.3);
      for (const scale of [1, 0.65]) {
        ctx.beginPath();
        ctx.arc(e.x * w, e.y * h, (20 + e.age * 200) * scale, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,${Math.round(100 + scale * 100)},110,${fade})`;
        ctx.lineWidth = 8 * fade;
        ctx.stroke();
      }
    }
    if (!run.respawn) {
      ctx.globalAlpha =
        run.invulnerable > 0
          ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(run.time * 24))
          : 1;
      ctx.shadowColor = '#a6fff0';
      ctx.shadowBlur = 18 + run.mass + run.pickupFlash * 30;
      const pulseRadius =
        radius() * (1 + run.pickupFlash * 0.4 + run.coreMotion * 0.25);
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const angle = (i / 64) * Math.PI * 2;
        const ripple =
          run.coreMotion * 0.14 * Math.sin(angle * 5 + run.time * 2) +
          run.beatFlash * 0.045 * Math.sin(angle * 3 - run.time);
        const r = pulseRadius * (1 + ripple);
        const x = run.x * w + Math.cos(angle) * r,
          y = run.y * h + Math.sin(angle) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = run.pickupFlash > 0.3 ? '#fff1ad' : '#a4f0e4';
      ctx.fill();
      // The core's collision radius remains stable while its outline reacts to music.
      const ready = run.cooldown <= 0 && run.celebration <= 0;
      const ringRadius = pulseRadius * 1.2 + 7;
      ctx.shadowBlur = ready ? 12 : 0;
      ctx.strokeStyle = '#a6fff033';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(run.x * w, run.y * h, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      if (run.celebration <= 0) {
        ctx.strokeStyle = ready ? '#d6fff2' : '#68c8cc';
        ctx.lineWidth = ready ? 2.5 : 2;
        ctx.beginPath();
        ctx.arc(
          run.x * w,
          run.y * h,
          ringRadius,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * clamp(1 - run.cooldown / 2.7, 0, 1),
        );
        ctx.stroke();
        if (ready)
          for (let i = 0; i < 3; i++) {
            const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
            dot(
              run.x + (Math.cos(a) * ringRadius) / w,
              run.y + (Math.sin(a) * ringRadius) / h,
              2.5,
              '#ffffff',
            );
          }
      }
      dot(run.x, run.y, radius() * 0.45, '#f0fffc');
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }
  reset();
  return {
    run,
    reset,
    nextTrack,
    transitionFade,
    beat,
    step,
    draw,
    trailCount,
    trailLife,
    pulse: release,
  };
}
