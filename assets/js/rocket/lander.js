/*
 * This is a simple moon landing minigame written for shargs.github.io
 * as part of a series on rocket mathematics.
 *
 * If you made it all the way here it means you're interested to know
 * how it works, or maybe how some effects were achieved.
 *
 * I am no profesionnal JS developer, so any contributions to improve
 * this code are welcome (just file a pull request on github)
 *
 * Please contact me if you want to reuse some of this somewhere, or at
 * least share the original blogpost, I'd appreciate it :)
 *
 * shargs.github.io 2021
 * Update (26/07/2021):
 *  - Fix a bug where restarting would not stop the previous animation loop
 *  - General style improvements
 */

// General simulation parameters
let context; // HTML5 canvas 2D context
let spacecraft;

const WIDTH = 800; // Canvas width
const HEIGHT = 600; // Canvas height
const PIXEL_PER_METER = 48; // Pixel per meter
const G = 1.62; // Surface gravity (m.s⁻²)

const ST_INIT = 0; // Initial state
const ST_FLY = 1; // Flying
const ST_CRASH = 1.5; // Crashing
const ST_CRASHED = 2; // Crashed
const ST_LAND = 3; // Landed safely!

const MOON_SURFACE = 100; // Offset

let last_time = performance.now();
let delta_t = 0; // Time elapsed since last update
let t = 0;
let status = ST_INIT; // Current status
let autopilot = false;

// Lander parameters
const LND_WIDTH = 128;
const LND_HEIGHT = 108;

const M0 = 1500; // Initial mass (in kg)
const M_MIN = 1000; // Mass without fuel (in kg)
const T_MAX = 20000; // Maximum thrust (in N)
const K = 1 / 200; // Inverse of exhaust speed (in 1/(m.s⁻¹))
const SHOCK_TOLERANCE = 5; // How much of an impact we can absorb, in m.s⁻¹

let y = 0; // Lander altitude (in m)
let v = 0; // Lander velocity (in m.s⁻¹)
let m = M0; // Lander mass (in kg)

let lnd_y = HEIGHT / 2; // Position of the lander (screen space, in px)
let screen_offset = 0; // Used to move the screen around

// Explosiion animation parameters
const EXPL_WIDTH = 960;
const EXPL_HEIGHT = 768;
const EXPL_ROWS = 4;
const EXPL_COLS = 5;
const EXPL_FRAMES = EXPL_COLS * EXPL_ROWS;
const EXPL_SWIDTH = EXPL_WIDTH / EXPL_COLS;
const EXPL_SHEIGHT = EXPL_HEIGHT / EXPL_ROWS;
let expl_ctr = 0;

// Sprites
let lander = new Image();
let explosion = new Image();
let stars = [];

let currentAnimationFrame;

