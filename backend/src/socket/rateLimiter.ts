/** Token bucket per socket and event category. Cheap enough to check on every event. */
export class TokenBucket {
  private tokens: number;
  private last = Date.now();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
  ) {
    this.tokens = capacity;
  }

  take(cost = 1): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.refillPerSecond);
    this.last = now;
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }
}

export const BUCKETS = {
  join: [10, 0.5],
  scene: [120, 40],
  presence: [80, 40],
  chat: [8, 1],
  comment: [10, 1],
  rtc: [300, 60],
  misc: [30, 5],
} as const satisfies Record<string, readonly [number, number]>;

export type BucketName = keyof typeof BUCKETS;

export function createLimiter() {
  const buckets = new Map<BucketName, TokenBucket>();
  return (name: BucketName, cost = 1) => {
    let bucket = buckets.get(name);
    if (!bucket) {
      const [capacity, refill] = BUCKETS[name];
      bucket = new TokenBucket(capacity, refill);
      buckets.set(name, bucket);
    }
    return bucket.take(cost);
  };
}
