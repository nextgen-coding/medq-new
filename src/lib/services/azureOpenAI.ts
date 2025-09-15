// Lightweight Azure OpenAI REST client using fetch to avoid extra deps

export type AzureConfig = {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion?: string;
};

export function getAzureConfigFromEnv(): AzureConfig | null {
  const endpoint =
    process.env.AZURE_OPENAI_ENDPOINT ||
    process.env.AZURE_OPENAI_RESOURCE ||
    process.env.AZURE_OPENAI_TARGET ||
    '';
  const apiKey = process.env.AZURE_OPENAI_API_KEY || '';
  const deployment =
    process.env.AZURE_OPENAI_DEPLOYMENT ||
    process.env.AZURE_OPENAI_MODEL ||
    process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ||
    '';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-05-01-preview';
  if (!endpoint || !apiKey || !deployment) return null;
  const normalized = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
  return { endpoint: normalized, apiKey, deployment, apiVersion };
}

export function getAzureEmbeddingConfigFromEnv(): AzureConfig | null {
  const endpoint =
    process.env.AZURE_OPENAI_ENDPOINT ||
    process.env.AZURE_OPENAI_RESOURCE ||
    process.env.AZURE_OPENAI_TARGET ||
    '';
  const apiKey = process.env.AZURE_OPENAI_API_KEY || '';
  const deployment =
    process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT ||
    process.env.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT ||
    '';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-05-01-preview';
  if (!endpoint || !apiKey || !deployment) return null;
  const normalized = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
  return { endpoint: normalized, apiKey, deployment, apiVersion };
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function chatCompletions(messages: ChatMessage[], cfg?: AzureConfig): Promise<string> {
  const conf = cfg || getAzureConfigFromEnv();
  if (!conf) throw new Error('Azure OpenAI is not configured');
  const url = `${conf.endpoint}/openai/deployments/${encodeURIComponent(conf.deployment)}/chat/completions?api-version=${encodeURIComponent(conf.apiVersion || '2024-05-01-preview')}`;
  // Azure requires that messages contain the literal word "json" when using response_format=json_object
  const msgs: ChatMessage[] = Array.isArray(messages) ? [...messages] : [];
  const hasJsonWord = msgs.some(m => typeof m?.content === 'string' && /json/i.test(m.content));
  if (!hasJsonWord) {
    msgs.unshift({ role: 'system', content: 'Return a strict JSON object only. Reply in json. No prose.' });
  }
  const body = {
    messages: msgs,
    response_format: { type: 'json_object' }
  } as any;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': conf.apiKey
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    let txt = '';
    let json: any = null;
    try { json = await res.json(); txt = JSON.stringify(json); } catch { try { txt = await res.text(); } catch { txt = ''; } }
    // Provide clearer guidance for common errors
    if (res.status === 404 && (json?.error?.code === 'DeploymentNotFound' || /DeploymentNotFound/i.test(txt))) {
      throw new Error(
        `Azure OpenAI deployment not found (404). Verify:\n` +
        `- Endpoint points to the correct Azure OpenAI resource: ${conf.endpoint}\n` +
        `- The deployment NAME exists under that resource (not the model name). Current: ${conf.deployment}\n` +
        `- The model is available in the resource's region and subscription.`
      );
    }
    if (res.status === 401) {
      throw new Error('Azure OpenAI unauthorized (401). Check AZURE_OPENAI_API_KEY and resource access policies.');
    }
    throw new Error(`Azure OpenAI error ${res.status}: ${txt}`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') throw new Error('No content from Azure OpenAI');
  return content;
}

export function isAzureConfigured() {
  return !!getAzureConfigFromEnv();
}

export async function listDeployments(cfg?: AzureConfig): Promise<{ name: string; model?: string }[]> {
  const conf = cfg || getAzureConfigFromEnv();
  if (!conf) throw new Error('Azure OpenAI is not configured');
  const url = `${conf.endpoint}/openai/deployments?api-version=${encodeURIComponent(conf.apiVersion || '2024-05-01-preview')}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'api-key': conf.apiKey }
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to list deployments (${res.status}): ${txt}`);
  }
  const json = await res.json().catch(() => ({}));
  const items: any[] = Array.isArray(json?.data) ? json.data : [];
  return items.map(d => ({ name: String(d?.id ?? ''), model: d?.model ? String(d.model) : undefined }));
}

export async function embedTexts(texts: string[], cfg?: AzureConfig): Promise<number[][]> {
  const conf = cfg || getAzureEmbeddingConfigFromEnv() || getAzureConfigFromEnv();
  if (!conf) throw new Error('Azure OpenAI is not configured');
  const url = `${conf.endpoint}/openai/deployments/${encodeURIComponent(conf.deployment)}/embeddings?api-version=${encodeURIComponent(conf.apiVersion || '2024-05-01-preview')}`;
  const body = { input: texts } as any;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': conf.apiKey
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Azure OpenAI embeddings error ${res.status}: ${txt}`);
  }
  const json = await res.json();
  const vectors = (json?.data || []).map((d: any) => d?.embedding).filter((v: any) => Array.isArray(v));
  return vectors as number[][];
}