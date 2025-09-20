declare module '@ai-sdk/azure' {
  export function createAzure(config: { apiKey?: string; baseURL?: string }): (deployment: string) => any;
}

declare module 'ai' {
  export function generateText(args: {
    model: any;
    messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    prompt?: string;
    maxTokens?: number;
  }): Promise<{ text: string; finishReason?: string }>;

  export function generateObject(args: {
    model: any;
    messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    prompt?: string;
    schema: any;
    maxTokens?: number;
  }): Promise<{ object: any; finishReason?: string }>;
}
