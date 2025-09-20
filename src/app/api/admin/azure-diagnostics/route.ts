import { NextRequest, NextResponse } from 'next/server';
import { requireMaintainerOrAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';

function getEnv(name: string, fallback = ''): string {
  return (process.env as any)[name] ?? fallback;
}

async function listDeployments(endpoint: string, apiKey: string) {
  const sanitized = endpoint.replace(/\/$/, '');
  const url = `${sanitized}/openai/deployments?api-version=2024-06-01`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Azure API error: ${response.status} - ${text}`);
  }
  
  const data = await response.json();
  return data;
}

async function testDeployment(endpoint: string, apiKey: string, deploymentName: string) {
  const sanitized = endpoint.replace(/\/$/, '');
  const url = `${sanitized}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-06-01`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 5
    })
  });
  
  return {
    deployment: deploymentName,
    status: response.status,
    ok: response.ok,
    statusText: response.statusText
  };
}

async function handler(request: AuthenticatedRequest) {
  try {
    const apiKey = getEnv('AZURE_OPENAI_API_KEY');
    const endpoint = getEnv('AZURE_OPENAI_TARGET') || getEnv('AZURE_OPENAI_ENDPOINT');
    
    if (!apiKey || !endpoint) {
      return NextResponse.json({
        error: 'Azure OpenAI not configured',
        config: {
          hasApiKey: !!apiKey,
          hasEndpoint: !!endpoint,
          endpoint: endpoint || 'missing'
        }
      }, { status: 400 });
    }
    
    console.log(`[Azure Diagnostics] Testing endpoint: ${endpoint}`);
    
    // List all deployments
    let deployments: any = null;
    let deploymentsError: string | null = null;
    
    try {
      deployments = await listDeployments(endpoint, apiKey);
    } catch (e: any) {
      deploymentsError = e.message;
    }
    
    // Test specific deployment candidates
    const candidates = [
      getEnv('AZURE_OPENAI_CHAT_DEPLOYMENT'),
      getEnv('AZURE_OPENAI_DEPLOYMENT_NAME'), 
      getEnv('AZURE_OPENAI_DEPLOYMENT'),
      getEnv('AZURE_OPENAI_MODEL'),
      'gpt-4o-mini',
      'gpt-4o', 
      'gpt-35-turbo',
      'gpt-4'
    ].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i); // unique
    
    const testResults = [];
    for (const candidate of candidates) {
      try {
        const result = await testDeployment(endpoint, apiKey, candidate);
        testResults.push(result);
      } catch (e: any) {
        testResults.push({
          deployment: candidate,
          status: 0,
          ok: false,
          error: e.message
        });
      }
    }
    
    return NextResponse.json({
      endpoint,
      deployments,
      deploymentsError,
      testResults,
      config: {
        AZURE_OPENAI_CHAT_DEPLOYMENT: getEnv('AZURE_OPENAI_CHAT_DEPLOYMENT'),
        AZURE_OPENAI_DEPLOYMENT_NAME: getEnv('AZURE_OPENAI_DEPLOYMENT_NAME'),
        AZURE_OPENAI_DEPLOYMENT: getEnv('AZURE_OPENAI_DEPLOYMENT'),
        AZURE_OPENAI_MODEL: getEnv('AZURE_OPENAI_MODEL'),
        AZURE_OPENAI_FALLBACK_DEPLOYMENTS: getEnv('AZURE_OPENAI_FALLBACK_DEPLOYMENTS')
      }
    });
    
  } catch (error: any) {
    return NextResponse.json({
      error: 'Diagnostic failed',
      message: error.message
    }, { status: 500 });
  }
}

export const GET = requireMaintainerOrAdmin(handler);