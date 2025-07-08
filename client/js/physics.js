// Physics helper functions for Ball Race
class PhysicsUtils {
  static applyGravity(ball, gravity = 0.5) {
    ball.velocity.y += gravity;
  }

  static updatePosition(ball) {
    ball.position.x += ball.velocity.x;
    ball.position.y += ball.velocity.y;
  }

  static checkWallCollision(ball, worldWidth, radius = 10, bounceFactor = 0.7) {
    if (ball.position.x <= radius) {
      ball.position.x = radius;
      ball.velocity.x = Math.abs(ball.velocity.x) * bounceFactor;
    } else if (ball.position.x >= worldWidth - radius) {
      ball.position.x = worldWidth - radius;
      ball.velocity.x = -Math.abs(ball.velocity.x) * bounceFactor;
    }
  }

  static checkObstacleCollision(
    ball,
    obstacle,
    bounceFactor = 0.7,
    radius = 10
  ) {
    const ballLeft = ball.position.x - radius;
    const ballRight = ball.position.x + radius;
    const ballTop = ball.position.y - radius;
    const ballBottom = ball.position.y + radius;

    const obstacleLeft = obstacle.x;
    const obstacleRight = obstacle.x + obstacle.width;
    const obstacleTop = obstacle.y;
    const obstacleBottom = obstacle.y + obstacle.height;

    // Check if ball overlaps with obstacle
    if (
      ballRight > obstacleLeft &&
      ballLeft < obstacleRight &&
      ballBottom > obstacleTop &&
      ballTop < obstacleBottom
    ) {
      // Determine collision side
      const overlapLeft = ballRight - obstacleLeft;
      const overlapRight = obstacleRight - ballLeft;
      const overlapTop = ballBottom - obstacleTop;
      const overlapBottom = obstacleBottom - ballTop;

      const minOverlap = Math.min(
        overlapLeft,
        overlapRight,
        overlapTop,
        overlapBottom
      );

      if (minOverlap === overlapTop) {
        // Collision from top
        ball.position.y = obstacleTop - radius;
        ball.velocity.y = -Math.abs(ball.velocity.y) * bounceFactor;
        ball.velocity.x += (Math.random() - 0.5) * 2; // Add randomness
      } else if (minOverlap === overlapBottom) {
        // Collision from bottom
        ball.position.y = obstacleBottom + radius;
        ball.velocity.y = Math.abs(ball.velocity.y) * bounceFactor;
      } else if (minOverlap === overlapLeft) {
        // Collision from left
        ball.position.x = obstacleLeft - radius;
        ball.velocity.x = -Math.abs(ball.velocity.x) * bounceFactor;
      } else {
        // Collision from right
        ball.position.x = obstacleRight + radius;
        ball.velocity.x = Math.abs(ball.velocity.x) * bounceFactor;
      }

      return true;
    }

    return false;
  }

  static applyFriction(ball, frictionFactor = 0.98) {
    ball.velocity.x *= frictionFactor;
  }

