const BACKEND_ORIGIN = 'https://safebox-ai-api.onrender.com';

export default async function handler(request, response) {
  const token = process.env.SAFEBOX_RENDER_API_TOKEN;
  const accessKey = process.env.SAFEBOX_APP_ACCESS_KEY;
  if (!token || !accessKey) {
    return response.status(503).json({
      error: { code: 'proxy_not_configured', message: 'Backend proxy credentials are not configured.' },
    });
  }
  if (request.headers['x-safebox-access-key'] !== accessKey) {
    return response.status(401).json({
      error: { code: 'unauthorized', message: 'A valid SafeBox access key is required.' },
    });
  }

  const incoming = new URL(request.url, 'https://safebox-ai.vercel.app');
  const target = new URL(incoming.pathname + incoming.search, BACKEND_ORIGIN);
  const headers = {
    Accept: request.headers.accept || 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (request.headers['content-type']) headers['Content-Type'] = request.headers['content-type'];

  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const body = hasBody && request.body !== undefined
    ? (typeof request.body === 'string' ? request.body : JSON.stringify(request.body))
    : undefined;

  try {
    const upstream = await fetch(target, { method: request.method, headers, body });
    const payload = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get('content-type');
    if (contentType) response.setHeader('Content-Type', contentType);
    response.setHeader('Cache-Control', 'no-store');
    return response.status(upstream.status).send(payload);
  } catch {
    return response.status(502).json({
      error: { code: 'backend_unavailable', message: 'The backend is temporarily unavailable.' },
    });
  }
}
