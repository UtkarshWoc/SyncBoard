import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __testing,
  api,
  ApiRequestError,
  errorMessage,
  getFreshAccessToken,
  onSessionChange,
  refreshSession,
} from './api';

const user = {
  id: 'u1',
  displayName: 'Ada',
  avatarUrl: null,
  email: 'ada@example.com',
  emailVerified: true,
  hasPassword: true,
  hasGoogle: false,
  createdAt: new Date().toISOString(),
};

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  __testing.setSession(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('refreshSession', () => {
  it('shares one request between concurrent callers', async () => {
    fetchMock.mockResolvedValue(json(200, { accessToken: 'a1', expiresIn: 900, user }));
    const [a, b, c] = await Promise.all([refreshSession(), refreshSession(), getFreshAccessToken()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a?.accessToken).toBe('a1');
    expect(b).toBe(a);
    expect(c).toBe('a1');
  });

  it('sends the CSRF header and credentials', async () => {
    fetchMock.mockResolvedValue(json(200, { accessToken: 'a1', expiresIn: 900, user }));
    await refreshSession();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/auth/refresh');
    expect(init.credentials).toBe('include');
    expect(init.headers['X-Requested-With']).toBe('syncboard');
  });

  it('clears the session and notifies listeners when refresh fails', async () => {
    __testing.setSession({ accessToken: 'old', expiresIn: 900, user });
    const listener = vi.fn();
    const off = onSessionChange(listener);
    fetchMock.mockResolvedValue(json(401, { error: { code: 'UNAUTHORIZED', message: 'no' } }));
    expect(await refreshSession()).toBeNull();
    expect(listener).toHaveBeenCalledWith(null);
    expect(__testing.getAccessToken()).toBeNull();
    off();
  });
});

describe('authenticated requests', () => {
  it('attaches the access token', async () => {
    __testing.setSession({ accessToken: 'tok', expiresIn: 900, user });
    fetchMock.mockResolvedValue(json(200, { owned: [], shared: [], public: [] }));
    await api.listBoards();
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe('Bearer tok');
  });

  it('refreshes once and retries after a 401', async () => {
    __testing.setSession({ accessToken: 'stale', expiresIn: 900, user });
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } }))
      .mockResolvedValueOnce(json(200, { accessToken: 'fresh', expiresIn: 900, user }))
      .mockResolvedValueOnce(json(200, { owned: [], shared: [], public: [] }));
    const lists = await api.listBoards();
    expect(lists.owned).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]![1].headers.Authorization).toBe('Bearer fresh');
  });

  it('maps API errors to ApiRequestError with code and message', async () => {
    __testing.setSession({ accessToken: 'tok', expiresIn: 900, user });
    fetchMock.mockResolvedValue(
      json(403, { error: { code: 'PASSWORD_REQUIRED', message: 'Locked', details: { name: 'X' } } }),
    );
    const err = await api.getBoard('ABCDEFGH').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({ status: 403, code: 'PASSWORD_REQUIRED', message: 'Locked', details: { name: 'X' } });
    expect(errorMessage(err)).toBe('Locked');
  });

  it('reports network failures in plain language', async () => {
    __testing.setSession({ accessToken: 'tok', expiresIn: 900, user });
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api.listBoards()).rejects.toMatchObject({
      code: 'INTERNAL',
      message: expect.stringContaining('reach the server'),
    });
  });
});
