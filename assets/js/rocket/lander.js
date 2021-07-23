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
 */

// General simulation parameters
var context; // HTML5 canvas 2D context
var spacecraft;

var last_time = performance.now();
var delta_t = 0; // Time elapsed since last update
const width = 800; // Canvas width
const height = 600; // Canvas height
const ppm = 48; // Pixel per meter
const g = 1.62; // Surface gravity (m.s⁻²)
var t = 0;

const ST_INIT = 0; // Initial state
const ST_FLY = 1; // Flying
const ST_CRASH = 1.5; // Crashing
const ST_CRASHED = 2; // Crashed
const ST_LAND = 3; // Landed safely!

const moon_surface = 100; // Offset

var status = ST_INIT; // Current status
var autopilot = false;

// Lander parameters
const lnd_width = 128;
const lnd_height = 108;

const m0 = 1500; // Initial mass (in kg)
const mmin = 1000; // Mass without fuel (in kg)
const Tmax = 20000; // Maximum thrust (in N)
const k = 1 / 200; // Inverse of exhaust speed (in 1/(m.s⁻¹))
const shock_tolerance = 5; // How much of an impact we can absorb, in m.s⁻¹

var y = 0; // Lander altitude (in m)
var v = 0; // Lander velocity (in m.s⁻¹)
var m = m0; // Lander mass (in kg)

var lnd_y = height / 2; // Position of the lander (screen space, in px)
var screen_offset = 0; // Used to move the screen around

// Explosiion animation parameters
const expl_width = 960;
const expl_height = 768;
const expl_rows = 4;
const expl_cols = 5;
const expl_frames = expl_cols * expl_rows;
const expl_swidth = expl_width / expl_cols;
const expl_sheight = expl_height / expl_rows;
var expl_ctr = 0;

// Sprites
var lander = new Image();
var explosion = new Image();
var stars = [];

var Spacecraft = function () {
  this.canvas = document.getElementById("canvas");
  this.ctx = this.canvas.getContext("2d");
  this.canvas.height = 600;
  this.canvas.width = 800;
  this.canvas.style.background = "#000";

  this.aFires = [];
  this.aSpark = [];
  this.aSpark2 = [];

  this.source = {
    x: this.canvas.width * 0.5,
    y: this.canvas.height * 0.5,
  };
};

Spacecraft.prototype.run = function () {
  this.clearCanvas();

  updateScreen();

  drawStars();
  drawMoon();
  drawLander();
  drawInfo();

  if (state == ST_FLY) {
    this.updateThrusters();
    updatePhysics();
    if (this.thrusters_active) {
      // Thrusters active
      this.drawFlames();
    }
  } else if (state == ST_CRASH) {
    updateExplosion();
    drawExplosion();
  } else if (state == ST_CRASHED) {
    drawCrashedPanel();
  } else if (state == ST_LAND) {
    drawLandedPanel();
  }

  // Compute render time
  delta_t = performance.now() - last_time;
  last_time = performance.now();

  requestAnimationFrame(this.run.bind(this));
};

Spacecraft.prototype.start = function () {
  this.run();
};

Spacecraft.prototype.updateThrusters = function () {
  this.aFires.push(new Flame(this.source));
  this.aSpark.push(new Spark(this.source));
  this.aSpark2.push(new Spark(this.source));

  for (var i = this.aFires.length - 1; i >= 0; i--) {
    if (this.aFires[i].alive) this.aFires[i].update();
    else this.aFires.splice(i, 1);
  }

  for (var i = this.aSpark.length - 1; i >= 0; i--) {
    if (this.aSpark[i].alive) this.aSpark[i].update();
    else this.aSpark.splice(i, 1);
  }

  for (var i = this.aSpark2.length - 1; i >= 0; i--) {
    if (this.aSpark2[i].alive) this.aSpark2[i].update();
    else this.aSpark2.splice(i, 1);
  }
};

Spacecraft.prototype.drawFlames = function () {
  this.ctx.globalCompositeOperation = "overlay";

  for (var i = this.aFires.length - 1; i >= 0; i--) {
    this.aFires[i].draw(this.ctx);
  }

  this.ctx.globalCompositeOperation = "soft-light";

  for (var i = this.aSpark.length - 1; i >= 0; i--) {
    if (i % 2 === 0) this.aSpark[i].draw(this.ctx);
  }

  this.ctx.globalCompositeOperation = "color-dodge";

  for (var i = this.aSpark2.length - 1; i >= 0; i--) {
    this.aSpark2[i].draw(this.ctx);
  }
};

Spacecraft.prototype.clearCanvas = function () {
  this.ctx.globalCompositeOperation = "source-over";
  this.ctx.fillStyle = "rgba( 5, 5, 2, 1 )";
  this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  this.ctx.globalCompositeOperation = "lighter";
  this.ctx.rect(0, 0, this.canvas.width, this.canvas.height);
  this.ctx.fillStyle = this.pattern;
  this.ctx.fill();
};

var Flame = function (mouse) {
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
};

