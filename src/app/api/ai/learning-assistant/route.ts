import { geminiModel } from '@/ai/models'
import { streamText } from 'ai'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function POST(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { messages, lessonTitle, lessonContent } = await req.json();

  const systemPrompt = `Você é um tutor de educação financeira amigável, encorajador e didático chamado FinTutor.
Sua missão é ajudar os estudantes a entenderem o conteúdo da lição atual de forma clara e simples.

Aqui está o conteúdo da lição atual que o estudante está lendo:
TÍTULO DA LIÇÃO: ${lessonTitle || 'Nenhuma lição especificada'}
CONTEÚDO DA LIÇÃO:
${lessonContent || 'Nenhum conteúdo especificado'}

Diretrizes:
1. Baseie-se no conteúdo da lição para responder.
2. Se o estudante perguntar algo fora do escopo de finanças, recuse educadamente e traga o assunto de volta.
3. Use uma linguagem simples, evitando jargões muito técnicos sem explicá-los.
4. Você pode usar analogias do dia a dia para explicar conceitos (ex: padaria, aluguel, etc).
5. Responda em português (PT-BR).`;

  const result = streamText({
    model: geminiModel,
    system: systemPrompt,
    messages,
  });

  return result.toTextStreamResponse();
}
