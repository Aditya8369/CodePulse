/**
 * Chase-Lev Lock-Free Work-Stealing Double-Ended Queue (Deque)
 * Reference: "Dynamic Circular Work-Stealing Deque" (Chase & Lev, SPAA 2005)
 *
 * Owner: pushes and pops from the BOTTOM (LIFO, optimal cache locality).
 * Thieves: steal from the TOP (FIFO, steals oldest/largest subproblems).
 */

export const EMPTY = Symbol('EMPTY');
export const ABORT = Symbol('ABORT');

export type DequeResult<T> = T | typeof EMPTY | typeof ABORT;

export class ChaseLevDeque<T> {
  private capacity: number;
  private mask: number;
  private buffer: Array<T | null>;

  // Atomic pointers: top index and bottom index
  private readonly controlBuffer: SharedArrayBuffer;
  private readonly controlView: Int32Array;

  // Offsets in controlView
  private static readonly TOP_INDEX = 0;
  private static readonly BOTTOM_INDEX = 1;

  constructor(initialCapacity = 256) {
    this.capacity = this.nextPowerOfTwo(initialCapacity);
    this.mask = this.capacity - 1;
    this.buffer = new Array<T | null>(this.capacity).fill(null);

    this.controlBuffer = new SharedArrayBuffer(8); // 2 x 32-bit ints
    this.controlView = new Int32Array(this.controlBuffer);
    Atomics.store(this.controlView, ChaseLevDeque.TOP_INDEX, 0);
    Atomics.store(this.controlView, ChaseLevDeque.BOTTOM_INDEX, 0);
  }

  private nextPowerOfTwo(n: number): number {
    let p = 1;
    while (p < n) p <<= 1;
    return p;
  }

  public getTop(): number {
    return Atomics.load(this.controlView, ChaseLevDeque.TOP_INDEX);
  }

  public getBottom(): number {
    return Atomics.load(this.controlView, ChaseLevDeque.BOTTOM_INDEX);
  }

  public size(): number {
    const b = this.getBottom();
    const t = this.getTop();
    return Math.max(0, b - t);
  }

  public isEmpty(): boolean {
    return this.size() === 0;
  }

  /**
   * PUSH BOTTOM (Invoked strictly by the owner thread)
   * Appends element to the bottom of the deque. Resizes circular array if capacity exceeded.
   */
  public pushBottom(item: T): void {
    const b = Atomics.load(this.controlView, ChaseLevDeque.BOTTOM_INDEX);
    const t = Atomics.load(this.controlView, ChaseLevDeque.TOP_INDEX);
    const size = b - t;

    if (size >= this.capacity - 1) {
      this.resize(b, t);
    }

    this.buffer[b & this.mask] = item;
    // Memory fence / barrier: bottom is incremented after item is stored
    Atomics.store(this.controlView, ChaseLevDeque.BOTTOM_INDEX, b + 1);
  }

  /**
   * POP BOTTOM (Invoked strictly by the owner thread)
   * Pops most recently pushed element from the bottom (LIFO).
   */
  public popBottom(): DequeResult<T> {
    const b = Atomics.load(this.controlView, ChaseLevDeque.BOTTOM_INDEX) - 1;
    Atomics.store(this.controlView, ChaseLevDeque.BOTTOM_INDEX, b);

    const t = Atomics.load(this.controlView, ChaseLevDeque.TOP_INDEX);
    const size = b - t;

    if (size < 0) {
      // Deque was empty; reset bottom to top
      Atomics.store(this.controlView, ChaseLevDeque.BOTTOM_INDEX, t);
      return EMPTY;
    }

    const item = this.buffer[b & this.mask];
    if (size > 0) {
      // More than 1 item remained, no race with thieves possible
      this.buffer[b & this.mask] = null;
      return item as T;
    }

    // Exactly 1 item remained: potential race with concurrent thief stealing from TOP
    const wonCas =
      Atomics.compareExchange(
        this.controlView,
        ChaseLevDeque.TOP_INDEX,
        t,
        t + 1,
      ) === t;

    Atomics.store(this.controlView, ChaseLevDeque.BOTTOM_INDEX, t + 1);
    this.buffer[b & this.mask] = null;

    if (wonCas) {
      return item as T;
    }

    // Lost race to thief
    return EMPTY;
  }

  /**
   * STEAL TOP (Invoked concurrently by idle thief threads)
   * Steals the oldest element from the top of the deque (FIFO).
   */
  public stealTop(): DequeResult<T> {
    const t = Atomics.load(this.controlView, ChaseLevDeque.TOP_INDEX);
    const b = Atomics.load(this.controlView, ChaseLevDeque.BOTTOM_INDEX);

    const size = b - t;
    if (size <= 0) {
      return EMPTY;
    }

    const item = this.buffer[t & this.mask];

    // Attempt atomic CAS to claim top element
    const prev = Atomics.compareExchange(
      this.controlView,
      ChaseLevDeque.TOP_INDEX,
      t,
      t + 1,
    );

    if (prev === t) {
      // Successfully stole item!
      return item as T;
    }

    // Lost CAS race to another thief or owner pop
    return ABORT;
  }

  private resize(b: number, t: number): void {
    const newCapacity = this.capacity * 2;
    const newMask = newCapacity - 1;
    const newBuffer = new Array<T | null>(newCapacity).fill(null);

    for (let i = t; i < b; i++) {
      newBuffer[i & newMask] = this.buffer[i & this.mask];
    }

    this.buffer = newBuffer;
    this.capacity = newCapacity;
    this.mask = newMask;
  }
}
