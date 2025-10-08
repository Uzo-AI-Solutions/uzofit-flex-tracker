import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Clock, TrendingUp } from 'lucide-react';
import { GROUP_TYPE_LABELS } from '@/lib/types';

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: session, isLoading } = useQuery({
    queryKey: queryKeys.sessions.one(id!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          session_groups (
            *,
            session_items (
              *,
              completed_sets (*)
            )
          )
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Session not found</h2>
          <Button className="mt-4" onClick={() => navigate('/history')}>
            Back to History
          </Button>
        </div>
      </Layout>
    );
  }

  const startTime = new Date(session.started_at);
  const endTime = session.finished_at ? new Date(session.finished_at) : null;
  const duration = endTime
    ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000 / 60)
    : 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/history')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{session.title}</h1>
            <p className="text-muted-foreground">
              {startTime.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{duration} min</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {session.total_volume?.toFixed(0) || 0} kg
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Started</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {startTime.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {session.session_groups?.map((group, idx) => (
            <Card key={group.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{group.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {GROUP_TYPE_LABELS[group.group_type]}
                      {group.rest_seconds && ` • Rest: ${group.rest_seconds}s`}
                    </p>
                  </div>
                  <Badge variant="outline">Group {idx + 1}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {group.session_items?.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-lg">{item.exercise_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Target: {item.target_sets} × {item.target_reps} reps
                          {item.target_weight > 0 && ` @ ${item.target_weight}kg`}
                        </p>
                      </div>
                      <Badge>
                        {item.completed_sets?.length || 0}/{item.target_sets || 3} sets
                      </Badge>
                    </div>

                    {item.completed_sets && item.completed_sets.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Completed Sets:</p>
                        <div className="grid gap-2">
                          {item.completed_sets.map((set: any) => (
                            <div
                              key={set.id}
                              className="flex items-center justify-between bg-muted/50 p-3 rounded-lg"
                            >
                              <span className="font-medium">Set {set.set_number}</span>
                              <span className="text-muted-foreground">
                                {set.reps} reps × {set.weight}kg = {(set.reps * set.weight).toFixed(1)}kg
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No sets completed</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
