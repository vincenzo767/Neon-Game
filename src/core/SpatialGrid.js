// Uniform-grid spatial hash with zero per-frame allocation.
//
// Rebuilt every step: clear(), insert all items, then query. Each cell is a
// singly linked list stored in typed arrays (cellHead -> entry -> entryNext).
// Items spanning several cells get one entry per cell; queries de-duplicate
// with a per-item stamp so each item is reported once.

export class SpatialGrid {
  /**
   * @param {number} width world width covered
   * @param {number} height world height covered
   * @param {number} cellSize cell edge length
   * @param {number} maxItems max distinct item ids
   * @param {number} maxEntries max (item, cell) pairs
   */
  constructor(width, height, cellSize, maxItems, maxEntries = maxItems * 2) {
    this.cell = cellSize;
    this.inv = 1 / cellSize;
    this.cols = Math.ceil(width / cellSize) + 2; // +2: one margin cell per side
    this.rows = Math.ceil(height / cellSize) + 2;
    this.head = new Int32Array(this.cols * this.rows).fill(-1);
    this.entryItem = new Int32Array(maxEntries);
    this.entryNext = new Int32Array(maxEntries);
    this.entryCount = 0;
    this.stamp = new Uint32Array(maxItems);
    this.queryId = 0;
    this.results = new Int32Array(maxItems);
  }

  clear() {
    this.head.fill(-1);
    this.entryCount = 0;
  }

  _cx(x) {
    const c = Math.floor(x * this.inv) + 1;
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  _cy(y) {
    const c = Math.floor(y * this.inv) + 1;
    return c < 0 ? 0 : c >= this.rows ? this.rows - 1 : c;
  }

  insertPoint(item, x, y) {
    if (this.entryCount >= this.entryItem.length) return;
    const ci = this._cy(y) * this.cols + this._cx(x);
    const e = this.entryCount++;
    this.entryItem[e] = item;
    this.entryNext[e] = this.head[ci];
    this.head[ci] = e;
  }

  insertAABB(item, minX, minY, maxX, maxY) {
    const x0 = this._cx(minX), x1 = this._cx(maxX);
    const y0 = this._cy(minY), y1 = this._cy(maxY);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (this.entryCount >= this.entryItem.length) return;
        const ci = cy * this.cols + cx;
        const e = this.entryCount++;
        this.entryItem[e] = item;
        this.entryNext[e] = this.head[ci];
        this.head[ci] = e;
      }
    }
  }

  /**
   * Collect unique items in cells overlapping the box into `this.results`.
   * @returns {number} number of results
   */
  queryAABB(minX, minY, maxX, maxY) {
    const q = ++this.queryId;
    if (q === 0xffffffff) { this.stamp.fill(0); this.queryId = 1; }
    const x0 = this._cx(minX), x1 = this._cx(maxX);
    const y0 = this._cy(minY), y1 = this._cy(maxY);
    const out = this.results;
    let n = 0;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        let e = this.head[cy * this.cols + cx];
        while (e !== -1) {
          const it = this.entryItem[e];
          if (this.stamp[it] !== this.queryId) {
            this.stamp[it] = this.queryId;
            out[n++] = it;
          }
          e = this.entryNext[e];
        }
      }
    }
    return n;
  }

  queryCircle(x, y, r) {
    return this.queryAABB(x - r, y - r, x + r, y + r);
  }
}
