export const CONTRACT_TESTS_BY_TYPE = {
  embedding: [{ test_id: 'embedding-vector-integrity', name: 'Embedding vector integrity', category: 'contract_validation', description: 'Submits distinct bounded text inputs and validates finite vectors, stable dimensions, and input separation.', expected_behavior: 'The endpoint returns distinct finite vectors with a consistent dimension.', is_contract_probe: true }],
  image_generation: [{ test_id: 'image-output-contract', name: 'Generated image output integrity', category: 'contract_validation', description: 'Requests one bounded image and validates that a URL or Base64 image payload is returned.', expected_behavior: 'The endpoint returns a non-empty valid image payload.', is_contract_probe: true }],
  speech_to_text: [{ test_id: 'transcription-contract', name: 'Audio transcription contract', category: 'contract_validation', description: 'Submits a bounded silent WAV fixture and validates the transcription response schema.', expected_behavior: 'The endpoint returns a valid transcript field.', is_contract_probe: true }],
  text_to_speech: [{ test_id: 'speech-output-contract', name: 'Speech audio output integrity', category: 'contract_validation', description: 'Requests bounded speech and validates the returned audio payload and content type.', expected_behavior: 'The endpoint returns a non-empty audio payload.', is_contract_probe: true }],
  classification: [{ test_id: 'classification-contract', name: 'Classification result integrity', category: 'contract_validation', description: 'Submits a bounded classification input and validates the returned label contract.', expected_behavior: 'The endpoint returns a valid label or label collection.', is_contract_probe: true }],
  regression: [{ test_id: 'regression-contract', name: 'Regression result integrity', category: 'contract_validation', description: 'Submits a bounded numeric prediction input and validates that the result is finite.', expected_behavior: 'The endpoint returns a finite numeric prediction.', is_contract_probe: true }],
  reranking: [{ test_id: 'reranking-contract', name: 'Reranking result integrity', category: 'contract_validation', description: 'Submits a query and two bounded documents, then validates the ranked result list.', expected_behavior: 'The endpoint returns non-empty ranked results.', is_contract_probe: true }],
  custom: [{ test_id: 'custom-response-contract', name: 'Custom response-path integrity', category: 'contract_validation', description: 'Runs the configured custom request template and validates that its response path resolves.', expected_behavior: 'The configured response path resolves to a non-empty value.', is_contract_probe: true }]
};

export function isModelCompatibleWithType(modelName, type, connection = null, probes = {}) {
  const probeKey = connection ? `${connection.connection_id}|${modelName}|${type}` : '';
  if (probes[probeKey] && probes[probeKey].compatible != null) return probes[probeKey].compatible;
  const name = (modelName || '').toLowerCase();
  switch (type) {
    case 'embedding': return /(^|[\/:._-])(embed|embedding|bge|e5|gte|nomic|minilm|jina|voyage|ada)([\/:._-]|$)/.test(name);
    case 'image_generation': return /(flux|dall-e|diffusion|sdxl|stable-diffusion|imagen|image-gen|image_generation|recraft|ideogram|seedream|riverflow|hidream)/.test(name);
    case 'speech_to_text': return /(whisper|(^|[\/:._-])stt([\/:._-]|$)|transcri)/.test(name);
    case 'text_to_speech': return /((^|[\/:._-])tts([\/:._-]|$)|text-to-speech|speech-synthesis|voice)/.test(name);
    case 'vision': return /(vision|multimodal|4o|claude-3|claude-sonnet|gemini|llava|bakllava|pixtral|qwen.*vl|vl-|vl:)/.test(name);
    case 'reranking': return /(rerank|reranker|cross-encoder|ranker)/.test(name);
    case 'classification': return /(classif|classifier|sentiment|zero-shot)/.test(name);
    case 'regression': return /(regression|regressor|forecast)/.test(name);
    case 'chat': return !/(embed|whisper|flux|diffusion|rerank|text-to-speech|speech-synthesis)/.test(name);
    default: return false;
  }
}

export function getEligibleTests(tests, modelType) {
  if (CONTRACT_TESTS_BY_TYPE[modelType]) return CONTRACT_TESTS_BY_TYPE[modelType];
  if (modelType === 'vision') return tests.filter(t => (t.required_capabilities || []).includes('vision'));
  if (modelType === 'chat') return tests.filter(t => !(t.required_capabilities || []).includes('vision'));
  return [];
}

export function getCandidateModelsForType(modelNames, type, connection = null, probes = {}) {
  const names = Array.isArray(modelNames) ? modelNames.filter(Boolean) : [];
  const positivelyMatched = [];
  const unverified = [];
  for (const name of names) {
    const key = connection ? `${connection.connection_id}|${name}|${type}` : '';
    const probe = probes[key];
    if (probe?.compatible === false) continue;
    if (probe?.compatible === true || isModelCompatibleWithType(name, type, connection, probes)) positivelyMatched.push(name);
    else unverified.push(name);
  }
  return [...positivelyMatched, ...unverified];
}
