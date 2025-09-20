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
  const withScheme = /^(http|https):\/\//i.test(endpoint) ? endpoint : `https://${endpoint}`;
  const normalized = withScheme.endsWith('/') ? withScheme.slice(0, -1) : withScheme;
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
  // Build request body; include temperature only if explicitly set by env and not 'auto' or 'default'.
  const tempEnv = (process.env.AZURE_OPENAI_TEMPERATURE || process.env.AZURE_TEMPERATURE || '').toString().trim();
  const baseBody: any = {
    messages: msgs,
    response_format: { type: 'json_object' }
  };
  // Keep responses compact: prefer max_completion_tokens for recent Azure models
  const maxTok = Number(process.env.AZURE_MAX_TOKENS || process.env.AI_IMPORT_MAX_TOKENS || 8000);
  if (Number.isFinite(maxTok) && maxTok > 0) {
    baseBody.max_completion_tokens = maxTok;
  }
  const includeTemp = tempEnv && !/^auto$/i.test(tempEnv) && !/^default$/i.test(tempEnv);
  if (includeTemp) {
    const tNum = Number(tempEnv);
    if (!Number.isNaN(tNum)) baseBody.temperature = tNum;
  }
  const attempts = Math.max(1, Number(process.env.AZURE_HTTP_RETRIES || 3));
  const timeoutMs = Math.max(5000, Number(process.env.AZURE_HTTP_TIMEOUT_MS || 120000));
  let lastErr: any = null;
  let res: Response | null = null;
  let bodyToSend: any = baseBody;
  for (let i = 1; i <= attempts; i++) {
    try {
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), timeoutMs);
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': conf.apiKey
        },
        body: JSON.stringify(bodyToSend),
        signal: controller.signal
      });
      clearTimeout(to);
      lastErr = null;
      // If the response is 400 unsupported parameter, adjust body and retry
      if (!res.ok && res.status === 400) {
        let txt = '';
        try { txt = await res.clone().text(); } catch { /* ignore */ }
        // Unsupported temperature => drop it and retry once
        if (/unsupported_value/i.test(txt) && /"param"\s*:\s*"temperature"/i.test(txt) && bodyToSend && 'temperature' in bodyToSend) {
          try {
            const controller2 = new AbortController();
            const to2 = setTimeout(() => controller2.abort(), timeoutMs);
            const retryBody = { ...bodyToSend };
            delete retryBody.temperature;
            res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'api-key': conf.apiKey },
              body: JSON.stringify(retryBody),
              signal: controller2.signal
            });
            clearTimeout(to2);
            if (res.ok) break;
          } catch {}
        }
        // Unsupported max_tokens => switch to max_completion_tokens and retry once
        if (/unsupported_parameter/i.test(txt) && /\bmax_tokens\b/i.test(txt) && bodyToSend) {
          try {
            const controller2 = new AbortController();
            const to2 = setTimeout(() => controller2.abort(), timeoutMs);
            const retryBody = { ...bodyToSend } as any;
            if ('max_tokens' in retryBody) delete (retryBody as any).max_tokens;
            retryBody.max_completion_tokens = maxTok > 0 ? maxTok : 1200;
            res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'api-key': conf.apiKey },
              body: JSON.stringify(retryBody),
              signal: controller2.signal
            });
            clearTimeout(to2);
            if (res.ok) break;
          } catch {}
        }
        // Unsupported max_completion_tokens => switch to max_tokens and retry once
        if (/unsupported_parameter/i.test(txt) && /\bmax_completion_tokens\b/i.test(txt) && bodyToSend) {
          try {
            const controller2 = new AbortController();
            const to2 = setTimeout(() => controller2.abort(), timeoutMs);
            const retryBody = { ...bodyToSend } as any;
            if ('max_completion_tokens' in retryBody) delete (retryBody as any).max_completion_tokens;
            retryBody.max_tokens = maxTok > 0 ? maxTok : 1200;
            res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'api-key': conf.apiKey },
              body: JSON.stringify(retryBody),
              signal: controller2.signal
            });
            clearTimeout(to2);
            if (res.ok) break;
          } catch {}
        }
      }
  if (res.ok) break;
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e);
      // Backoff on transient network failures
      if (i < attempts && /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(msg)) {
        const backoff = 400 * i;
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      break;
    }
  }
  if (!res) {
    // Provide guidance for common root causes when fetch itself fails
    const masked = `${conf.endpoint.replace(/:[^@]*@/, ':***@')}`;
    throw new Error(
      `Azure OpenAI request could not be sent (fetch failed). Check network/DNS/TLS/proxy and endpoint.\n` +
      `- Endpoint: ${masked}\n- Deployment: ${conf.deployment}\n- Tip: Ensure the endpoint is like https://<resource>.openai.azure.com and reachable from the server.`
    );
  }
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
  
  const extract = (j: any): string | null => {
    const choice = j?.choices?.[0];
    if (!choice) return null;
    
    // Check for length cutoff and retry with more tokens
    if (choice.finish_reason === 'length') {
      return 'RETRY_WITH_MORE_TOKENS';
    }
    
    const msg = choice.message;
    if (!msg) return null;
    const c = msg.content;
    if (typeof c === 'string' && c.trim()) return c;
    if (Array.isArray(c)) {
      const text = c
        .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
        .filter(Boolean)
        .join('\n')
        .trim();
      if (text) return text;
    }
    const toolArgs = msg?.tool_calls?.[0]?.function?.arguments;
    if (typeof toolArgs === 'string' && toolArgs.trim()) return toolArgs;
    return null;
  };
  let content = extract(json);
  
  // Retry with more tokens if response was cut off
  if (content === 'RETRY_WITH_MORE_TOKENS') {
    try {
      const bodyMoreTokens: any = { ...bodyToSend };
      bodyMoreTokens.max_completion_tokens = 16000; // Use maximum available
      const controller3 = new AbortController();
      const to3 = setTimeout(() => controller3.abort(), timeoutMs);
      const res2 = await fetch(`${conf.endpoint}/openai/deployments/${encodeURIComponent(conf.deployment)}/chat/completions?api-version=${encodeURIComponent(conf.apiVersion || '2024-05-01-preview')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': conf.apiKey },
          body: JSON.stringify(bodyMoreTokens),
          signal: controller3.signal
        }
      );
      clearTimeout(to3);
      if (res2.ok) {
        const j2 = await res2.json();
        content = extract(j2);
        if (content === 'RETRY_WITH_MORE_TOKENS') content = null; // avoid infinite loop
      }
    } catch (e) {
      content = null;
    }
  }
  
  if (!content) {
    // Fallback: if response_format was requested, try once without it
    try {
      const bodyNoFmt: any = { ...bodyToSend };
      if (bodyNoFmt && bodyNoFmt.response_format) {
        delete bodyNoFmt.response_format;
        // Also increase tokens for this fallback
        bodyNoFmt.max_completion_tokens = 16000; // Maximum available
        const controller3 = new AbortController();
        const to3 = setTimeout(() => controller3.abort(), timeoutMs);
        const res2 = await fetch(`${conf.endpoint}/openai/deployments/${encodeURIComponent(conf.deployment)}/chat/completions?api-version=${encodeURIComponent(conf.apiVersion || '2024-05-01-preview')}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'api-key': conf.apiKey },
            body: JSON.stringify(bodyNoFmt),
            signal: controller3.signal
          }
        );
        clearTimeout(to3);
        if (res2.ok) {
          const j2 = await res2.json();
          content = extract(j2);
          if (content === 'RETRY_WITH_MORE_TOKENS') content = null; // avoid infinite loop
        }
      }
    } catch (e) {
    }
  }
  
  if (!content || typeof content !== 'string') {
    throw new Error('No content from Azure OpenAI');
  }
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