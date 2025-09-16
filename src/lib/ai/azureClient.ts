export type AzureChatOptions = {
  deployment?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
};

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatChoice = {
  content: string;
  finishReason?: string;
};

function getEnv(name: string, fallback = ''): string {
  return (process.env as any)[name] ?? fallback;
}

export function isAzureConfigured() {
  const key = getEnv('AZURE_OPENAI_API_KEY');
  const endpoint = getEnv('AZURE_OPENAI_TARGET') || getEnv('AZURE_OPENAI_ENDPOINT');
  const deployment = getEnv('AZURE_OPENAI_CHAT_DEPLOYMENT') || getEnv('AZURE_OPENAI_DEPLOYMENT_NAME');
  return Boolean(key && endpoint && deployment);
}

export async function chatCompletion(messages: ChatMessage[], options: AzureChatOptions = {}): Promise<ChatChoice> {
  if (!isAzureConfigured()) {
    // Graceful fallback: return empty content, caller can decide to skip AI annotations
    return { content: '', finishReason: 'azure-not-configured' };
  }

  const apiKey = getEnv('AZURE_OPENAI_API_KEY');
  const endpoint = getEnv('AZURE_OPENAI_TARGET') || getEnv('AZURE_OPENAI_ENDPOINT');
  const deployment = options.deployment || getEnv('AZURE_OPENAI_CHAT_DEPLOYMENT') || getEnv('AZURE_OPENAI_DEPLOYMENT_NAME');
  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.maxTokens ?? 1800;
  const apiVersion = getEnv('AZURE_OPENAI_API_VERSION', '2024-02-15-preview');

  // Prepare messages with system prompt if provided
  let finalMessages = [...messages];
  if (options.systemPrompt) {
    finalMessages = [{ role: 'system', content: options.systemPrompt }, ...messages];
  }

  // Azure requires that messages contain the literal word "json" when using response_format=json_object
  const hasJsonWord = finalMessages.some(m => typeof m?.content === 'string' && /json/i.test(m.content));
  if (!hasJsonWord) {
    finalMessages.unshift({ role: 'system', content: 'Return a strict JSON object only. Reply in json. No prose.' });
  }

  const body = {
    messages: finalMessages,
    max_completion_tokens: maxTokens, // Use max_completion_tokens for newer models like gpt-5-mini
    response_format: { type: 'json_object' }
  } as any;

  // Azure OpenAI Chat Completions endpoint
  const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let txt = '';
    let json: any = null;
    try { json = await res.json(); txt = JSON.stringify(json); } catch { try { txt = await res.text(); } catch { txt = ''; } }
    
    // Provide clearer guidance for common errors
    if (res.status === 404 && (json?.error?.code === 'DeploymentNotFound' || /DeploymentNotFound/i.test(txt))) {
      throw new Error(
        `Azure OpenAI deployment not found (404). Verify:\n` +
        `- Endpoint points to the correct Azure OpenAI resource: ${endpoint}\n` +
        `- The deployment NAME exists under that resource (not the model name). Current: ${deployment}\n` +
        `- The model is available in the resource's region and subscription.`
      );
    }
    if (res.status === 401) {
      throw new Error('Azure OpenAI unauthorized (401). Check AZURE_OPENAI_API_KEY and resource access policies.');
    }
    throw new Error(`Azure OpenAI error ${res.status}: ${txt}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0]?.message?.content ?? '';
  if (!choice || typeof choice !== 'string') throw new Error('No content from Azure OpenAI');
  return { content: choice, finishReason: data.choices?.[0]?.finish_reason };
}
