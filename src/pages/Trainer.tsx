import { useState, useRef, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, Bot } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Trainer() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hey! I'm your UzoFit AI trainer with complete access to your fitness data. I can:\n\n• View and edit your workout programs\n• Manage your training plans\n• Analyze your workout history and progress\n• Log new sessions\n• Provide personalized recommendations\n\nWhat would you like to work on today?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleToolCall = async (toolCall: any) => {
    console.log('Executing tool:', toolCall);
    
    const { data, error } = await supabase.functions.invoke('personal-trainer', {
      body: {
        action: 'execute_tool',
        tool_name: toolCall.function.name,
        tool_arguments: JSON.parse(toolCall.function.arguments)
      }
    });

    if (error) {
      console.error('Tool execution error:', error);
      throw error;
    }

    return data;
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const conversationMessages = [...messages, userMessage];
      
      let continueProcessing = true;
      let currentMessages = conversationMessages;
      
      while (continueProcessing) {
        const { data, error } = await supabase.functions.invoke('personal-trainer', {
          body: { messages: currentMessages }
        });

        if (error) throw error;

        const choice = data.choices[0];
        const assistantMessage = choice.message;

        // Check if AI wants to use a tool
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          console.log('AI requested tool calls:', assistantMessage.tool_calls);
          
          // Execute all tool calls
          const toolResults = await Promise.all(
            assistantMessage.tool_calls.map(async (toolCall: any) => {
              const result = await handleToolCall(toolCall);
              return {
                tool_call_id: toolCall.id,
                role: 'tool',
                name: toolCall.function.name,
                content: JSON.stringify(result)
              };
            })
          );

          // Add assistant message with tool calls to conversation
          currentMessages = [
            ...currentMessages,
            assistantMessage,
            ...toolResults
          ];
          
          // Continue the loop to get the final response
          continue;
        }

        // No more tool calls, display the final message
        if (assistantMessage.content) {
          setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage.content }]);
          
          // Show success toast if a workout was created or session logged
          if (assistantMessage.content.includes('created') || assistantMessage.content.includes('logged')) {
            toast({
              title: 'Success!',
              description: 'Action completed successfully',
            });
          }
        }
        
        continueProcessing = false;
      }

    } catch (error) {
      console.error('Error details:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    "Show me all my workouts",
    "What are my active training plans?",
    "Give me recommendations based on my progress",
    "Create a new 4-day upper/lower split",
    "Show my workout history from the last month"
  ];

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="border-b bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI Personal Trainer</h1>
              <p className="text-sm text-muted-foreground">
                Full access to your workouts, plans, history, and personalized recommendations
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <Card
                className={`max-w-[80%] p-4 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </Card>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <Card className="max-w-[80%] p-4 bg-muted">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <p>Thinking...</p>
                </div>
              </Card>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {messages.length === 1 && (
          <div className="px-4 pb-2">
            <p className="text-sm text-muted-foreground mb-2">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setInput(action);
                  }}
                  className="text-xs"
                >
                  {action}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t bg-card p-4">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask me anything about your workouts, plans, history, or get recommendations..."
              className="resize-none"
              rows={2}
              disabled={isLoading}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-full aspect-square"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
