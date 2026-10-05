// Camera with trauma-based screen shake and directional "kick".
// Shake magnitude = trauma^2 so small hits barely move the screen while big
// explosions really rattle it. Scaled by the user's shake-intensity setting.

export class Camera {
  constructor(settings) {
    this.settings = settings;
    this.x = 0;
    this.y = 0;
    this.trauma = 0;
    this.kickX = 0;
    this.kickY = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.t = 0;
  }

  addTrauma(amount) { this.trauma = Math.min(1, this.trauma + amount); }

  /** Instant directional punch (e.g. recoil, heavy impact from a side). */
  kick(dx, dy) { this.kickX += dx; this.kickY += dy; }

  update(dt) {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const mul = this.settings.data.shake;
    const s = this.trauma * this.trauma * 16 * mul;
    // Cheap smooth noise: sum of incommensurate sines.
    const t = this.t * 38;
    this.shakeX = s * (Math.sin(t * 1.0) * 0.6 + Math.sin(t * 2.31 + 1.3) * 0.4);
    this.shakeY = s * (Math.sin(t * 1.17 + 4.1) * 0.6 + Math.sin(t * 2.73 + 0.2) * 0.4);
    this.kickX *= 0.78;
    this.kickY *= 0.78;
  }

  get offsetX() { return this.x + this.shakeX + this.kickX * this.settings.data.shake; }
  get offsetY() { return this.y + this.shakeY + this.kickY * this.settings.data.shake; }
}
