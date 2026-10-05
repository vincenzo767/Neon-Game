// Shared Canvas2D helpers for procedural vehicle art.
// Vehicles face UP; most are left/right symmetric, so shapes are described
// as the RIGHT half (offsets from the centre line) and mirrored.

/** Path a symmetric hull. pts = [dx0,y0, dx1,y1, ...] for the right side, nose first. */
export function mirrorPath(ctx, cx, pts) {
  ctx.beginPath();
  ctx.moveTo(cx + pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(cx + pts[i], pts[i + 1]);
  for (let i = pts.length - 2; i >= 0; i -= 2) ctx.lineTo(cx - pts[i], pts[i + 1]);
  ctx.closePath();
}

/** Horizontal chrome gradient across [x0, x1]. */
export function chrome(ctx, x0, x1, dark = '#121722', mid = '#5a6880', hi = '#d0dcee') {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, dark);
  g.addColorStop(0.32, mid);
  g.addColorStop(0.5, hi);
  g.addColorStop(0.68, mid);
  g.addColorStop(1, dark);
  return g;
}

export function vgrad(ctx, y0, y1, a, b) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}

/** Stroke the current path with a glowing neon line. */
export function neonStroke(ctx, color, width = 0.8, blur = 6) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

/** Draw a set of mirrored line segments [dx0,y0,dx1,y1, ...] as neon. */
export function neonLines(ctx, cx, segs, color, width = 0.8, blur = 6) {
  ctx.beginPath();
  for (let i = 0; i < segs.length; i += 4) {
    ctx.moveTo(cx + segs[i], segs[i + 1]); ctx.lineTo(cx + segs[i + 2], segs[i + 3]);
    ctx.moveTo(cx - segs[i], segs[i + 1]); ctx.lineTo(cx - segs[i + 2], segs[i + 3]);
  }
  neonStroke(ctx, color, width, blur);
}

export function outline(ctx, w = 0.9) {
  ctx.lineWidth = w;
  ctx.strokeStyle = '#04060a';
  ctx.stroke();
}

export function canopy(ctx, cx, cy, rx, ry, top = '#ffffff', mid = '#7ad8ff', bot = '#0a2040') {
  const g = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry);
  g.addColorStop(0, top);
  g.addColorStop(0.35, mid);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

/** Soft radial glow dot. */
export function glowDot(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Elongated projectile facing +X with a soft colour body and a white core. */
export function drawBolt(ctx, w, h, color, core = '#ffffff') {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.5, color);
  g.addColorStop(1, core);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, w / 2 - 0.3, h / 2 - 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(w * 0.65, h / 2, w * 0.3, Math.max(0.4, h * 0.14), 0, 0, Math.PI * 2);
  ctx.fill();
}

export const rgbCss = (c, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
