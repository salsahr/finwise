import { getModulesWithProgress, seedLearningData } from '@/app/actions/learning'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import Link from 'next/link'
import { BookOpen, CheckCircle2 } from 'lucide-react'

export default async function LearnPage() {
  // Ensure we have some data
  await seedLearningData();

  const modules = await getModulesWithProgress();

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-primary">Aprender</h2>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <Card key={m.id} className="flex flex-col">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle>{m.title}</CardTitle>
                <BookOpen className="h-5 w-5 text-muted-foreground" />
              </div>
              <CardDescription>{m.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-medium">{m.progress}%</span>
                  </div>
                  <Progress value={m.progress} className="h-2" />
                </div>
                
                <div className="space-y-2 pt-4">
                  <h4 className="text-sm font-semibold">Lições:</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {m.lessons.map(l => (
                      <li key={l.id} className="flex items-center gap-2">
                        {l.completed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-muted" />
                        )}
                        <span className={l.completed ? "line-through opacity-70" : ""}>
                          {l.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Link 
                href={m.lessons.length > 0 ? `/dashboard/learn/${m.id}/${m.lessons[0].id}` : '#'}
                className="w-full"
              >
                <Button className="w-full" disabled={m.lessons.length === 0}>
                  {m.progress > 0 ? 'Continuar' : 'Começar'}
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
