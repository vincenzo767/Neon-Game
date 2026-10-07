// Procedural pilot portraits (Canvas2D) for the select screen and the
// ultimate cut-in. Each pilot's `portrait` block picks skin/hair colours,
// hair style, eye treatment and an accent; the art is drawn in a 120x150
// design space and scaled to the canvas. Pass a time value to animate
// (blinks, visor scan, rim flicker).
//
// portrait fields:
//   skin, hair, iris
//   style   spiky | bob | buzz | long | mohawk | ponytail | braids | bald |
//           afro | undercut | hood (M5)
//   eyes    eyes | visor | android | cyber (one cybernetic eye) | goggles
//   accent  earpiece | halo | beard | mask | scar | headphones | freckles |
//           monocle | tattoo | faceplate | crown (M5)
//   twins   { ...second figure overrides } draws two pilots side by side
//   suit    flight-suit colour override

const TAU = Math.PI * 2;

function rgb(c, a = 1) { return `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`; }

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * k));
  const b = Math.min(255, Math.round((n & 255) * k));
  return `rgb(${r},${g},${b})`;
}

/**
 * @param canvas target canvas (any size, ~4:5 aspect)
 * @param def pilot definition (uses def.portrait, def.color) or a locked roster entry
 * @param t time in seconds (animation)
 */
export function drawPortrait(canvas, def, t = 0) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.scale(W / 120, H / 150);

  const col = def.color || [0.5, 0.5, 0.6];
  const P = def.portrait;

  // Background: tinted gradient + diagonal stripes + grid.
  const bg = ctx.createLinearGradient(0, 0, 120, 150);
  bg.addColorStop(0, rgb(col, 0.45));
  bg.addColorStop(0.6, '#0b0814');
  bg.addColorStop(1, '#030207');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 120, 150);
  ctx.strokeStyle = rgb(col, 0.12);
  ctx.lineWidth = 0.5;
  for (let x = -150; x < 120; x += 9) { ctx.beginPath(); ctx.moveTo(x, 150); ctx.lineTo(x + 150, 0); ctx.stroke(); }

  if (!P) { drawLocked(ctx, t); return; }

  if (P.legendary) legendaryBackdrop(ctx, t);

  if (P.twins) {
    // Two pilots: the second one behind and to the left.
    const P2 = { ...P, ...P.twins };
    for (const [dx, Q, s] of [[-20, P2, 0.84], [20, P, 0.84]]) {
      ctx.save();
      ctx.translate(60 + dx, 150); ctx.scale(s, s); ctx.translate(-60, -150);
      figure(ctx, Q, col, t + (Q === P2 ? 1.7 : 0));
      ctx.restore();
    }
  } else figure(ctx, P, col, t);

  overlay(ctx, t);
}

