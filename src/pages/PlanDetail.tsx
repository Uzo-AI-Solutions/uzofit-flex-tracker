import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { DAYS_OF_WEEK, DayOfWeek } from '@/lib/types';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, PlayCircle, Dumbbell } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: plan, isLoading } = useQuery({
    queryKey: queryKeys.plans.one(id!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select(`
          *,
          workouts (
            id,
            name,
            summary,
            workout_days (
              id,
              dow,
              workout_groups (
                id,
                name
              )
            )
          )
        `)
        .eq('id', id)
        .is('deleted_at', null)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const startSessionMutation = useMutation({
    mutationFn: async () => {
      const today = new Date();
      const todayDow = DAYS_OF_WEEK[today.getDay() === 0 ? 6 : today.getDay() - 1] as DayOfWeek;
      
      const workoutDay = plan?.workouts.workout_days?.find(d => d.dow === todayDow);
      
      if (!workoutDay) {
        throw new Error(`No workout scheduled for ${todayDow}`);
      }

      // Fetch full workout day data with groups and items
      const { data: dayData, error: dayError } = await supabase
        .from('workout_days')
        .select(`
          *,
          workout_groups (
            *,
            workout_items (
              *,
              exercises (name)
            )
          )
        `)
        .eq('id', workoutDay.id)
        .single();

      if (dayError) throw dayError;

      // Create session
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          title: `${plan.workouts.name} – ${todayDow} – ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          plan_id: plan.id,
          workout_id: plan.workout_id,
          day_dow: todayDow,
          started_at: today.toISOString(),
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Copy groups and items
      for (const group of dayData.workout_groups) {
        const { data: sessionGroup, error: groupError } = await supabase
          .from('session_groups')
          .insert({
            session_id: session.id,
            name: group.name,
            group_type: group.group_type,
            rest_seconds: group.rest_seconds,
            position: group.position,
          })
          .select()
          .single();

        if (groupError) throw groupError;

        for (const item of group.workout_items) {
          const { error: itemError } = await supabase
            .from('session_items')
            .insert({
              session_group_id: sessionGroup.id,
              exercise_name: item.exercises.name,
              position: item.position,
              target_sets: item.target_sets,
              target_reps: item.target_reps,
              target_weight: item.target_weight,
              rest_seconds: item.rest_seconds_override || group.rest_seconds,
              notes: item.notes,
            });

          if (itemError) throw itemError;
        }
      }

      return session;
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      toast({ title: 'Session started!' });
      navigate(`/sessions/active/${session.id}`);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to start session',
        description: error.message,
        variant: 'destructive',
      });
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

  if (!plan) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Plan not found</h2>
          <Button className="mt-4" onClick={() => navigate('/plans')}>
            Back to Plans
          </Button>
        </div>
      </Layout>
    );
  }

  const endDate = new Date(plan.start_date);
  endDate.setDate(endDate.getDate() + plan.duration_weeks * 7);
  const today = new Date();
  const todayDow = DAYS_OF_WEEK[today.getDay() === 0 ? 6 : today.getDay() - 1] as DayOfWeek;
  const hasWorkoutToday = plan.workouts.workout_days?.some(d => d.dow === todayDow);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/plans')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">{plan.name}</h1>
                {plan.is_active && <Badge>Active</Badge>}
              </div>
              <p className="text-muted-foreground">
                {plan.workouts.name}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Duration</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{plan.duration_weeks} weeks</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Start Date</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Date(plan.start_date).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">End Date</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {endDate.toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Start Today's Workout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Dumbbell className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold">
                  Today is {todayDow}
                </p>
                <p className="text-sm text-muted-foreground">
                  {hasWorkoutToday
                    ? `You have a workout scheduled for today`
                    : `No workout scheduled for ${todayDow}`}
                </p>
              </div>
            </div>
            <Button
              className="w-full gap-2"
              size="lg"
              disabled={!hasWorkoutToday || startSessionMutation.isPending}
              onClick={() => startSessionMutation.mutate()}
            >
              <PlayCircle className="h-5 w-5" />
              {startSessionMutation.isPending ? 'Starting...' : 'Start Session'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Training Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {DAYS_OF_WEEK.map(day => {
                const hasWorkout = plan.workouts.workout_days?.some(d => d.dow === day);
                return (
                  <div
                    key={day}
                    className={`p-3 rounded-lg text-center ${
                      hasWorkout
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <p className="text-xs font-medium">{day}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
