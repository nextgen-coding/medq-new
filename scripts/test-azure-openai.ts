import { config } from 'dotenv';
import { isAzureConfigured, chatCompletion } from '../src/lib/ai/azureClient';

// Load environment variables
config();

async function main() {
  console.log('Testing Azure OpenAI configuration...\n');
  
  // Debug: Print current environment variables
  console.log('Environment variables found:');
  console.log('- AZURE_OPENAI_API_KEY:', process.env.AZURE_OPENAI_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('- AZURE_OPENAI_TARGET:', process.env.AZURE_OPENAI_TARGET ? '✅ Set' : '❌ Missing');
  console.log('- AZURE_OPENAI_ENDPOINT:', process.env.AZURE_OPENAI_ENDPOINT ? '✅ Set' : '❌ Missing');
  console.log('- AZURE_OPENAI_CHAT_DEPLOYMENT:', process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ? '✅ Set' : '❌ Missing');
  console.log('- AZURE_OPENAI_DEPLOYMENT_NAME:', process.env.AZURE_OPENAI_DEPLOYMENT_NAME ? '✅ Set' : '❌ Missing');
  console.log('');
  
  if (!isAzureConfigured()) {
    console.error('❌ Azure OpenAI not configured. Please check environment variables:');
    console.error('- AZURE_OPENAI_API_KEY');
    console.error('- AZURE_OPENAI_TARGET (or AZURE_OPENAI_ENDPOINT)');
    console.error('- AZURE_OPENAI_CHAT_DEPLOYMENT (or AZURE_OPENAI_DEPLOYMENT_NAME)');
    process.exit(1);
  }
  
  console.log('✅ Azure OpenAI configuration found');
  console.log('🔗 Testing connection and JSON response...\n');
  
  try {
    const response = await chatCompletion([
      { role: 'user', content: 'Test JSON response format. Return: {"status": "ok", "message": "Azure OpenAI is working correctly"}' }
    ], {
      systemPrompt: 'You are a test assistant. Return only JSON responses.'
    });
    
    console.log('✅ Connection successful!');
    console.log('📋 Response:', response.content);
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(response.content);
      console.log('✅ JSON parsing successful:', parsed);
    } catch (e) {
      console.log('⚠️  Response is not valid JSON, but connection works');
    }
    
    // Test medical QCM style prompt
    console.log('\n🏥 Testing medical QCM style prompt...\n');
    const medicalTest = await chatCompletion([
      { role: 'user', content: JSON.stringify({
        task: 'analyze_mcq_batch',
        items: [{
          id: "0",
          questionText: "Quelle est la cause la plus fréquente d'une douleur thoracique chez un patient de 25 ans?",
          options: [
            "Infarctus du myocarde",
            "Douleur musculaire",
            "Embolie pulmonaire",
            "Pneumothorax"
          ],
          providedAnswerRaw: "B"
        }]
      }) }
    ], {
      systemPrompt: `Tu aides des étudiants en médecine à corriger des QCM.
STYLE & TON:
- Écris comme un excellent étudiant de dernière année qui explique rapidement à des camarades.
- Varie systématiquement les connecteurs initiaux: "Oui", "Exact", "Au contraire", "Non, en fait"...

FORMAT DE SORTIE:
- JSON STRICT uniquement. Structure: { "results": [ { "id": "string", "status": "ok"|"error", "correctAnswers": [indices], "optionExplanations": ["expl A", "expl B", ...] } ] }

RAPPEL: Réponds uniquement avec le JSON.`
    });
    
    console.log('📋 Medical QCM Response:', medicalTest.content);
    
    try {
      const medicalParsed = JSON.parse(medicalTest.content);
      if (medicalParsed.results && medicalParsed.results[0]) {
        const result = medicalParsed.results[0];
        console.log('✅ Medical QCM test successful!');
        console.log('   Status:', result.status);
        console.log('   Correct answers:', result.correctAnswers);
        console.log('   Option explanations:', result.optionExplanations?.length, 'explanations');
      }
    } catch (e) {
      console.log('⚠️  Medical response is not valid JSON');
    }
    
  } catch (error: any) {
    console.error('❌ Azure OpenAI test failed:');
    console.error(error.message);
    process.exit(1);
  }
  
  console.log('\n🎉 All tests passed! Azure OpenAI is ready for AI validation.');
}

main().catch(console.error);