  static limitVelocity(ball, maxVelocity = 15) {
    const speed = Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2);
    if (speed > maxVelocity) {
      ball.velocity.x = (ball.velocity.x / speed) * maxVelocity;
      ball.velocity.y = (ball.velocity.y / speed) * maxVelocity;
    }
  }

  static addWind(ball, windForce = 0.1) {
    // Add some wind effect for more interesting physics
    ball.velocity.x += (Math.random() - 0.5) * windForce;
  }

  static checkFinishLine(ball, finishY) {
    return ball.position.y >= finishY;
  }

  static createRandomBall(x, y, color) {
    return {
      id: Date.now() + Math.random(),
      position: { x, y },
      velocity: {
        x: (Math.random() - 0.5) * 4,
        y: 0,
      },
      color: color || this.getRandomColor(),
      radius: 10,
    };
  }

  static getRandomColor() {
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#96CEB4",
      "#FFEAA7",
      "#DDA0DD",
      "#98D8C8",
      "#FFB6C1",
      "#87CEEB",
      "#F0E68C",
      "#FF7F50",
      "#9370DB",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  static simulatePhysicsStep(ball, obstacles, worldSettings) {
    const {
      width: worldWidth,
      height: worldHeight,
      gravity,
      bounce,
      friction,
    } = worldSettings;

    // Apply gravity
    this.applyGravity(ball, gravity || 0.5);

    // Update position
    this.updatePosition(ball);

    // Check wall collisions
    this.checkWallCollision(ball, worldWidth, ball.radius, bounce || 0.7);

    // Check obstacle collisions
    obstacles.forEach((obstacle) => {
      this.checkObstacleCollision(ball, obstacle, bounce || 0.7, ball.radius);
    });

    // Apply friction
    this.applyFriction(ball, friction || 0.98);

    // Limit velocity
    this.limitVelocity(ball);

    // Add wind effect
    this.addWind(ball, 0.05);

    // Keep ball in bounds vertically
    if (ball.position.y < 0) {
      ball.position.y = 0;
      ball.velocity.y = Math.abs(ball.velocity.y);
    }
  }

  static calculateTrajectory(
    startX,
    startY,
    velocityX,
    velocityY,
    obstacles,
    steps = 100
  ) {
    const trajectory = [];
    const ball = {
      position: { x: startX, y: startY },
      velocity: { x: velocityX, y: velocityY },
      radius: 10,
    };

    for (let i = 0; i < steps; i++) {
      trajectory.push({
        x: ball.position.x,
        y: ball.position.y,
        step: i,
      });

      this.simulatePhysicsStep(ball, obstacles, {
        width: 800,
        height: 1200,
        gravity: 0.5,
        bounce: 0.7,
        friction: 0.98,
      });

      // Stop if ball goes too far down
      if (ball.position.y > 1200) break;
    }

    return trajectory;
  }
}

// Ball Animation Helper
class BallAnimator {
  constructor() {
    this.animations = new Map();
  }

  addBounceAnimation(ballId, duration = 300) {
    this.animations.set(ballId, {
      type: "bounce",
      startTime: Date.now(),
      duration: duration,
    });
  }

  addSpinAnimation(ballId, speed = 5) {
    this.animations.set(ballId, {
      type: "spin",
      speed: speed,
      rotation: 0,
    });
  }

  updateAnimations() {
    const now = Date.now();

    this.animations.forEach((animation, ballId) => {
      if (animation.type === "bounce") {
        const elapsed = now - animation.startTime;
        if (elapsed >= animation.duration) {
          this.animations.delete(ballId);
        }
      } else if (animation.type === "spin") {
        animation.rotation += animation.speed;
      }
    });
  }

  getBallTransform(ballId) {
    const animation = this.animations.get(ballId);
    if (!animation) return null;

    if (animation.type === "bounce") {
      const elapsed = Date.now() - animation.startTime;
      const progress = elapsed / animation.duration;
      const bounce = Math.sin(progress * Math.PI) * 5;
      return { y: -bounce };
    } else if (animation.type === "spin") {
      return { rotation: animation.rotation };
    }

    return null;
  }

  clearAnimations() {
    this.animations.clear();
  }
}

// Particle Effects System
class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  addExplosion(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1.0,
        decay: 0.02,
        color: color,
        size: Math.random() * 4 + 2,
      });
    }
  }

  addTrail(x, y, color) {
    this.particles.push({
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      life: 0.5,
      decay: 0.05,
      color: color,
      size: 3,
    });
  }

  update() {
    this.particles = this.particles.filter((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.2; // gravity
      particle.vx *= 0.98; // friction
      particle.life -= particle.decay;

      return particle.life > 0;
    });
  }

  render(ctx, scale = 1) {
    this.particles.forEach((particle) => {
      ctx.save();
      ctx.globalAlpha = particle.life;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(
        particle.x * scale,
        particle.y * scale,
        particle.size * scale,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    });
  }

  clear() {
    this.particles = [];
  }
}

// Make classes available globally
window.PhysicsUtils = PhysicsUtils;
window.BallAnimator = BallAnimator;
window.ParticleSystem = ParticleSystem;
