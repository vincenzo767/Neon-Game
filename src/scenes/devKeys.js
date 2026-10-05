// Developer toggles shared by scenes (raw keys, not remappable).
// T = CRT, G = quality, H = shake. Returns a banner message or null.

export function handleDevKeys(g) {
  const inp = g.input, s = g.settings;
  if (inp.keyPressed('KeyT')) {
    s.set('crt', !s.data.crt);
    return [`CRT ${s.data.crt ? 'ON' : 'OFF'}`, 'DISPLAY FILTER'];
  }
  if (inp.keyPressed('KeyG')) {
    const order = ['high', 'medium', 'low'];
    const q = order[(order.indexOf(s.data.quality) + 1) % 3];
    s.set('quality', q);
    return [`QUALITY ${q.toUpperCase()}`, 'RENDER SCALE'];
  }
  if (inp.keyPressed('KeyH')) {
    const levels = [0, 0.5, 1, 1.5];
    s.set('shake', levels[(levels.indexOf(s.data.shake) + 1) % levels.length]);
    return [`SHAKE ${Math.round(s.data.shake * 100)}%`, 'SCREEN SHAKE'];
  }
  return null;
}
