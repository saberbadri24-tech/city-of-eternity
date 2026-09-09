export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ ok: true, service: 'ANIL X', runtime: 'cloudflare-pages-worker' }), { headers: { 'content-type': 'application/json; charset=utf-8' } });
    }
    return env.ASSETS.fetch(request);
  }
};
