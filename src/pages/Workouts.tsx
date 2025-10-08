import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Plus, Dumbbell } from 'lucide-react';

export default function Workouts() {
  const { data: workouts, isLoading } = useQuery({
    queryKey: queryKeys.workouts.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Workouts</h1>
            <p className="text-muted-foreground">Manage your workout programs</p>
          </div>
          <Link to="/workouts/create">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Workout
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : workouts && workouts.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workouts.map((workout) => (
              <Link key={workout.id} to={`/workouts/${workout.id}`}>
                <Card className="h-full transition-all hover:shadow-elevated">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <Dumbbell className="h-5 w-5 text-primary" />
                          {workout.name}
                        </CardTitle>
                        {workout.summary && (
                          <CardDescription className="mt-2">{workout.summary}</CardDescription>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Updated {new Date(workout.updated_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Dumbbell className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No workouts yet</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Create your first workout to get started
              </p>
              <Link to="/workouts/create">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Workout
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
