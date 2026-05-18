import { getLessonById, getNextLesson, markLessonAsCompleted } from '@/app/actions/learning'
import { AITutorChat } from '@/components/learning/ai-tutor-chat'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

export default async function LessonPage({ 
  params 
}: { 
  params: Promise<{ moduleId: string, lessonId: string }> 
}) {
  const { moduleId, lessonId } = await params;
  const lesson = await getLessonById(lessonId);

  if (!lesson || lesson.moduleId !== moduleId) {
    notFound();
  }

  const nextLesson = await getNextLesson(moduleId, lesson.order);

  const completeLesson = async () => {
    'use server'
    await markLessonAsCompleted(lessonId);
    if (nextLesson) {
      redirect(`/dashboard/learn/${moduleId}/${nextLesson.id}`);
    } else {
      redirect('/dashboard/learn');
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b">
        <Link href="/dashboard/learn">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-xl font-semibold flex-1">{lesson.title}</h2>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <Card>
            <CardContent className="p-6 md:p-10 prose prose-slate dark:prose-invert max-w-none">
              <ReactMarkdown 
                components={{
                  h1: ({node, ...props}) => <h1 className="text-3xl font-bold mb-6 text-primary" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-2xl font-semibold mt-8 mb-4 text-primary/80" {...props} />,
                  p: ({node, ...props}) => <p className="leading-relaxed mb-4" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-4 space-y-2" {...props} />,
                  li: ({node, ...props}) => <li className="marker:text-primary" {...props} />
                }}
              >
                {lesson.content}
              </ReactMarkdown>
            </CardContent>
          </Card>

          <div className="flex justify-end pb-10">
            <form action={completeLesson}>
              <Button type="submit" size="lg" className="gap-2">
                <CheckCircle2 className="h-5 w-5" />
                {nextLesson ? 'Concluir e Próxima Lição' : 'Concluir Módulo'}
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Floating AI Tutor Component */}
      <AITutorChat lessonTitle={lesson.title} lessonContent={lesson.content} />
    </div>
  )
}
