import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Plus, Calendar, Dumbbell } from 'lucide-react';

export default function Plans() {
  const { data: plans, isLoading } = useQuery({
    queryKey: queryKeys.plans.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select(`
          *,
          workouts (name)
        `)
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
            <h1 className="text-3xl font-bold tracking-tight">Plans</h1>
            <p className="text-muted-foreground">Manage your training plans</p>
          </div>
          <Link to="/plans/create">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Plan
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : plans && plans.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <Link key={plan.id} to={`/plans/${plan.id}`}>
                <Card className="h-full transition-all hover:shadow-elevated">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle>{plan.name}</CardTitle>
                          {plan.is_active && <Badge>Active</Badge>}
                        </div>
                        <CardDescription className="flex items-center gap-1">
                          <Dumbbell className="h-3 w-3" />
                          {plan.workouts?.name}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{plan.duration_weeks} weeks</span>
                      </div>
                      <p className="text-muted-foreground">
                        Starts {new Date(plan.start_date).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No plans yet</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Create your first training plan to get started
              </p>
              <Link to="/plans/create">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Plan
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
