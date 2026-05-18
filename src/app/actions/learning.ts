'use server'

import { db } from '@/db'
import { module, lesson, userProgress } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function getModulesWithProgress() {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // Fetch modules
  const modules = await db.select().from(module).orderBy(asc(module.order));
  
  // Fetch lessons
  const lessons = await db.select().from(lesson).orderBy(asc(lesson.order));

  // Fetch user progress
  const progress = await db
    .select()
    .from(userProgress)
    .where(eq(userProgress.userId, session.user.id));

  const progressSet = new Set(progress.map((p) => p.lessonId));

  // Assemble the nested object
  return modules.map((m) => {
    const moduleLessons = lessons
      .filter((l) => l.moduleId === m.id)
      .map((l) => ({
        ...l,
        completed: progressSet.has(l.id),
      }));

    const totalLessons = moduleLessons.length;
    const completedLessons = moduleLessons.filter((l) => l.completed).length;

    return {
      ...m,
      lessons: moduleLessons,
      progress: totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
    };
  });
}

export async function getLessonById(lessonId: string) {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const [lessonData] = await db.select().from(lesson).where(eq(lesson.id, lessonId));
  return lessonData;
}

export async function getNextLesson(moduleId: string, currentOrder: number) {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const lessons = await db.select().from(lesson)
    .where(and(eq(lesson.moduleId, moduleId)))
    .orderBy(asc(lesson.order));
  
  const nextLesson = lessons.find(l => l.order > currentOrder);
  return nextLesson;
}

export async function markLessonAsCompleted(lessonId: string) {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // Check if already completed
  const existing = await db
    .select()
    .from(userProgress)
    .where(
      and(
        eq(userProgress.userId, session.user.id),
        eq(userProgress.lessonId, lessonId)
      )
    );

  if (existing.length === 0) {
    await db.insert(userProgress).values({
      id: crypto.randomUUID(),
      userId: session.user.id,
      lessonId: lessonId,
    });
    revalidatePath('/dashboard/learn');
  }
}

export async function seedLearningData() {
  const existingModules = await db.select().from(module).limit(1);
  if (existingModules.length > 0) return; // Already seeded

  const module1Id = crypto.randomUUID();
  const module2Id = crypto.randomUUID();

  await db.insert(module).values([
    {
      id: module1Id,
      title: 'Introdução aos Investimentos',
      description: 'Aprenda os conceitos básicos para começar a investir com segurança.',
      order: 1,
    },
    {
      id: module2Id,
      title: 'Renda Fixa na Prática',
      description: 'Entenda como funcionam os títulos públicos, CDBs, LCIs e LCAs.',
      order: 2,
    },
  ]);

  await db.insert(lesson).values([
    {
      id: crypto.randomUUID(),
      moduleId: module1Id,
      title: 'O que é investir?',
      content: `
# O que é investir?

Investir é o ato de alocar recursos (dinheiro) com a expectativa de gerar uma renda ou lucro futuro. 
Em vez de simplesmente guardar o dinheiro, você o coloca para trabalhar para você.

## Por que investir?
- **Combater a inflação:** O dinheiro perde valor com o tempo. Investir ajuda a manter o poder de compra.
- **Liberdade financeira:** Criar fontes de renda passiva que paguem seus custos de vida.
- **Realizar sonhos:** Viagens, compra de casa, aposentadoria confortável.

Lembre-se: o tempo é o seu maior aliado nos investimentos graças aos juros compostos.
      `,
      order: 1,
    },
    {
      id: crypto.randomUUID(),
      moduleId: module1Id,
      title: 'Juros Compostos',
      content: `
# Juros Compostos: A 8ª Maravilha do Mundo

Como disse Albert Einstein: "Os juros compostos são a oitava maravilha do mundo. Quem entende, ganha. Quem não entende, paga."

Nos juros compostos, o rendimento de um período é somado ao valor principal para o cálculo do rendimento do período seguinte. É o famoso "juros sobre juros".

## Exemplo Prático
Se você investir R$ 1.000 a uma taxa de 1% ao mês:
- **Mês 1:** R$ 1.000 + R$ 10 (1%) = R$ 1.010
- **Mês 2:** R$ 1.010 + R$ 10,10 (1%) = R$ 1.020,10
- ... E assim o crescimento se torna exponencial ao longo dos anos.
      `,
      order: 2,
    },
    {
      id: crypto.randomUUID(),
      moduleId: module2Id,
      title: 'Tesouro Direto',
      content: `
# Tesouro Direto

O Tesouro Direto é um programa do Governo Federal para venda de títulos públicos para pessoas físicas de forma 100% online.

## Tipos de Títulos
1. **Tesouro Selic:** Rende a taxa Selic (taxa básica de juros). Ideal para reserva de emergência por ter baixíssima volatilidade.
2. **Tesouro IPCA+:** Rende a inflação (IPCA) mais uma taxa fixa. Protege o seu dinheiro da inflação.
3. **Tesouro Prefixado:** Você sabe exatamente quanto vai receber no vencimento, independentemente da economia.

É o investimento mais seguro do país, pois é garantido pelo próprio governo.
      `,
      order: 1,
    }
  ]);
}