class Spacecraft {
  constructor() {
    this.canvas = document.getElementById("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.canvas.height = HEIGHT;
    this.canvas.width = WIDTH;
    this.canvas.style.background = "#000";

    this.aFires = [];
    this.aSpark = [];
    this.aSpark2 = [];

    this.source = {
      x: this.canvas.width * 0.5,
      y: this.canvas.height * 0.5,
    };
  }
  run() {
    this.clearCanvas();

    updateScreen();

    drawStars();
    drawMoon();
    drawLander();
    drawInfo();

    if (state === ST_FLY) {
      this.updateThrusters();
      updatePhysics();
      if (this.thrusters_active) {
        // Thrusters active
        this.drawFlames();
      }
    } else if (state === ST_CRASH) {
      updateExplosion();
      drawExplosion();
    } else if (state === ST_CRASHED) {
      drawCrashedPanel();
    } else if (state === ST_LAND) {
      drawLandedPanel();
    }

    // Compute render time
    const NOW = performance.now();
    delta_t = NOW - last_time;
    last_time = NOW;

    currentAnimationFrame = requestAnimationFrame(() => this.run());
  }
  start() {
    // clear previous loop
    if (currentAnimationFrame) {
      cancelAnimationFrame(currentAnimationFrame);
    }
    this.run();
  }
  updateThrusters() {
    this.aFires.push(new Flame(this.source));
    this.aSpark.push(new Spark(this.source));
    this.aSpark2.push(new Spark(this.source));

    for (let i = this.aFires.length - 1; i >= 0; i--) {
      if (this.aFires[i].alive) this.aFires[i].update();
      else this.aFires.splice(i, 1);
    }

    for (let i = this.aSpark.length - 1; i >= 0; i--) {
      if (this.aSpark[i].alive) this.aSpark[i].update();
      else this.aSpark.splice(i, 1);
    }

    for (let i = this.aSpark2.length - 1; i >= 0; i--) {
      if (this.aSpark2[i].alive) this.aSpark2[i].update();
      else this.aSpark2.splice(i, 1);
    }
  }
  drawFlames() {
    this.ctx.globalCompositeOperation = "overlay";

    for (let i = this.aFires.length - 1; i >= 0; i--) {
      this.aFires[i].draw(this.ctx);
    }

    this.ctx.globalCompositeOperation = "soft-light";

    for (let i = this.aSpark.length - 1; i >= 0; i--) {
      if (i % 2 === 0) this.aSpark[i].draw(this.ctx);
    }

    this.ctx.globalCompositeOperation = "color-dodge";

    for (let i = this.aSpark2.length - 1; i >= 0; i--) {
      this.aSpark2[i].draw(this.ctx);
    }
  }
  clearCanvas() {
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.fillStyle = "rgba( 5, 5, 2, 1 )";
    this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    this.ctx.globalCompositeOperation = "lighter";
    this.ctx.rect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = this.pattern;
    this.ctx.fill();
  }
}

class Flame {
  constructor(mouse) {
    this.cx = mouse.x;
    this.cy = mouse.y;
    this.x = rand(this.cx - 25, this.cx + 25);
    this.y = rand(this.cy - 5, this.cy + 5);
    this.lx = this.x;
    this.ly = this.y;
    this.vy = rand(1, 3);
    this.vx = rand(-1, 1);
    this.r = rand(30, 40);
    this.life = rand(2, 7);
    this.alive = true;
    this.c = {
      h: Math.floor(rand(2, 40)),
      s: 100,
      l: rand(80, 100),
      a: 0,
      ta: rand(0.8, 0.9),
    };
  }
  update() {
    this.lx = this.x;
    this.ly = this.y;

    this.y += this.vy;
    this.vy += 0.08;

    this.x += this.vx;

    if (this.x < this.cx) this.vx += 0.2;
    else this.vx -= 0.2;

    if (this.r > 0) this.r -= 0.3;

    if (this.r <= 0) this.r = 0;

    this.life -= 0.12;

    if (this.life <= 0) {
      this.c.a -= 0.05;
      if (this.c.a <= 0) this.alive = false;
    } else if (this.life > 0 && this.c.a < this.c.ta) {
      this.c.a += 0.08;
    }
  }
  draw(ctx) {
    this.grd1 = ctx.createRadialGradient(
      this.x,
      this.y,
      this.r * 3,
      this.x,
      this.y,
      0
    );
    this.grd1.addColorStop(
      0.5,
      `hsla( ${this.c.h}, ${this.c.s}%, ${this.c.l}%, ${this.c.a / 20})`
    );
    this.grd1.addColorStop(0, "transparent");

    this.grd2 = ctx.createRadialGradient(
      this.x,
      this.y,
      this.r,
      this.x,
      this.y,
      0
    );
    this.grd2.addColorStop(
      0.5,
      `hsla( ${this.c.h}, ${this.c.s}%, ${this.c.l}%, ${this.c.a})`
    );
    this.grd2.addColorStop(0, "transparent");

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * 3, 0, 2 * Math.PI);
    ctx.fillStyle = this.grd1;
    ctx.fill();

    ctx.globalCompositeOperation = "overlay";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, 2 * Math.PI);
    ctx.fillStyle = this.grd2;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(this.lx, this.ly);
    ctx.lineTo(this.x, this.y);
    ctx.strokeStyle = `hsla( ${this.c.h}, ${this.c.s}%, ${this.c.l}%, 1)`;
    ctx.lineWidth = rand(1, 2);
    ctx.stroke();
    ctx.closePath();
  }
}