function figure(ctx, P, col, t) {
  const skin = P.skin, hair = P.hair;

  // Hair behind the head (long styles).
  if (P.style === 'long' || P.style === 'braids') {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.moveTo(33, 60); ctx.quadraticCurveTo(26, 110, 22, 134); ctx.lineTo(98, 134);
    ctx.quadraticCurveTo(94, 110, 87, 60); ctx.closePath(); ctx.fill();
    if (P.style === 'braids') {
      ctx.strokeStyle = shade(hair, 0.6); ctx.lineWidth = 0.8;
      for (const bx of [30, 38, 82, 90]) for (let y = 74; y < 132; y += 6) { ctx.beginPath(); ctx.moveTo(bx - 3, y); ctx.lineTo(bx + 3, y + 3); ctx.stroke(); }
    }
  }
  if (P.style === 'ponytail') {
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.moveTo(78, 42); ctx.quadraticCurveTo(100, 50, 96, 100); ctx.quadraticCurveTo(90, 70, 76, 52); ctx.closePath(); ctx.fill();
  }
  if (P.style === 'afro') {
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.ellipse(60, 50, 32, 28, 0, 0, TAU); ctx.fill();
  }
  if (P.style === 'hood') {
    // Hood / cowl behind the head (Vincenzo).
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.moveTo(26, 120); ctx.quadraticCurveTo(22, 30, 60, 22); ctx.quadraticCurveTo(98, 30, 94, 120); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgb(col, 0.9); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(30, 112); ctx.quadraticCurveTo(28, 34, 60, 27); ctx.quadraticCurveTo(92, 34, 90, 112); ctx.stroke();
  }

  // Shoulders / armoured flight suit.
  const suit = ctx.createLinearGradient(0, 105, 0, 150);
  suit.addColorStop(0, P.suit || '#2a2e3c'); suit.addColorStop(1, '#0a0b10');
  ctx.fillStyle = suit;
  ctx.beginPath();
  ctx.moveTo(4, 150); ctx.quadraticCurveTo(10, 118, 34, 112); ctx.lineTo(48, 104); ctx.lineTo(72, 104);
  ctx.lineTo(86, 112); ctx.quadraticCurveTo(110, 118, 116, 150); ctx.closePath(); ctx.fill();
  // Collar + trim.
  ctx.strokeStyle = rgb(col, 0.95); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(34, 113); ctx.lineTo(48, 122); ctx.lineTo(60, 124); ctx.lineTo(72, 122); ctx.lineTo(86, 113); ctx.stroke();
  ctx.fillStyle = rgb(col, 0.9); ctx.fillRect(14, 132, 18, 2.5);
  ctx.fillStyle = '#0d0f16'; ctx.fillRect(84, 128, 20, 9);
  ctx.fillStyle = rgb(col, 0.8); ctx.font = 'bold 5px monospace'; ctx.fillText(P.badge || 'NPD-9', 86, 134.5);

  // Neck.
  ctx.fillStyle = shade(skin, 0.78);
  ctx.fillRect(51, 88, 18, 22);
  if (P.eyes === 'android') {
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.6;
    for (let y = 92; y < 108; y += 3) { ctx.beginPath(); ctx.moveTo(51, y); ctx.lineTo(69, y); ctx.stroke(); }
  }

  // Head.
  const hg = ctx.createRadialGradient(52, 58, 4, 60, 66, 32);
  hg.addColorStop(0, shade(skin, 1.12)); hg.addColorStop(0.7, skin); hg.addColorStop(1, shade(skin, 0.7));
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(38, 60); ctx.quadraticCurveTo(37, 86, 52, 96); ctx.quadraticCurveTo(60, 101, 68, 96);
  ctx.quadraticCurveTo(83, 86, 82, 60); ctx.quadraticCurveTo(80, 36, 60, 35); ctx.quadraticCurveTo(40, 36, 38, 60);
  ctx.fill();

  // Synthetic face seams (android).
  if (P.eyes === 'android' || P.accent === 'faceplate') {
    ctx.strokeStyle = 'rgba(10,20,30,0.6)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(42, 74); ctx.lineTo(52, 92); ctx.moveTo(78, 74); ctx.lineTo(68, 92); ctx.moveTo(60, 36); ctx.lineTo(60, 48); ctx.stroke();
    ctx.fillStyle = rgb(col, 0.8); ctx.fillRect(40, 78, 4, 1); ctx.fillRect(76, 78, 4, 1);
  }

  // Accent features drawn on the face.
  if (P.accent === 'beard') {
    ctx.fillStyle = shade(hair, 1.1);
    ctx.beginPath(); ctx.moveTo(40, 72); ctx.quadraticCurveTo(42, 98, 60, 100); ctx.quadraticCurveTo(78, 98, 80, 72);
    ctx.quadraticCurveTo(74, 86, 60, 88); ctx.quadraticCurveTo(46, 86, 40, 72); ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,200,0.55)'; ctx.lineWidth = 0.8; // scar
    ctx.beginPath(); ctx.moveTo(71, 52); ctx.lineTo(76, 68); ctx.stroke();
  }
  if (P.accent === 'scar') {
    ctx.strokeStyle = 'rgba(255,215,200,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(44, 54); ctx.lineTo(52, 80); ctx.stroke();
  }
  if (P.accent === 'freckles') {
    ctx.fillStyle = shade(skin, 0.7);
    for (const [x, y] of [[47, 74], [50, 76], [53, 74], [67, 74], [70, 76], [73, 74], [49, 72], [71, 72]]) ctx.fillRect(x, y, 0.9, 0.9);
  }
  if (P.accent === 'tattoo') {
    ctx.strokeStyle = rgb(col, 0.8); ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(78, 60); ctx.lineTo(74, 70); ctx.lineTo(78, 80); ctx.moveTo(76, 66); ctx.lineTo(80, 70); ctx.stroke();
  }

  // Eyes.
  const blink = (t % 4.3) < 0.12;
  if (P.eyes === 'visor' || P.eyes === 'goggles') {
    ctx.fillStyle = '#05070c';
    ctx.beginPath(); ctx.moveTo(36, 58); ctx.lineTo(84, 58); ctx.lineTo(82, 70); ctx.lineTo(38, 70); ctx.closePath(); ctx.fill();
    if (P.eyes === 'goggles') {
      for (const ex of [49, 71]) {
        const g = ctx.createRadialGradient(ex - 2, 62, 1, ex, 64, 8);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, rgb(col)); g.addColorStop(1, '#05070c');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, 64, 7.5, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#6a6a72'; ctx.lineWidth = 1.4; ctx.stroke();
      }
    } else {
      const vg = ctx.createLinearGradient(38, 0, 82, 0);
      vg.addColorStop(0, rgb(col, 0.5)); vg.addColorStop(0.5, rgb(col, 1)); vg.addColorStop(1, rgb(col, 0.5));
      ctx.fillStyle = vg; ctx.fillRect(39, 61, 42, 5);
      const sx = 39 + ((t * 30) % 42);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(sx, 61, 3, 5);
    }
  } else if (P.eyes === 'android') {
    for (const ex of [49, 71]) {
      ctx.fillStyle = '#05080a';
      ctx.beginPath(); ctx.moveTo(ex - 7, 66); ctx.lineTo(ex + 7, 63); ctx.lineTo(ex + 7, 67); ctx.lineTo(ex - 7, 68); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rgb(col, blink ? 0.2 : 1);
      ctx.fillRect(ex - 5, 64.5 + (ex > 60 ? -0.6 : 0.6), 10, 1.6);
    }
  } else {
    for (const ex of [49, 71]) {
      if (P.eyes === 'cyber' && ex === 71) {
        ctx.fillStyle = '#0a0c12'; ctx.beginPath(); ctx.arc(ex, 65, 6.5, 0, TAU); ctx.fill();
        ctx.fillStyle = rgb(col, 0.7 + 0.3 * Math.sin(t * 4)); ctx.beginPath(); ctx.arc(ex, 65, 2.6, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#8a8e9a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(ex, 65, 6.5, 0, TAU); ctx.stroke();
        continue;
      }
      if (blink) {
        ctx.strokeStyle = '#1a1010'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(ex - 6, 66); ctx.lineTo(ex + 6, 66); ctx.stroke();
        continue;
      }
      ctx.fillStyle = '#f6f0ee';
      ctx.beginPath(); ctx.moveTo(ex - 7, 66); ctx.quadraticCurveTo(ex, 59, ex + 7, 66); ctx.quadraticCurveTo(ex, 70, ex - 7, 66); ctx.fill();
      ctx.fillStyle = P.iris || rgb(col);
      ctx.beginPath(); ctx.arc(ex + 0.5, 65.5, 3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0a0508'; ctx.beginPath(); ctx.arc(ex + 0.5, 65.5, 1.4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(ex + 1, 63.5, 1.2, 1.2);
      ctx.strokeStyle = '#1a1010'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(ex - 7, 66); ctx.quadraticCurveTo(ex, 58.5, ex + 7, 65); ctx.stroke();
    }
    // Brows.
    ctx.strokeStyle = shade(hair, 0.8); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(42, 57); ctx.lineTo(55, 56); ctx.moveTo(65, 56); ctx.lineTo(78, 57); ctx.stroke();
  }
  if (P.accent === 'monocle') {
    ctx.strokeStyle = '#d8c070'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(71, 65, 8, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(79, 66); ctx.quadraticCurveTo(84, 84, 80, 100); ctx.stroke();
  }

  // Nose + mouth (hidden behind mask accent).
  if (P.accent === 'mask' || P.accent === 'faceplate') {
    ctx.fillStyle = P.accent === 'faceplate' ? '#1a1c24' : '#100c16';
    ctx.beginPath(); ctx.moveTo(40, 74); ctx.lineTo(80, 74); ctx.quadraticCurveTo(78, 96, 60, 99); ctx.quadraticCurveTo(42, 96, 40, 74); ctx.fill();
    ctx.strokeStyle = rgb(col); ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(44, 80); ctx.lineTo(76, 80); ctx.stroke();
    ctx.fillStyle = rgb(col); ctx.fillRect(48, 86, 3, 1); ctx.fillRect(69, 86, 3, 1);
    if (P.accent === 'mask') { ctx.fillStyle = rgb(col, 0.8); ctx.fillRect(76, 64, 0.8, 8); } // face marking
  } else {
    ctx.strokeStyle = shade(skin, 0.6); ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(60, 70); ctx.lineTo(58, 79); ctx.lineTo(61, 80); ctx.stroke();
    ctx.strokeStyle = shade(skin, 0.5); ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(54, 87); ctx.quadraticCurveTo(60, 89, 66, 86.5); ctx.stroke();
  }

  // Hair on top.
  ctx.fillStyle = hair;
  switch (P.style) {
    case 'spiky':
      ctx.beginPath();
      ctx.moveTo(35, 62); ctx.lineTo(30, 44); ctx.lineTo(38, 46); ctx.lineTo(36, 30); ctx.lineTo(46, 38); ctx.lineTo(48, 22);
      ctx.lineTo(56, 34); ctx.lineTo(64, 20); ctx.lineTo(68, 34); ctx.lineTo(78, 24); ctx.lineTo(78, 38); ctx.lineTo(90, 36);
      ctx.lineTo(84, 48); ctx.lineTo(88, 58); ctx.lineTo(82, 56); ctx.lineTo(78, 46); ctx.lineTo(66, 44); ctx.lineTo(70, 52);
      ctx.lineTo(56, 44); ctx.lineTo(50, 52); ctx.lineTo(44, 46); ctx.lineTo(40, 56); ctx.closePath(); ctx.fill();
      break;
    case 'bob':
      ctx.beginPath();
      ctx.moveTo(34, 84); ctx.quadraticCurveTo(28, 40, 60, 31); ctx.quadraticCurveTo(92, 40, 86, 84); ctx.lineTo(80, 84);
      ctx.lineTo(80, 56); ctx.lineTo(70, 52); ctx.lineTo(62, 56); ctx.lineTo(52, 50); ctx.lineTo(40, 56); ctx.lineTo(40, 84); ctx.closePath();
      ctx.fill();
      break;
    case 'buzz':
    case 'undercut':
      ctx.beginPath();
      ctx.moveTo(38, 56); ctx.quadraticCurveTo(38, 32, 60, 31); ctx.quadraticCurveTo(82, 32, 82, 56);
      ctx.quadraticCurveTo(76, 44, 60, 43); ctx.quadraticCurveTo(44, 44, 38, 56); ctx.fill();
      if (P.style === 'undercut') {
        ctx.beginPath(); ctx.moveTo(44, 40); ctx.quadraticCurveTo(64, 18, 90, 34); ctx.quadraticCurveTo(80, 44, 64, 46); ctx.quadraticCurveTo(52, 44, 44, 40); ctx.fill();
      }
      break;
    case 'long':
    case 'braids':
      ctx.beginPath();
      ctx.moveTo(34, 70); ctx.quadraticCurveTo(30, 34, 60, 30); ctx.quadraticCurveTo(90, 34, 86, 70);
      ctx.lineTo(80, 50); ctx.quadraticCurveTo(66, 50, 58, 42); ctx.quadraticCurveTo(52, 52, 40, 52); ctx.closePath(); ctx.fill();
      break;
    case 'mohawk':
      ctx.beginPath(); ctx.moveTo(52, 44); ctx.lineTo(50, 18); ctx.lineTo(58, 26); ctx.lineTo(60, 12); ctx.lineTo(64, 24); ctx.lineTo(72, 16); ctx.lineTo(70, 44); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(skin, 0.85); ctx.fillRect(40, 44, 8, 8); ctx.fillRect(72, 44, 8, 8);
      break;
    case 'ponytail':
      ctx.beginPath(); ctx.moveTo(37, 58); ctx.quadraticCurveTo(36, 31, 60, 30); ctx.quadraticCurveTo(84, 31, 83, 58);
      ctx.quadraticCurveTo(76, 40, 60, 40); ctx.quadraticCurveTo(46, 42, 37, 58); ctx.fill();
      break;
    case 'afro':
      ctx.beginPath(); ctx.ellipse(60, 40, 30, 14, 0, Math.PI, TAU); ctx.fill();
      break;
    case 'hood':
      ctx.beginPath(); ctx.moveTo(36, 62); ctx.quadraticCurveTo(36, 30, 60, 28); ctx.quadraticCurveTo(84, 30, 84, 62); ctx.quadraticCurveTo(76, 40, 60, 40); ctx.quadraticCurveTo(44, 40, 36, 62); ctx.fill();
      break;
    case 'bald':
    default:
      break;
  }
  // Hair sheen.
  if (P.style !== 'bald') {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(46, 38); ctx.quadraticCurveTo(56, 33, 68, 36); ctx.stroke();
  }

  if (P.accent === 'halo') {
    ctx.save(); ctx.shadowColor = rgb(col); ctx.shadowBlur = 8;
    ctx.strokeStyle = rgb(col); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(60, 26, 22, 5, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
  if (P.accent === 'crown') {
    ctx.save(); ctx.shadowColor = '#ffd870'; ctx.shadowBlur = 10;
    ctx.strokeStyle = '#ffe6a0'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(60, 20, 26, 6, 0, 0, TAU); ctx.stroke();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + t * 0.4;
      ctx.beginPath(); ctx.moveTo(60 + Math.cos(a) * 26, 20 + Math.sin(a) * 6); ctx.lineTo(60 + Math.cos(a) * 30, 20 + Math.sin(a) * 7 - 4); ctx.stroke();
    }
    ctx.restore();
  }
  if (P.accent === 'earpiece' || P.accent === 'headphones') {
    if (P.accent === 'headphones') {
      ctx.strokeStyle = '#141820'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(60, 60, 26, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      for (const x of [33, 83]) { ctx.fillStyle = '#141820'; ctx.beginPath(); ctx.ellipse(x, 66, 5, 9, 0, 0, TAU); ctx.fill(); ctx.fillStyle = rgb(col, 0.7 + 0.3 * Math.sin(t * 8)); ctx.fillRect(x - 1, 62, 2, 8); }
    } else {
      ctx.fillStyle = '#10141c'; ctx.fillRect(80, 60, 5, 12);
      ctx.fillStyle = rgb(col, 0.6 + 0.4 * Math.sin(t * 6)); ctx.fillRect(81.5, 62, 2, 2);
      ctx.strokeStyle = '#10141c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(82, 72); ctx.lineTo(70, 84); ctx.stroke();
    }
  }

  // Rim light on the right edge.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgb(col, 0.55 + 0.1 * Math.sin(t * 3));
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(82, 58); ctx.quadraticCurveTo(83, 86, 68, 96); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(86, 112); ctx.quadraticCurveTo(108, 118, 114, 150); ctx.stroke();
  ctx.restore();
}

/** Gold rays and void behind the Legendary pilot. */
function legendaryBackdrop(ctx, t) {
  ctx.fillStyle = '#020104'; ctx.fillRect(0, 0, 120, 150);
  ctx.save();
  ctx.translate(60, 58);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU + t * 0.15;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - 0.06) * 140, Math.sin(a - 0.06) * 140); ctx.lineTo(Math.cos(a + 0.06) * 140, Math.sin(a + 0.06) * 140); ctx.closePath();
    ctx.fillStyle = k % 2 ? 'rgba(255,214,120,0.12)' : 'rgba(255,255,255,0.05)'; ctx.fill();
  }
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
  g.addColorStop(0, 'rgba(255,230,160,0.45)'); g.addColorStop(1, 'rgba(255,230,160,0)');
  ctx.fillStyle = g; ctx.fillRect(-60, -60, 120, 120);
  ctx.restore();
}

function drawLocked(ctx, t) {
  ctx.fillStyle = '#05040a';
  ctx.beginPath();
  ctx.moveTo(4, 150); ctx.quadraticCurveTo(10, 118, 34, 112); ctx.lineTo(48, 104); ctx.lineTo(48, 92);
  ctx.quadraticCurveTo(36, 80, 38, 58); ctx.quadraticCurveTo(40, 34, 60, 34); ctx.quadraticCurveTo(80, 34, 82, 58);
  ctx.quadraticCurveTo(84, 80, 72, 92); ctx.lineTo(72, 104); ctx.lineTo(86, 112); ctx.quadraticCurveTo(110, 118, 116, 150);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,60,120,0.85)';
  ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('?', 60, 76);
  overlay(ctx, t);
}

function overlay(ctx, t) {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < 150; y += 2) ctx.fillRect(0, y, 120, 0.7);
  const sy = (t * 40) % 170 - 10;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(0, sy, 120, 6);
  const v = ctx.createRadialGradient(60, 75, 40, 60, 75, 95);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, 120, 150);
}
