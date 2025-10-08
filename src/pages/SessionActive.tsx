import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle2, Dumbbell } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';
import { GROUP_TYPE_LABELS } from '@/lib/types';

export default function SessionActive() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
    refetchInterval: 3000,
  });

  const finishMutation = useMutation({
    mutationFn: async () => {
      // Calculate total volume
      let totalVolume = 0;
      session?.session_groups?.forEach(group => {
        group.session_items?.forEach(item => {
          item.completed_sets?.forEach(set => {
            totalVolume += set.reps * set.weight;
          });
        });
      });

      const { error } = await supabase
        .from('sessions')
        .update({
          finished_at: new Date().toISOString(),
          total_volume: totalVolume,
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      toast({ title: 'Session completed! 💪' });
      navigate('/history');
    },
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

  if (session.finished_at) {
    navigate(`/history/${session.id}`);
    return null;
  }

  const startTime = new Date(session.started_at);
  const now = new Date();
  const duration = Math.floor((now.getTime() - startTime.getTime()) / 1000 / 60);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/history')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{session.title}</h1>
              <p className="text-muted-foreground">{duration} minutes</p>
            </div>
          </div>
          <Button
            size="lg"
            className="gap-2"
            onClick={() => finishMutation.mutate()}
            disabled={finishMutation.isPending}
          >
            <CheckCircle2 className="h-5 w-5" />
            Finish Workout
          </Button>
        </div>

        <div className="space-y-4">
          {session.session_groups?.map((group, groupIdx) => (
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
                  <Badge variant="outline">Group {groupIdx + 1}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {group.session_items?.map((item) => (
                  <ExerciseLogger key={item.id} sessionId={id!} item={item} />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}

function ExerciseLogger({ sessionId, item }: any) {
  const queryClient = useQueryClient();
  const [reps, setReps] = useState(item.target_reps || 10);
  const [weight, setWeight] = useState(item.target_weight || 0);

  const completedSets = item.completed_sets || [];
  const nextSetNumber = completedSets.length + 1;

  const logSetMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('completed_sets')
        .insert({
          session_item_id: item.id,
          set_number: nextSetNumber,
          reps,
          weight,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.one(sessionId) });
      toast({ title: 'Set logged!' });
    },
  });

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">{item.exercise_name}</p>
            <p className="text-sm text-muted-foreground">
              Target: {item.target_sets} × {item.target_reps} reps
              {item.target_weight > 0 && ` @ ${item.target_weight}kg`}
            </p>
          </div>
        </div>
        <Badge variant="secondary">
          {completedSets.length}/{item.target_sets || 3} sets
        </Badge>
      </div>

      {completedSets.length > 0 && (
        <div className="space-y-1">
          {completedSets.map((set: any) => (
            <div key={set.id} className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded">
              <span className="font-medium">Set {set.set_number}</span>
              <span>{set.reps} reps × {set.weight}kg</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="number"
            value={reps}
            onChange={(e) => setReps(Number(e.target.value))}
            placeholder="Reps"
            min={1}
          />
        </div>
        <div className="flex-1">
          <Input
            type="number"
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            placeholder="Weight (kg)"
            min={0}
            step={0.5}
          />
        </div>
        <Button
          onClick={() => logSetMutation.mutate()}
          disabled={logSetMutation.isPending}
        >
          Log Set {nextSetNumber}
        </Button>
      </div>
    </div>
  );
}
