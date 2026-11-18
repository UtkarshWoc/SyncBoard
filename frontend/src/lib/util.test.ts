import { afterEach, describe, expect, it, vi } from 'vitest';
import { safeNext } from '../components/RouteGuards';
import { formatDuration, initials, throttle, timeAgo } from './util';

afterEach(() => {
  vi.useRealTimers();
});

describe('throttle', () => {
  it('runs immediately, then at most once per window with the latest args', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const t = throttle(fn, 100);
    t(1);
    t(2);
    t(3);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith(1);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(3);
  });

  it('flush runs a pending call now; cancel drops it', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const t = throttle(fn, 100);
    t('a');
    t('b');
    t.flush();
    expect(fn).toHaveBeenLastCalledWith('b');
    t('c');
    t.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('formatting', () => {
  it('formats relative times', () => {
    const now = Date.parse('2026-10-12T12:00:00Z');
    expect(timeAgo('2026-10-12T11:59:40Z', now)).toBe('just now');
    expect(timeAgo('2026-10-12T11:55:00Z', now)).toMatch(/5 minutes ago/);
    expect(timeAgo('2026-10-10T12:00:00Z', now)).toMatch(/2 days ago/);
  });

  it('formats durations', () => {
    expect(formatDuration(30_000)).toBe('0m');
    expect(formatDuration(45 * 60_000)).toBe('45m');
    expect(formatDuration(125 * 60_000)).toBe('2h 5m');
  });

  it('builds initials', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('  ada  ')).toBe('A');
    expect(initials('Mary Ann Evans')).toBe('ME');
  });
});

describe('safeNext', () => {
  it('only allows same-site relative paths', () => {
    expect(safeNext('/board/ABCD2345')).toBe('/board/ABCD2345');
    expect(safeNext(null)).toBe('/');
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext('//evil.example')).toBe('/');
    expect(safeNext('javascript:alert(1)')).toBe('/');
  });
});
