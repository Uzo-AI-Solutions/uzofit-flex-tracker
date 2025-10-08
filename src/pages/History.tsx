import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Calendar, Clock, TrendingUp, Dumbbell } from 'lucide-react';

export default function History() {
  const { data: sessions, isLoading } = useQuery({
    queryKey: queryKeys.sessions.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .not('finished_at', 'is', null)
        .order('started_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">History</h1>
          <p className="text-muted-foreground">View your workout history</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : sessions && sessions.length > 0 ? (
          <div className="space-y-4">
            {sessions.map((session) => {
              const startTime = new Date(session.started_at);
              const endTime = session.finished_at ? new Date(session.finished_at) : null;
              const duration = endTime
                ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000 / 60)
                : 0;

              return (
                <Link key={session.id} to={`/history/${session.id}`}>
                  <Card className="transition-all hover:shadow-elevated">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{session.title}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {startTime.toLocaleDateString('en-US', {
                              weekday: 'long',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <Badge variant="outline">{session.day_dow}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{duration} min</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <TrendingUp className="h-4 w-4" />
                          <span>{session.total_volume?.toFixed(0) || 0} kg</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>{startTime.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Dumbbell className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No workouts yet</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Complete your first workout to see it here
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
