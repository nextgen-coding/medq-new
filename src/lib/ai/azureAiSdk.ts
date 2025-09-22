import { createAzure } from '@ai-sdk/azure';
import { z } from 'zod';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

function getEnv(name: string, fallback = ''): string {
  return (process.env as any)[name] ?? fallback;
}

export function isAzureConfigured() {
  const key = getEnv('AZURE_OPENAI_API_KEY');
  const endpoint = getEnv('AZURE_OPENAI_TARGET') || getEnv('AZURE_OPENAI_ENDPOINT');
  const deployment = getEnv('AZURE_OPENAI_CHAT_DEPLOYMENT') || getEnv('AZURE_OPENAI_DEPLOYMENT_NAME') || getEnv('AZURE_OPENAI_DEPLOYMENT');
  return Boolean(key && endpoint && deployment);
}

// High-performance structured generation using AI SDK - eliminates JSON parsing issues
export async function chatCompletionStructured(messages: ChatMessage[], options: { maxTokens?: number; systemPrompt?: string } = {}) {
  if (!isAzureConfigured()) {
    return { content: '', finishReason: 'azure-not-configured' } as { content: string; finishReason?: string };
  }

  const apiKey = getEnv('AZURE_OPENAI_API_KEY');
  const endpointRaw = getEnv('AZURE_OPENAI_TARGET') || getEnv('AZURE_OPENAI_ENDPOINT');
  const endpointRoot = String(endpointRaw || '').replace(/\/+$/, '');
  const apiVersion = getEnv('AZURE_OPENAI_API_VERSION') || '2024-08-01-preview';
  
  // IMPORTANT: Use deployment-based URLs to match working REST path:
  // https://<resource>.openai.azure.com/openai/deployments/<deployment>/chat/completions?api-version=...
  // With baseURL set to <root>/openai and useDeploymentBasedUrls=true.
  const azure = (createAzure as any)({
    apiKey,
    baseURL: `${endpointRoot}/openai`,
    apiVersion,
    useDeploymentBasedUrls: true,
  });

  const deployment = getEnv('AZURE_OPENAI_CHAT_DEPLOYMENT') || getEnv('AZURE_OPENAI_DEPLOYMENT_NAME') || getEnv('AZURE_OPENAI_DEPLOYMENT');
  const model = azure(deployment);

  const extraDetail = 'explication more detailed , make it professor level and more detailed aka the student understand everything';
  const sysPromptCombined = options.systemPrompt ? `${options.systemPrompt}\n\n${extraDetail}` : extraDetail;
  const sysBase = sysPromptCombined ? [{ role: 'system' as const, content: sysPromptCombined }] : [];
  const hasJson = [...sysBase, ...messages].some(m => /json/i.test(String((m as any).content || '')));
  const prepend = hasJson ? [] : [{ role: 'system' as const, content: 'Return a strict JSON object only. Reply in json. No prose.' }];
  const all = [...prepend, ...sysBase, ...messages];

  // Zod schema for MCQ results to enforce structured JSON
  const resultItemSchema = z.object({
    id: z.union([z.string(), z.number()]).transform(v => String(v)),
    status: z.union([z.literal('ok'), z.literal('error')]).optional(),
    correctAnswers: z.array(z.number()).optional(),
    noAnswer: z.boolean().optional(),
    globalExplanation: z.string().optional(),
    optionExplanations: z.array(z.string()).optional(),
    error: z.string().optional(),
  }).passthrough();
  const mcqResultsSchema = z.object({ results: z.array(resultItemSchema) });

  try {
    // Use dynamic import to avoid build-time dependency on a specific ai version
    const aiPkg: any = await import('ai');
    if (typeof aiPkg.generateObject !== 'function') {
      throw new Error('generateObject not available in ai package');
    }
    
  console.log(`[AzureAI SDK] Attempting generateObject with baseURL: ${endpointRoot}/openai (deployment-based), deployment: ${deployment}, apiVersion: ${apiVersion}`);
    
    const result = await aiPkg.generateObject({
      model,
      messages: all,
      schema: mcqResultsSchema,
      maxTokens: options.maxTokens ?? 8000
    });
    // Return stringified JSON to keep compatibility with callers expecting .content text
    return { content: JSON.stringify(result.object), finishReason: result.finishReason };
  } catch (err: any) {
    console.warn('[AzureAI SDK] generateObject failed:', err?.message || err);
  console.warn('[AzureAI SDK] baseURL used:', `${endpointRoot}/openai`);
    console.warn('[AzureAI SDK] deployment used:', deployment);
    console.warn('[AzureAI SDK] apiVersion used:', apiVersion);
    // Do not fallback to generateText to avoid non-JSON outputs; let caller use REST fallback.
    throw new Error(`Azure AI SDK generateObject failed: ${err?.message || err}`);
  }
}

