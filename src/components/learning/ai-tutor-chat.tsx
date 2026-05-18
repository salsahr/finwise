'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface AITutorChatProps {
  lessonTitle: string;
  lessonContent: string;
}

export function AITutorChat({ lessonTitle, lessonContent }: AITutorChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [localInput, setLocalInput] = useState('')
  const [messages, setMessages] = useState<{id: string, role: string, content: string}[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localInput.trim() || isLoading) return;
    
    const userMessage = { id: Date.now().toString(), role: 'user', content: localInput };
    setMessages(prev => [...prev, userMessage]);
    setLocalInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/learning-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          lessonTitle,
          lessonContent
        })
      });

      if (!response.ok) throw new Error('Network error');
      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const aiMessageId = Date.now().toString() + '-ai';
      
      setMessages(prev => [...prev, { id: aiMessageId, role: 'assistant', content: '' }]);

      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          setMessages(prev => 
            prev.map(m => m.id === aiMessageId ? { ...m, content: m.content + chunk } : m)
          );
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all z-50 bg-primary hover:scale-105"
        >
          <MessageCircle className="h-6 w-6 text-primary-foreground" />
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-80 md:w-96 shadow-2xl z-50 flex flex-col overflow-hidden border-border/50 animate-in slide-in-from-bottom-5">
          <CardHeader className="bg-primary text-primary-foreground flex flex-row items-center justify-between py-3 px-4 rounded-t-lg">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Tutor de IA
            </CardTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20 rounded-full"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          
          <CardContent className="p-0 flex flex-col h-[400px] bg-background">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground text-sm mt-10">
                  Olá! Sou o FinTutor. Posso te ajudar a entender melhor sobre "{lessonTitle}"?
                </div>
              )}
              
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    m.role === 'user' 
                      ? "bg-primary text-primary-foreground ml-auto rounded-tr-none" 
                      : "bg-muted text-foreground mr-auto rounded-tl-none"
                  )}
                >
                  {m.content}
                </div>
              ))}
              
              {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                <div className="bg-muted text-foreground mr-auto rounded-lg rounded-tl-none px-3 py-2 text-sm max-w-[85%] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                  <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input Area */}
            <form onSubmit={onSubmit} className="p-3 border-t bg-muted/30 flex gap-2">
              <Input
                value={localInput}
                onChange={(e) => setLocalInput(e.target.value)}
                placeholder="Tire sua dúvida..."
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={isLoading || !localInput.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </>
  )
}
