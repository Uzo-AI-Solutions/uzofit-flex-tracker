import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Dumbbell, Play, TrendingUp, CalendarDays, Bot } from 'lucide-react';

export default function Dashboard() {
  const { data: activePlan } = useQuery({
    queryKey: queryKeys.plans.active(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*, workouts(name)')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: recentSessions } = useQuery({
    queryKey: queryKeys.sessions.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
  });

  const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Welcome back!</h1>
          <p className="text-muted-foreground">Ready to crush your workout?</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border-primary/20 bg-gradient-primary shadow-glow">
            <CardHeader>
              <CardTitle className="text-primary-foreground">Active Plan</CardTitle>
            </CardHeader>
            <CardContent>
              {activePlan ? (
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-primary-foreground">{activePlan.name}</p>
                  <p className="text-sm text-primary-foreground/80">
                    {(activePlan.workouts as any)?.name || 'No workout'}
                  </p>
                  <Link to={`/plans/${activePlan.id}`}>
                    <Button variant="secondary" className="mt-2 w-full gap-2">
                      <Play className="h-4 w-4" />
                      Start Today's Session
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-primary-foreground/80">No active plan</p>
                  <Link to="/plans">
                    <Button variant="secondary" className="w-full">
                      Create a Plan
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-accent/20 bg-gradient-to-br from-accent/10 to-accent/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-accent" />
                AI Trainer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Get personalized workout plans and training advice
              </p>
              <Link to="/trainer">
                <Button className="w-full gap-2">
                  <Bot className="h-4 w-4" />
                  Chat with AI Trainer
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-accent" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{recentSessions?.length || 0}</div>
              <p className="text-sm text-muted-foreground">sessions this week</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Get started with your training</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/trainer">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Bot className="h-4 w-4" />
                  AI Trainer
                </Button>
              </Link>
              <Link to="/workouts">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Dumbbell className="h-4 w-4" />
                  Manage Workouts
                </Button>
              </Link>
              <Link to="/plans">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <CalendarDays className="h-4 w-4" />
                  View Plans
                </Button>
              </Link>
              <Link to="/history">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <TrendingUp className="h-4 w-4" />
                  View History
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Sessions</CardTitle>
              <CardDescription>Your latest workouts</CardDescription>
            </CardHeader>
            <CardContent>
              {recentSessions && recentSessions.length > 0 ? (
                <div className="space-y-2">
                  {recentSessions.slice(0, 3).map((session) => (
                    <Link key={session.id} to={`/history/${session.id}`}>
                      <div className="rounded-lg border p-3 transition-colors hover:bg-accent/10">
                        <p className="font-medium">{session.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(session.started_at).toLocaleDateString()}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No sessions yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