Flame.prototype.update = function () {
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
};
Flame.prototype.draw = function (ctx) {
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
    "hsla( " +
      this.c.h +
      ", " +
      this.c.s +
      "%, " +
      this.c.l +
      "%, " +
      this.c.a / 20 +
      ")"
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
    "hsla( " +
      this.c.h +
      ", " +
      this.c.s +
      "%, " +
      this.c.l +
      "%, " +
      this.c.a +
      ")"
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
  ctx.strokeStyle =
    "hsla( " + this.c.h + ", " + this.c.s + "%, " + this.c.l + "%, 1)";
  ctx.lineWidth = rand(1, 2);
  ctx.stroke();
  ctx.closePath();
};

var Spark = function (mouse) {
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
};

Spark.prototype.update = function () {
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
};
Spark.prototype.draw = function (ctx) {
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
  ctx.strokeStyle =
    "hsla( " +
    this.c.h +
    ", " +
    this.c.s +
    "%, " +
    this.c.l +
    "%, " +
    this.c.a +
    ")";
  ctx.lineWidth = this.r;
  ctx.stroke();
  ctx.closePath();
};

rand = function (min, max) {
  return Math.random() * (max - min) + min;
};

drawLander = function () {
  context.globalCompositeOperation = "source-over";
  context.drawImage(lander, width / 2 - lnd_width / 2, lnd_y - lnd_height);
};
drawMoon = function () {
  const ymoon = height - moon_surface + screen_offset;

  if (ymoon > height) {
    return;
  }

  context.globalCompositeOperation = "lighten";
  context.fillStyle = "#ccc";
  context.fillRect(0, ymoon, width, moon_surface);
};

