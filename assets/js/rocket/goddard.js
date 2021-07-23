// General simulation parameters
var context;        // HTML5 canvas 2D context

var delta_t = 0;     // Time elapsed since last update
const width = 800;   // Canvas width
const height = 600;  // Canvas height

var status = 0;      // Simulation status
const ST_INIT = 0;   // State: initial
const ST_FLY  = 1;   // State: flying
const ST_OVER = 2;   // State: out of fuel / crashed

const GR_EXHAUST = false;   // Draw exhaust

const leftPane = 200; // Left panel width (in pixels)

// Earth parameters
const earth_radius = 6371009000; // Earth radius, approximative (in m)

// Rocket parameters
var y = 0;      // Height above ground (in m)
var v = 0;      // Vertical speed (in m.s^(-1))
var a = 0;      // Vertical acceleration (in m.s^(-2))
var T = 0;      // Thust (in N = kg.m.s^(-2))
var mf = 100;   // Mass of remaining fuel (in kg)

const mt = 100; // Fuel capacity (in kg)
const m0 = 10;  // Mass of the empty rocket (in kg)
const A  = 1;   // Cross-sectional area of the rocket (in m^2)
const Cd = 0.5; // Drag coefficient (here, of a cone, dimensionless)

// Rocket drawing parameters
const rck_width = 64;   // Rocket width on screen (in pixels)
const rck_height = 300; // Rocket body height on screen (in pixels)
const rck_cone = 64;    // Rocket cone height on screen (in pixels);

var rck_x = 0;          // Rocket bottom-left position on screen
var rck_y = 0;          // Rocket bottom-left position on screen

// Smoke simulation
var smoke = new Image();    // Smoke sprite
const smk_width = 256;      // Smoke sprite width
const smk_height = 256;     // Smoke sprite height
const particleCount = 30;   // Number of sprites
const smk_lifetime = 500;   // Lifetime of a particle
var particles = [];         // Sprites

function rand(min, max){
    // Random value between min and max
    return Math.random() * (max - min) + min;
}

window.onload = function() {
    // Triggered when the window is first rendered
    
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");
    
    canvas.width  = width;
    canvas.height = height;
    canvas.style.position   = "relative";
    canvas.style.background = "#ccc";
    canvas.style.display    = "block";
    canvas.style.margin     = "0 auto";
    
    context.font = "12pt serif";
    
    smoke.src = "/assets/png/smk.png";
}

const drawText = function(txt, x, y) {
    // Renders text txt at position (x, y)

    context.fillText(txt, x, y);
}

const drawSky = function() {
    // Draws the sky

    var grd = context.createLinearGradient(0,height,0, 0);
    grd.addColorStop(0,    "#66c");
    grd.addColorStop(0.65, "#ccf");
    grd.addColorStop(1,    "#fff");
    context.fillStyle = grd;
    context.fillRect(0, 0, width, height);

}

const drawGround = function() {
    // Draws the ground (if necessary)


}

const drawPanes = function() {
    context.fillStyle = "#ccc";
    context.rect(0, 0, leftPane, height);
    context.fill();
    context.strokeStyle = "#aaa";
    context.stroke();
}

const drawBackground = function() {
    context.save();

    drawSky();
    drawGround();
    drawPanes();
    
    context.restore();
}

const drawRocket = function(){
    
    var grd = context.createLinearGradient(rck_x, rck_y-rck_height/2, rck_x+rck_width, rck_y-rck_height/2);
    grd.addColorStop(0,   "#ccc");
    grd.addColorStop(0.2, "#fff");
    grd.addColorStop(0.5, "#aaa");
    grd.addColorStop(0.95, "#ccc");
    grd.addColorStop(1,   "#aaa");
    
    context.save();

    // Rocket body
    context.fillStyle   = grd;
    context.fillRect(rck_x, rck_y, rck_width, - rck_height);
    
    context.strokeStyle = "#000";
    context.rect(rck_x, rck_y, rck_width, - rck_height);
    context.stroke();

    // Rocket cone
    context.moveTo(rck_x, rck_y - rck_height);
    context.lineTo(rck_x + rck_width/2, rck_y - rck_height - rck_cone);
    context.lineTo(rck_x + rck_width, rck_y - rck_height);
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
}