// Use the exact same REST endpoint as the working legacy client
export async function chatCompletion(messages: ChatMessage[], options: { maxTokens?: number; systemPrompt?: string } = {}) {
  if (!isAzureConfigured()) {
    return { content: '', finishReason: 'azure-not-configured' } as { content: string; finishReason?: string };
  }

  const apiKey = getEnv('AZURE_OPENAI_API_KEY');
  const endpoint = getEnv('AZURE_OPENAI_TARGET') || getEnv('AZURE_OPENAI_ENDPOINT');
  const deployment = getEnv('AZURE_OPENAI_CHAT_DEPLOYMENT') || getEnv('AZURE_OPENAI_DEPLOYMENT_NAME') || getEnv('AZURE_OPENAI_DEPLOYMENT');
  const apiVersion = getEnv('AZURE_OPENAI_API_VERSION') || '2024-08-01-preview';

  // Normalize endpoint - remove trailing slash
  const normalizedEndpoint = endpoint.replace(/\/$/, '');
  const url = `${normalizedEndpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
  
  const sys = options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : [];
  const hasJson = [...sys, ...messages].some(m => /json/i.test(String((m as any).content || '')));
  const prepend = hasJson ? [] : [{ role: 'system' as const, content: 'Return a strict JSON object only. Reply in json. No prose.' }];
  const all = [...prepend, ...sys, ...messages];

  // Use the exact same body format as the working legacy client
  // Diversity tuning via env (safe bounds)
  const tempEnv = (process.env.AZURE_OPENAI_TEMPERATURE || process.env.AZURE_TEMPERATURE || '').toString().trim();
  const presenceEnv = (process.env.AZURE_OPENAI_PRESENCE_PENALTY || '').toString().trim();
  const frequencyEnv = (process.env.AZURE_OPENAI_FREQUENCY_PENALTY || '').toString().trim();
  const temperature = tempEnv && !/^auto|default$/i.test(tempEnv) ? Number(tempEnv) : NaN;
  const presencePenalty = presenceEnv ? Number(presenceEnv) : NaN;
  const frequencyPenalty = frequencyEnv ? Number(frequencyEnv) : NaN;

  const baseBody: any = {
    messages: all,
    response_format: { type: 'json_object' },
    max_completion_tokens: options.maxTokens ?? 8000
  };
  if (!Number.isNaN(temperature)) baseBody.temperature = Math.max(0, Math.min(1.2, temperature));
  if (!Number.isNaN(presencePenalty)) baseBody.presence_penalty = Math.max(-2, Math.min(2, presencePenalty));
  if (!Number.isNaN(frequencyPenalty)) baseBody.frequency_penalty = Math.max(-2, Math.min(2, frequencyPenalty));

  const attempts = 3;
  const timeoutMs = 120000;
  let lastErr: any = null;

  for (let i = 1; i <= attempts; i++) {
    try {
      console.log(`[AzureAI] Direct REST call to: ${url}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey
        },
        body: JSON.stringify(baseBody),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text();
        
        // Handle specific Azure errors like the legacy client
        if (response.status === 404) {
          throw new Error(
            `Azure OpenAI deployment not found (404). Verify:\n` +
            `- Endpoint points to the correct Azure OpenAI resource: ${normalizedEndpoint}\n` +
            `- The deployment NAME exists under that resource (not the model name). Current: ${deployment}\n` +
            `- The model is available in the resource's region and subscription.`
          );
        }
        if (response.status === 401) {
          throw new Error('Azure OpenAI unauthorized (401). Check AZURE_OPENAI_API_KEY and resource access policies.');
        }
        
        throw new Error(`Azure REST API error ${response.status}: ${text}`);
      }

      const json = await response.json();
      let content = json?.choices?.[0]?.message?.content || '';
      let finishReason = json?.choices?.[0]?.finish_reason || '';

      // If response was cut off by token limit, retry once with more tokens
      if (finishReason === 'length') {
        try {
          const moreBody: any = { ...baseBody, max_completion_tokens: Math.max(16000, options.maxTokens || 0) };
          const controller2 = new AbortController();
          const timeout2 = setTimeout(() => controller2.abort(), timeoutMs);
          const res2 = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
            body: JSON.stringify(moreBody),
            signal: controller2.signal
          });
          clearTimeout(timeout2);
          if (res2.ok) {
            const j2 = await res2.json();
            content = j2?.choices?.[0]?.message?.content || content;
            finishReason = j2?.choices?.[0]?.finish_reason || finishReason;
          }
        } catch { /* ignore retry errors */ }
      }

      // If still empty, try once without response_format
      if (!content) {
        try {
          const noFmt: any = { ...baseBody };
          delete noFmt.response_format;
          const controller3 = new AbortController();
          const timeout3 = setTimeout(() => controller3.abort(), timeoutMs);
          const res3 = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
            body: JSON.stringify(noFmt),
            signal: controller3.signal
          });
          clearTimeout(timeout3);
          if (res3.ok) {
            const j3 = await res3.json();
            content = j3?.choices?.[0]?.message?.content || content;
            finishReason = j3?.choices?.[0]?.finish_reason || finishReason;
          }
        } catch { /* ignore */ }
      }

      return { content, finishReason };
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || err);
      
      // Retry on network failures
      if (i < attempts && /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(msg)) {
        const backoff = 400 * i;
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      
      break;
    }
  }

  throw new Error(`Azure REST call failed: ${lastErr?.message || lastErr}`);
}