drawStars = function () {
  context.save();
  const nstars = stars.length;
  for (var i = 0; i < nstars; ++i) {
    var star = stars[i];
    context.beginPath();
    context.arc(
      star.x,
      (star.y + screen_offset) % height,
      star.radius,
      0,
      2 * Math.PI
    );
    context.closePath();
    context.fillStyle = "rgba(255, 255, 255, " + star.alpha + ")";
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
};

const drawText = function (txt, x, y) {
  // Renders text txt at position (x, y)

  context.fillText(txt, x, y);
};

drawInfo = function () {
  context.save();
  context.fillStyle = "#fff";
  context.font = "11pt sans";

  drawText("T: toggle thrusters, R: restart, F: autopilot", 12, 24);

  drawText("Altitude: " + y.toFixed(2) + " m", 12, 48);

  drawText("Velocity: " + v.toFixed(2) + " m.s⁻¹", 12, 72);

  drawText("Fuel: " + (m - mmin).toFixed(2) + " kg", 12, 96);

  drawText("Mission time: " + t.toFixed(2) + " s", 12, 120);

  if (autopilot) {
    context.fillStyle = "#0f0";
    drawText("Autopilot ON", 12, 144);
  }

  context.restore();
};

drawExplosion = function () {
  const nframe = Math.floor(expl_ctr) % expl_frames;
  const nrow = nframe % expl_cols;
  const ncol = Math.floor(nframe / expl_cols);

  const nx = nrow * expl_swidth;
  const ny = ncol * expl_sheight;

  context.globalCompositeOperation = "lighter";
  context.drawImage(
    explosion,
    nx,
    ny,
    expl_swidth,
    expl_sheight,
    width / 2 - expl_swidth / 2,
    lnd_y - expl_sheight / 2,
    expl_swidth,
    expl_sheight
  );
};

drawPanel = function (col) {
  // Draws a fancy info panel

  const bevel = 32;
  const padding = 64;

  context.save();

  context.globalCompositeOperation = "source-over";
  context.fillStyle = "rgba(0.5,0.5,0.5,0.75)";

  context.shadowColor = col;
  context.shadowBlur = 5;

  context.beginPath();
  context.moveTo(padding + bevel, padding);
  context.lineTo(width - padding - bevel, padding);
  context.lineTo(width - padding, padding + bevel);
  context.lineTo(width - padding, height - padding - bevel);
  context.lineTo(width - padding - bevel, height - padding);
  context.lineTo(padding + bevel, height - padding);
  context.lineTo(padding, height - padding - bevel);
  context.lineTo(padding, padding + bevel);
  context.closePath();

  context.fill();

  context.lineWidth = 3;
  context.strokeStyle = col;
  context.stroke();

  context.restore();
};

drawCrashedPanel = function () {
  // Displayed after the player has crashed

  drawPanel("#d69");

  context.save();

  context.globalCompositeOperation = "source-over";
  context.fillStyle = "#fff";

  context.font = "bold 20pt sans";

  context.textAlign = "center";
  drawText("YOU HAVE CRASHED", width / 2, 128);

  context.fillStyle = "#d69";
  context.font = "11pt sans";
  drawText("Your vehicle hurled too fast towards the moon...", width / 2, 150);

  context.font = "bold 14pt sans";
  drawText("- PRESS [R] TO RESTART THE SIMULATION- ", width / 2, height - 128);

  context.font = "11pt sans";
  context.textAlign = "left";
  context.fillStyle = "#fff";

  const energy = (m * v * v) / 2000;

  drawText("Final velocity: " + v.toFixed(2) + " m.s⁻¹", 128, 200);
  drawText("Remaining fuel: " + (m - mmin).toFixed(2) + " kg", 128, 224);
  drawText("Total mass: " + m.toFixed(2) + " kg", 128, 248);
  drawText("Impact energy : " + energy.toFixed(2) + " kJ", 128, 272);
  drawText("Mission duration : " + t.toFixed(2) + " s", 128, 296);

  context.restore();
};

drawLandedPanel = function () {
  // Displayed after the player has landed

  drawPanel("#69d");

  context.save();

  context.globalCompositeOperation = "source-over";
  context.fillStyle = "#fff";

  context.font = "bold 20pt sans";

  context.textAlign = "center";
  drawText("YOU HAVE LANDED SAFELY", width / 2, 128);

  context.fillStyle = "#69d";
  context.font = "11pt sans";
  drawText("The vehicle sits nicely at the surface", width / 2, 150);

  context.font = "bold 14pt sans";
  drawText("- PRESS [R] TO RESTART THE SIMULATION- ", width / 2, height - 128);

  context.font = "11pt sans";
  context.textAlign = "left";
  context.fillStyle = "#fff";

  const energy = (m * v * v) / 2000;

  drawText("Final velocity: " + v.toFixed(2) + " m.s⁻¹", 128, 200);
  drawText("Remaining fuel: " + (m - mmin).toFixed(2) + " kg", 128, 224);
  drawText("Total mass: " + m.toFixed(2) + " kg", 128, 248);
  drawText("Impact energy : " + energy.toFixed(2) + " kJ", 128, 272);
  drawText("Mission duration : " + t.toFixed(2) + " s", 128, 296);

  context.restore();
};

updateScreen = function () {
  // Convert y into lnd_y
  // Adjust screen_offset

  lnd_y = height - moon_surface - y * ppm;

  if (lnd_y > height / 2) {
    // We are very close to the surface
    screen_offset = 0;
  } else {
    // We are up in the air
    screen_offset = height / 2 - lnd_y;
    lnd_y = height / 2;
  }

  spacecraft.source.y = lnd_y;
};

updateExplosion = function () {
  expl_ctr += delta_t / 50;

  if (expl_ctr > expl_frames) {
    // End of animation
    expl_ctr = expl_frames - 1;
    state = ST_CRASHED;
  }
};

updatePhysics = function () {
  // Simple explicit forward Euler
  // Not the most accurate, but hey this is a game

  const dt = delta_t / 1000;
  t += dt;

  // Acceleration
  a = -g;

  if (autopilot) {
    updateAutopilot();
  }

  if (spacecraft.thrusters_active) {
    // Use thrusters

    if (m > mmin) {
      // Consume fuel
      m -= k * Tmax * dt;

      // Exert thrust
      a += Tmax / m;
    } else {
      // No more fuel
      spacecraft.thrusters_active = false;
      m = mmin;
    }
  }

  y += v * dt;
  v += a * dt;

  if (y < 0 && v < 0) {
    // Hitting the surface

    if (v + shock_tolerance >= 0) {
      // Not too fast...
      state = ST_LAND;
      console.log("Land");
      console.log("v = " + v);
    } else {
      // Too fast!
      state = ST_CRASH;
      console.log("crash");
      console.log("v = " + v);
    }

    y = 0;
    // v = 0;
  }
};

updateAutopilot = function () {
  if (y < 14.78) {
    spacecraft.thrusters_active = true;
  } else {
    spacecraft.thrusters_active = false;
  }
};

initFire = function () {
  spacecraft = new Spacecraft();
  spacecraft.start();
  spacecraft.thrusters_active = false;
};

initSimulation = function () {
  for (var i = 0; i < 100; i++) {
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
  m = m0;
  state = ST_FLY;
  expl_ctr = 0;
  autopilot = false;

  initFire();
};

window.onload = function () {
  // Triggered when the window is first rendered

  const canvas = document.getElementById("canvas");
  context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;
  canvas.style.position = "relative";
  canvas.style.background = "#ccc";
  canvas.style.display = "block";
  canvas.style.margin = "0 auto";

  context.font = "12pt serif";

  lander.src = "/assets/png/rocket/lander.png";
  explosion.src = "/assets/png/rocket/explosion.png";

  initSimulation();
};

const keypress = function (e) {
  // Keypress handling

  if (e.code == "KeyT") {
    // T: toggle thrusters
    spacecraft.thrusters_active = !spacecraft.thrusters_active;
  } else if (e.code == "KeyR") {
    // R: restart the simulation
    initSimulation();
  } else if (e.code == "KeyF") {
    // F: toggle autopilot
    autopilot = !autopilot;
  }
};

document.addEventListener("keypress", keypress);