class Spark {
  constructor(mouse) {
    this.cx = mouse.x;
    this.cy = mouse.y;
    this.x = rand(this.cx - 40, this.cx + 40);
    this.y = rand(this.cy, this.cy + 5);
    this.lx = this.x;
    this.ly = this.y;
    this.vy = rand(1, 3);
    this.vx = rand(-4, 4);
    this.r = rand(0, 1);
    this.life = rand(4, 8);
    this.alive = true;
    this.c = {
      h: Math.floor(rand(2, 40)),
      s: 100,
      l: rand(40, 100),
      a: rand(0.8, 0.9),
    };
  }
  update() {
    this.lx = this.x;
    this.ly = this.y;

    this.y += this.vy;
    this.x += this.vx;

    if (this.x < this.cx) this.vx += 0.2;
    else this.vx -= 0.2;

    this.vy += 0.08;
    this.life -= 0.1;

    if (this.life <= 0) {
      this.c.a -= 0.05;

      if (this.c.a <= 0) this.alive = false;
    }
  }
  draw(ctx) {
    ctx.beginPath();
    ctx.moveTo(this.lx, this.ly);
    ctx.lineTo(this.x, this.y);
    ctx.strokeStyle =
      "hsla( " +
      this.c.h +
      ", " +
      this.c.s +
      "%, " +
      this.c.l +
      "%, " +
      this.c.a / 2 +
      ")";
    ctx.lineWidth = this.r * 2;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.closePath();

    ctx.beginPath();
    ctx.moveTo(this.lx, this.ly);
    ctx.lineTo(this.x, this.y);
    ctx.strokeStyle = `hsla( ${this.c.h}, ${this.c.s}%, ${this.c.l}%, ${this.c.a})`;
    ctx.lineWidth = this.r;
    ctx.stroke();
    ctx.closePath();
  }
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function drawLander() {
  context.globalCompositeOperation = "source-over";
  context.drawImage(lander, WIDTH / 2 - LND_WIDTH / 2, lnd_y - LND_HEIGHT);
}

function drawMoon() {
  const Y_MOON = HEIGHT - MOON_SURFACE + screen_offset;

  if (Y_MOON > HEIGHT) {
    return;
  }

  context.globalCompositeOperation = "lighten";
  context.fillStyle = "#ccc";
  context.fillRect(0, Y_MOON, WIDTH, MOON_SURFACE);
}

function drawStars() {
  context.save();
  const NSTARS = stars.length;
  for (let i = 0; i < NSTARS; ++i) {
    let star = stars[i];
    context.beginPath();
    context.arc(
      star.x,
      (star.y + screen_offset) % HEIGHT,
      star.radius,
      0,
      2 * Math.PI
    );
    context.closePath();
    context.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
    if (star.decreasing == true) {
      star.alpha -= star.dRatio;
      if (star.alpha < 0.1) {
        star.decreasing = false;
      }
    } else {
      star.alpha += star.dRatio;
      if (star.alpha > 0.95) {
        star.decreasing = true;
      }
    }
    context.fill();
  }
  context.restore();
}

function drawText(txt, x, y) {
  // Renders text txt at position (x, y)

  context.fillText(txt, x, y);
}

function drawInfo() {
  context.save();
  context.fillStyle = "#fff";
  context.font = "11pt sans";

  drawText("T: toggle thrusters, R: restart, F: autopilot", 12, 24);

  drawText(`Altitude: ${y.toFixed(2)} m`, 12, 48);

  drawText(`Velocity: ${v.toFixed(2)} m.s⁻¹`, 12, 72);

  drawText(`Fuel:  ${(m - M_MIN).toFixed(2)} kg`, 12, 96);

  drawText(`Mission time: ${t.toFixed(2)} s`, 12, 120);

  if (autopilot) {
    context.fillStyle = "#0f0";
    drawText("Autopilot ON", 12, 144);
  }

  context.restore();
}

function drawExplosion() {
  const NFRAME = Math.floor(expl_ctr) % EXPL_FRAMES;
  const N_ROW = NFRAME % EXPL_COLS;
  const N_COL = Math.floor(NFRAME / EXPL_COLS);

  const NX = N_ROW * EXPL_SWIDTH;
  const NY = N_COL * EXPL_SHEIGHT;

  context.globalCompositeOperation = "lighter";
  context.drawImage(
    explosion,
    NX,
    NY,
    EXPL_SWIDTH,
    EXPL_SHEIGHT,
    WIDTH / 2 - EXPL_SWIDTH / 2,
    lnd_y - EXPL_SHEIGHT / 2,
    EXPL_SWIDTH,
    EXPL_SHEIGHT
  );
}

function drawPanel(col) {
  // Draws a fancy info panel

  const BEVEL = 32;
  const PADDING = 64;

  context.save();

  context.globalCompositeOperation = "source-over";
  context.fillStyle = "rgba(0.5,0.5,0.5,0.75)";

  context.shadowColor = col;
  context.shadowBlur = 5;

  context.beginPath();
  context.moveTo(PADDING + BEVEL, PADDING);
  context.lineTo(WIDTH - PADDING - BEVEL, PADDING);
  context.lineTo(WIDTH - PADDING, PADDING + BEVEL);
  context.lineTo(WIDTH - PADDING, HEIGHT - PADDING - BEVEL);
  context.lineTo(WIDTH - PADDING - BEVEL, HEIGHT - PADDING);
  context.lineTo(PADDING + BEVEL, HEIGHT - PADDING);
  context.lineTo(PADDING, HEIGHT - PADDING - BEVEL);
  context.lineTo(PADDING, PADDING + BEVEL);
  context.closePath();

  context.fill();

  context.lineWidth = 3;
  context.strokeStyle = col;
  context.stroke();

  context.restore();
}

function drawCrashedPanel() {
  // Displayed after the player has crashed

  drawPanel("#d69");

  context.save();

  context.globalCompositeOperation = "source-over";
  context.fillStyle = "#fff";

  context.font = "bold 20pt sans";

  context.textAlign = "center";
  drawText("YOU HAVE CRASHED", WIDTH / 2, 128);

  context.fillStyle = "#d69";
  context.font = "11pt sans";
  drawText("Your vehicle hurled too fast towards the moon...", WIDTH / 2, 150);

  context.font = "bold 14pt sans";
  drawText("- PRESS [R] TO RESTART THE SIMULATION- ", WIDTH / 2, HEIGHT - 128);

  context.font = "11pt sans";
  context.textAlign = "left";
  context.fillStyle = "#fff";

  const ENERGY = (m * v * v) / 2000;

  drawText(`Final velocity: ${v.toFixed(2)} m.s⁻¹`, 128, 200);
  drawText(`Remaining fuel: ${(m - M_MIN).toFixed(2)} kg`, 128, 224);
  drawText(`Final velocity: ${v.toFixed(2)} m.s⁻¹`, 128, 200);
  drawText(`Impact energy : ${ENERGY.toFixed(2)} kJ`, 128, 272);
  drawText(`Mission duration : ${t.toFixed(2)} s`, 128, 296);

  context.restore();
}

function drawLandedPanel() {
  // Displayed after the player has landed

  drawPanel("#69d");

  context.save();

  context.globalCompositeOperation = "source-over";
  context.fillStyle = "#fff";

  context.font = "bold 20pt sans";

  context.textAlign = "center";
  drawText("YOU HAVE LANDED SAFELY", WIDTH / 2, 128);

  context.fillStyle = "#69d";
  context.font = "11pt sans";
  drawText("The vehicle sits nicely at the surface", WIDTH / 2, 150);

  context.font = "bold 14pt sans";
  drawText("- PRESS [R] TO RESTART THE SIMULATION- ", WIDTH / 2, HEIGHT - 128);

  context.font = "11pt sans";
  context.textAlign = "left";
  context.fillStyle = "#fff";

  const ENERGY = (m * v * v) / 2000;

  drawText(`Final velocity: ${v.toFixed(2)} m.s⁻¹`, 128, 200);
  drawText(`Remaining fuel: ${(m - M_MIN).toFixed(2)} kg`, 128, 224);
  drawText(`Final velocity: ${v.toFixed(2)} m.s⁻¹`, 128, 200);
  drawText(`Impact energy : ${ENERGY.toFixed(2)} kJ`, 128, 272);
  drawText(`Mission duration : ${t.toFixed(2)} s`, 128, 296);

  context.restore();
}

function updateScreen() {
  // Convert y into lnd_y
  // Adjust screen_offset

  lnd_y = HEIGHT - MOON_SURFACE - y * PIXEL_PER_METER;

  if (lnd_y > HEIGHT / 2) {
    // We are very close to the surface
    screen_offset = 0;
  } else {
    // We are up in the air
    screen_offset = HEIGHT / 2 - lnd_y;
    lnd_y = HEIGHT / 2;
  }

  spacecraft.source.y = lnd_y;
}

function updateExplosion() {
  expl_ctr += delta_t / 50;

  if (expl_ctr > EXPL_FRAMES) {
    // End of animation
    expl_ctr = EXPL_FRAMES - 1;
    state = ST_CRASHED;
  }
}

function updatePhysics() {
  // Simple explicit forward Euler
  // Not the most accurate, but hey this is a game

  const DT = delta_t / 1000;
  t += DT;

  // Acceleration
  a = -G;

  if (autopilot) {
    updateAutopilot();
  }

  if (spacecraft.thrusters_active) {
    // Use thrusters

    if (m > M_MIN) {
      // Consume fuel
      m -= K * T_MAX * DT;

      // Exert thrust
      a += T_MAX / m;
    } else {
      // No more fuel
      spacecraft.thrusters_active = false;
      m = M_MIN;
    }
  }

  y += v * DT;
  v += a * DT;

  if (y < 0 && v < 0) {
    // Hitting the surface

    if (v + SHOCK_TOLERANCE >= 0) {
      // Not too fast...
      state = ST_LAND;
    } else {
      // Too fast!
      state = ST_CRASH;
    }

    y = 0;
  }
}

function updateAutopilot() {
  if (y < 15) {
    spacecraft.thrusters_active = true;
  } else {
    spacecraft.thrusters_active = false;
  }
}

function initFire() {
  spacecraft = new Spacecraft();
  spacecraft.start();
  spacecraft.thrusters_active = false;
}

function initSimulation() {
  for (let i = 0; i < 100; ++i) {
    stars[i] = {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.sqrt(Math.random() * 2),
      alpha: 1.0,
      decreasing: true,
      dRatio: Math.random() * 0.005,
    };
  }

  // Initial conditions, something a little bit challenging
  y = 100;
  v = -10;
  t = 0;
  m = M0;
  state = ST_FLY;
  expl_ctr = 0;
  autopilot = false;

  initFire();
}

window.onload = () => {
  // Triggered when the window is first rendered

  const CANVAS = document.getElementById("canvas");
  context = CANVAS.getContext("2d");

  CANVAS.width = WIDTH;
  CANVAS.height = HEIGHT;
  CANVAS.style.position = "relative";
  CANVAS.style.background = "#ccc";
  CANVAS.style.display = "block";
  CANVAS.style.margin = "0 auto";

  context.font = "12pt serif";

  lander.src = "/assets/png/rocket/lander.png";
  explosion.src = "/assets/png/rocket/explosion.png";

  initSimulation();
};

const keypress = (e) => {
  // Keypress handling

  if (e.key === "t") {
    // T: toggle thrusters
    spacecraft.thrusters_active = !spacecraft.thrusters_active;
  } else if (e.key === "r") {
    // R: restart the simulation
    initSimulation();
  } else if (e.key === "f") {
    // F: toggle autopilot
    autopilot = !autopilot;
  }
};

document.addEventListener("keypress", keypress);
