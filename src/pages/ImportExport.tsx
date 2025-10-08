import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function ImportExport() {
  const queryClient = useQueryClient();
  const [exportWorkoutId, setExportWorkoutId] = useState('');
  const [importJson, setImportJson] = useState('');

  const { data: workouts } = useQuery({
    queryKey: queryKeys.workouts.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .is('deleted_at', null)
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          *,
          workout_days (
            *,
            workout_groups (
              *,
              workout_items (
                *,
                exercises (*)
              )
            )
          )
        `)
        .eq('id', exportWorkoutId)
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.name.replace(/\s+/g, '-').toLowerCase()}-workout.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Workout exported successfully' });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const data = JSON.parse(importJson);
      
      // Create workout
      const { data: workout, error: workoutError } = await supabase
        .from('workouts')
        .insert({
          name: `${data.name} (Imported)`,
          summary: data.summary,
        })
        .select()
        .single();
      
      if (workoutError) throw workoutError;

      // Create days, groups, and items
      for (const day of data.workout_days || []) {
        const { data: workoutDay, error: dayError } = await supabase
          .from('workout_days')
          .insert({
            workout_id: workout.id,
            dow: day.dow,
            position: day.position,
          })
          .select()
          .single();
        
        if (dayError) throw dayError;

        for (const group of day.workout_groups || []) {
          const { data: workoutGroup, error: groupError } = await supabase
            .from('workout_groups')
            .insert({
              workout_day_id: workoutDay.id,
              name: group.name,
              group_type: group.group_type,
              rest_seconds: group.rest_seconds,
              position: group.position,
            })
            .select()
            .single();
          
          if (groupError) throw groupError;

          for (const item of group.workout_items || []) {
            // Find or create exercise
            let exerciseId = item.exercise_id;
            if (item.exercises) {
              const { data: existingEx } = await supabase
                .from('exercises')
                .select('id')
                .eq('name', item.exercises.name)
                .maybeSingle();
              
              if (existingEx) {
                exerciseId = existingEx.id;
              } else {
                const { data: newEx, error: exError } = await supabase
                  .from('exercises')
                  .insert({
                    name: item.exercises.name,
                    category: item.exercises.category,
                    instructions: item.exercises.instructions,
                  })
                  .select()
                  .single();
                
                if (exError) throw exError;
                exerciseId = newEx.id;
              }
            }

            const { error: itemError } = await supabase
              .from('workout_items')
              .insert({
                workout_group_id: workoutGroup.id,
                exercise_id: exerciseId,
                position: item.position,
                target_sets: item.target_sets,
                target_reps: item.target_reps,
                target_weight: item.target_weight,
                rest_seconds_override: item.rest_seconds_override,
                notes: item.notes,
              });
            
            if (itemError) throw itemError;
          }
        }
      }

      return workout;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
      setImportJson('');
      toast({ title: 'Workout imported successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to import workout', variant: 'destructive' });
    },
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import / Export</h1>
          <p className="text-muted-foreground">Backup and share your workout programs</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Workout
              </CardTitle>
              <CardDescription>
                Download a workout program as JSON
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={exportWorkoutId} onValueChange={setExportWorkoutId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select workout" />
                </SelectTrigger>
                <SelectContent>
                  {workouts?.map(workout => (
                    <SelectItem key={workout.id} value={workout.id}>
                      {workout.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="w-full gap-2"
                onClick={() => exportMutation.mutate()}
                disabled={!exportWorkoutId || exportMutation.isPending}
              >
                <Download className="h-4 w-4" />
                {exportMutation.isPending ? 'Exporting...' : 'Export Workout'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Import Workout
              </CardTitle>
              <CardDescription>
                Import a workout program from JSON
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                placeholder="Paste workout JSON here..."
                rows={8}
                className="font-mono text-sm"
              />
              <Button
                className="w-full gap-2"
                onClick={() => importMutation.mutate()}
                disabled={!importJson.trim() || importMutation.isPending}
              >
                <Upload className="h-4 w-4" />
                {importMutation.isPending ? 'Importing...' : 'Import Workout'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