class Particle {
    constructor() {
        this.x = 0;
        this.y = 0;

        this.org_x = 0;
        this.org_y = 0;

        this.vx = 0;
        this.vy = 0;

        this.angle = 0;
        this.age = 0;

        this.update = function () {
            this.age += 1;
            this.x += this.vx * delta_t;
            this.y += this.vy * delta_t;

            if ((this.x >= width + smk_width) || (this.x <= -smk_width)) {
                this.x = this.org_x;
                this.y = this.org_y;
            }

            if ((this.y >= height + smk_height) || (this.y <= -smk_height)) {
                this.y = this.org_y;
                this.x = this.org_x;
            }

            if (this.age > smk_lifetime) {
                this.x = this.org_x;
                this.y = this.org_y;
                this.age = 0;
            }
        };

        this.rotate = function(angle) {
            this.angle = angle;
        }

        this.setOrigin = function (x, y) {
            this.org_x = x;
            this.org_y = y;
        };

        this.setPosition = function (x, y) {
            this.x = x;
            this.y = y;
        };

        this.setVelocity = function (vx, vy) {
            this.vx = vx;
            this.vy = vy;
        };
    }
}

const drawSmoke = function() {

    if (!GR_EXHAUST) {
        // Do not draw smoke
        return;
    }

    // Draw smoke
    particles.forEach(function(particle) {
        context.save()
        context.translate(particle.x, particle.y);
        context.rotate(particle.angle);
        context.drawImage(smoke, -smk_width/2, -smk_height/2); 
        context.restore();
    });   
}


const draw = function() {
    // Render the scene

    // Background
    drawBackground();

    // Smoke
    drawSmoke();

    // Rocket
    drawRocket();

    // Information
    drawText("Altitude (m) : " + y.toFixed(2) , 12, 24); 
    drawText("Speed (m.s⁻¹): " + v.toFixed(2) , 12, 48); 
    drawText("Fuel left (kg): " + mf.toFixed(2) , 12, 72); 
    
    
    drawText("Render time: " + delta_t.toFixed(2) + " ms", 12, height - 12);    
}

const updateSimulation = function() {
    // Update the simulation
    
    if (status != ST_FLY) {
        return;
    }
    
    // Update smoke 
    particles.forEach(function(particle) {
        particle.update();
        particle.setVelocity(particle.vx, v);
    });


}

const launchRocket = function() {
    // Launch !

    // Create smoke
    particles = [];
    
    for(var i=0; i < particleCount; ++i){
        var particle = new Particle();

        particle.setOrigin(rck_x + rck_width/2, rck_y);
        particle.setPosition(rck_x + rck_width/2, rck_y);
        particle.setVelocity(rand(-10, 10), 0);
        particle.rotate(rand(0, Math.PI * 2 ));
        particle.age = smk_lifetime * i / particleCount;

        particles.push(particle);     
    }

    // Begin simulation
    status = ST_FLY;
}

const reset = function() {
    // Reset state

    particles = [];

    rck_x = width / 2 - rck_width / 2;
    rck_y = height - 128;

    status = ST_INIT;

    y = 0;      // Height above ground (in m)
    v = 0;      // Vertical speed (in m.s^(-1))
    a = 0;      // Vertical acceleration (in m.s^(-2))
    T = 0;      // Thust (in N = kg.m.s^(-2))
    mf = 100;   // Mass of remaining fuel (in kg)
}

const tick = function() {
    // Advance time

    var begin_time = performance.now();

    context = document.getElementById("canvas").getContext("2d");
    context.clearRect(0, 0, width, height);


    updateSimulation();
    draw();


    // Compute render time
    delta_t = performance.now() - begin_time;

    requestAnimationFrame(tick);
}

const init = function() {
    // Initialisation

    reset();

    // Start simulation
    tick();

}

const keypress = function(e) {
    // Keypress handling

    if (e.code == "KeyL") {
        // L: Launch
        launchRocket();
    }    
    else if (e.code == "Digit1") {
        v = 10;
    }
    else if (e.code = "Digit2") {
        v = 20;
    }
}

document.addEventListener('keypress', keypress);

init();