export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ ok: true, service: 'ANIL X' }), { headers: { 'content-type': 'application/json' } });
    }
    return env.ASSETS.fetch(request);
  }
};
