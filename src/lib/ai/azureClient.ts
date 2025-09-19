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

function normalizeEndpoint(raw: string): string {
  if (!raw) return '';
  let e = raw.trim();
  if (!/^https?:\/\//i.test(e)) e = 'https://' + e; // ensure scheme
  e = e.replace(/\/+$|\/$/g, ''); // drop trailing slashes
  return e;
}

function isTransientNetworkError(err: any): boolean {
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('etimedout') ||
    msg.includes('econnreset') ||
    msg.includes('socket hang up') ||
    msg.includes('enotfound') ||
    msg.includes('eai_again') ||
    msg.includes('aborterror')
  );
}

export async function chatCompletion(messages: ChatMessage[], options: AzureChatOptions = {}): Promise<ChatChoice> {
  if (!isAzureConfigured()) {
    // Graceful fallback: return empty content, caller can decide to skip AI annotations
    return { content: '', finishReason: 'azure-not-configured' };
  }

  // Optional kill-switch to run in offline mode and let callers trigger fallbacks deterministically
  if (getEnv('AZURE_OPENAI_FORCE_OFFLINE') === '1') {
    console.warn('[Azure OpenAI] Forced offline mode enabled (AZURE_OPENAI_FORCE_OFFLINE=1) — skipping network call');
    return { content: '', finishReason: 'forced-offline' };
  }

  const apiKey = getEnv('AZURE_OPENAI_API_KEY');
  const endpointRaw = getEnv('AZURE_OPENAI_TARGET') || getEnv('AZURE_OPENAI_ENDPOINT');
  const endpoint = normalizeEndpoint(endpointRaw);
  const deployment = options.deployment || getEnv('AZURE_OPENAI_CHAT_DEPLOYMENT') || getEnv('AZURE_OPENAI_DEPLOYMENT_NAME');
  const temperature = options.temperature; // omit by default; some deployments reject this
  const maxTokens = options.maxTokens ?? 8000;
  const apiVersion = getEnv('AZURE_OPENAI_API_VERSION', '2024-06-01');
  const timeoutMs = Math.max(1, parseInt(getEnv('AZURE_OPENAI_TIMEOUT_MS', '120000'), 10));
  const maxRetries = Math.max(0, parseInt(getEnv('AZURE_OPENAI_MAX_RETRIES', '2'), 10));

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

  // Azure OpenAI Chat Completions endpoint
  const url = `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;

  console.log('[Azure OpenAI] Making request to:', url);
  console.log('[Azure OpenAI] Deployment:', deployment);
  console.log('[Azure OpenAI] API Version:', apiVersion);

  let lastErr: any = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const body: any = {
        messages: finalMessages,
        // Prefer newer Azure param; we'll auto-switch on 400s if needed
        max_completion_tokens: maxTokens,
        response_format: { type: 'json_object' },
      };
      if (typeof temperature === 'number') body.temperature = temperature;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      console.log('[Azure OpenAI] Response status:', res.status);

      if (!res.ok) {
        let txt = '';
        let json: any = null;
        try { json = await res.json(); txt = JSON.stringify(json); } catch { try { txt = await res.text(); } catch { txt = ''; } }
        console.error('[Azure OpenAI] Error response:', txt);

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
        // Retry on certain 400s by adjusting parameters
        if (res.status === 400) {
          const msg = txt.toLowerCase();
          // Retry once without temperature if it's mentioned
          if (typeof body.temperature === 'number' && msg.includes('temperature')) {
            console.warn('[Azure OpenAI] 400 mentioning temperature — retrying without temperature');
            delete body.temperature;
            continue; // retry immediately within same attempt scope
          }
          // Retry once without response_format if unsupported
          if (body.response_format && (msg.includes('response_format') || msg.includes('json_object'))) {
            console.warn('[Azure OpenAI] 400 mentioning response_format — retrying without response_format');
            delete body.response_format;
            continue;
          }
          // Swap token param name if unsupported
          if (msg.includes('unsupported parameter') && msg.includes('max_completion_tokens') && 'max_completion_tokens' in body) {
            console.warn('[Azure OpenAI] 400 unsupported max_completion_tokens — retrying with max_tokens');
            delete body.max_completion_tokens;
            body.max_tokens = maxTokens;
            continue;
          }
          if (msg.includes('unsupported parameter') && msg.includes('max_tokens') && 'max_tokens' in body) {
            console.warn('[Azure OpenAI] 400 unsupported max_tokens — retrying with max_completion_tokens');
            delete body.max_tokens;
            body.max_completion_tokens = maxTokens;
            continue;
          }
        }
        throw new Error(`Azure OpenAI error ${res.status}: ${txt}`);
      }

      const data = await res.json();
      const extract = (j: any): string | null => {
        const ch = j?.choices?.[0];
        if (!ch) return null;
        if (ch.finish_reason === 'length') return 'RETRY_WITH_MORE_TOKENS';
        const msg = ch?.message;
        const c = msg?.content;
        if (typeof c === 'string' && c.trim()) return c;
        if (Array.isArray(c)) {
          const text = c.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).filter(Boolean).join('\n').trim();
          if (text) return text;
        }
        const toolArgs = msg?.tool_calls?.[0]?.function?.arguments;
        if (typeof toolArgs === 'string' && toolArgs.trim()) return toolArgs;
        return null;
      };
      let content = extract(data);
      const isSentinel = (v: any) => v === 'RETRY_WITH_MORE_TOKENS';
      if (isSentinel(content)) {
        // Retry once with higher token budget
        const body2: any = { ...body };
        if ('max_completion_tokens' in body2) body2.max_completion_tokens = Math.max(Number(body2.max_completion_tokens || 0), Math.min(4000, maxTokens * 2));
        else body2.max_tokens = Math.max(Number(body2.max_tokens || 0), Math.min(4000, maxTokens * 2));
        const controller2 = new AbortController();
        const to2 = setTimeout(() => controller2.abort(), timeoutMs);
        const res2 = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
          body: JSON.stringify(body2),
          signal: controller2.signal,
        });
        clearTimeout(to2);
        if (res2.ok) {
          const data2 = await res2.json();
          content = extract(data2);
          if (isSentinel(content)) content = null;
        } else {
          content = null;
        }
      }
      if (!content || isSentinel(content)) {
        // Retry once without response_format if present
        if ((body as any).response_format) {
          const body3: any = { ...body };
          delete body3.response_format;
          const controller3 = new AbortController();
          const to3 = setTimeout(() => controller3.abort(), timeoutMs);
          const res3 = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
            body: JSON.stringify(body3),
            signal: controller3.signal,
          });
          clearTimeout(to3);
          if (res3.ok) {
            const data3 = await res3.json();
            content = extract(data3);
            if (isSentinel(content)) content = null;
          }
        }
      }
      if (!content || typeof content !== 'string') throw new Error('No content from Azure OpenAI');
      return { content, finishReason: data.choices?.[0]?.finish_reason };
    } catch (err: any) {
      clearTimeout(timer);
      lastErr = err;
      if (isTransientNetworkError(err) && attempt < maxRetries) {
        const delay = Math.min(5000, 500 * Math.pow(2, attempt));
        console.warn(`[Azure OpenAI] Network error (attempt ${attempt + 1}/${maxRetries + 1}): ${err.message}. Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      // Non-retryable or out of attempts
      break;
    }
  }

  const hint = `Check network/DNS/TLS/proxy and endpoint.\n- Endpoint: ${endpoint}\n- Deployment: ${deployment}\n- Tip: Ensure the endpoint is like https://<resource>.openai.azure.com and reachable from the server.`;
  const errMsg = lastErr ? `${lastErr.message}\n${hint}` : `Azure OpenAI request failed. ${hint}`;
  throw new Error(errMsg);
}
