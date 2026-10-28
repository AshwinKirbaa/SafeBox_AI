export function buildConnectionPayload({ name, provider, baseUrl, secret, editId }) {
  const payload = {
    name: name.trim(),
    model: 'connection-default',
    model_type: 'chat'
  };

  if (!editId) payload.provider = provider;

  const normalizedBaseUrl = baseUrl.trim();
  if (normalizedBaseUrl) payload.base_url = normalizedBaseUrl;

  const normalizedSecret = secret.trim();
  if (normalizedSecret) payload.api_key = normalizedSecret;

  return payload;
}
