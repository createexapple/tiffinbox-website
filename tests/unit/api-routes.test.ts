import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidateTag = vi.fn();
vi.mock('next/cache', () => ({
  revalidateTag,
  unstable_cache: (fn: unknown) => fn,
  updateTag: vi.fn(),
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({}),
  draftMode: async () => ({ isEnabled: false }),
}));
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
      }),
  },
  connection: async () => undefined,
}));

const SECRET = 'a-long-enough-shared-secret';

function post(headers: Record<string, string> = {}, body?: string): Request {
  return new Request('http://localhost/api/revalidate', {
    method: 'POST',
    headers: { 'x-forwarded-for': '198.51.100.1', ...headers },
    ...(body !== undefined ? { body } : {}),
  });
}

beforeEach(() => {
  revalidateTag.mockReset();
  vi.resetModules();
  process.env.REVALIDATE_SECRET = SECRET;
});

describe('POST /api/revalidate', () => {
  it('answers 503 (never "open") when no secret is configured', async () => {
    delete process.env.REVALIDATE_SECRET;
    const { POST } = await import('../../app/api/revalidate/route');
    const res = await POST(post({ authorization: `Bearer ${SECRET}` }));
    expect(res.status).toBe(503);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('answers 401 without the secret, with a wrong secret, and with another auth scheme', async () => {
    const { POST } = await import('../../app/api/revalidate/route');
    expect((await POST(post())).status).toBe(401);
    expect((await POST(post({ authorization: 'Bearer wrong-secret-value' }))).status).toBe(401);
    expect((await POST(post({ authorization: `Basic ${SECRET}` }))).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('expires the public content tag with the right secret', async () => {
    const { POST } = await import('../../app/api/revalidate/route');
    const res = await POST(
      post({ authorization: `Bearer ${SECRET}` }, JSON.stringify({ reason: 'menu_go_live' })),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ revalidated: true });
    expect(revalidateTag).toHaveBeenCalledWith('public-content', { expire: 0 });
  });

  it('accepts an empty body, rejects a bad reason and a non-JSON body', async () => {
    const { POST } = await import('../../app/api/revalidate/route');
    const auth = { authorization: `Bearer ${SECRET}` };
    expect((await POST(post(auth))).status).toBe(200);
    expect((await POST(post(auth, JSON.stringify({ reason: 'whatever' })))).status).toBe(400);
    expect((await POST(post(auth, 'not json'))).status).toBe(400);
  });

  it('rate limits per caller address (429)', async () => {
    const { POST } = await import('../../app/api/revalidate/route');
    let last = 200;
    for (let i = 0; i < 31; i += 1)
      last = (await POST(post({ 'x-forwarded-for': '198.51.100.99' }))).status;
    expect(last).toBe(429);
  });
});

describe('GET /api/health', () => {
  it('is up without touching the backend and reports the version', async () => {
    process.env.APP_VERSION = 'v-test';
    const { GET } = await import('../../app/api/health/route');
    const res = GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', version: 'v-test' });
  });
});
