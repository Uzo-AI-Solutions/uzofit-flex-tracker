import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { DAYS_OF_WEEK, DayOfWeek, GroupType, GROUP_TYPE_LABELS } from '@/lib/types';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Trash2, GripVertical, Dumbbell } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';

export default function WorkoutDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Mon');

  const { data: workout, isLoading } = useQuery({
    queryKey: queryKeys.workouts.one(id!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: days } = useQuery({
    queryKey: [...queryKeys.workouts.one(id!), 'days'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_days')
        .select(`
          *,
          workout_groups (
            *,
            workout_items (
              *,
              exercises (name, category)
            )
          )
        `)
        .eq('workout_id', id)
        .is('deleted_at', null)
        .order('position');
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const addDayMutation = useMutation({
    mutationFn: async (dow: DayOfWeek) => {
      const { error } = await supabase
        .from('workout_days')
        .insert({ workout_id: id, dow, position: 1 });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.one(id!) });
      toast({ title: 'Day added successfully' });
    },
  });

  const deleteDayMutation = useMutation({
    mutationFn: async (dayId: string) => {
      const { error } = await supabase
        .from('workout_days')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', dayId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.one(id!) });
      toast({ title: 'Day removed' });
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

  if (!workout) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Workout not found</h2>
          <Button className="mt-4" onClick={() => navigate('/workouts')}>
            Back to Workouts
          </Button>
        </div>
      </Layout>
    );
  }

  const dayData = days?.filter(d => d.dow === selectedDay) || [];
  const usedDays = new Set(days?.map(d => d.dow) || []);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/workouts')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{workout.name}</h1>
              {workout.summary && (
                <p className="text-muted-foreground">{workout.summary}</p>
              )}
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Training Days</CardTitle>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Day
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Training Day</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Select onValueChange={(value) => addDayMutation.mutate(value as DayOfWeek)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.filter(d => !usedDays.has(d)).map(day => (
                        <SelectItem key={day} value={day}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedDay} onValueChange={(v) => setSelectedDay(v as DayOfWeek)}>
              <TabsList className="grid grid-cols-7 w-full">
                {DAYS_OF_WEEK.map(day => (
                  <TabsTrigger
                    key={day}
                    value={day}
                    disabled={!usedDays.has(day)}
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    {day}
                  </TabsTrigger>
                ))}
              </TabsList>
              {DAYS_OF_WEEK.map(day => (
                <TabsContent key={day} value={day} className="space-y-4 mt-4">
                  {dayData.length > 0 ? (
                    <>
                      <DayContent workoutId={id!} dayId={dayData[0].id} />
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteDayMutation.mutate(dayData[0].id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove {day}
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      This day is not part of the workout program
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function DayContent({ workoutId, dayId }: { workoutId: string; dayId: string }) {
  const queryClient = useQueryClient();
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState<GroupType>('single');
  const [restSeconds, setRestSeconds] = useState<number>(90);

  const { data: groups } = useQuery({
    queryKey: [...queryKeys.workouts.one(workoutId), 'days', dayId, 'groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_groups')
        .select(`
          *,
          workout_items (
            *,
            exercises (name, category)
          )
        `)
        .eq('workout_day_id', dayId)
        .is('deleted_at', null)
        .order('position');
      
      if (error) throw error;
      return data;
    },
  });

  const addGroupMutation = useMutation({
    mutationFn: async () => {
      const maxPosition = Math.max(0, ...(groups?.map(g => g.position) || []));
      const { error } = await supabase
        .from('workout_groups')
        .insert({
          workout_day_id: dayId,
          name: groupName,
          group_type: groupType,
          rest_seconds: restSeconds,
          position: maxPosition + 1,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.one(workoutId) });
      setShowAddGroup(false);
      setGroupName('');
      setGroupType('single');
      toast({ title: 'Group added' });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase
        .from('workout_groups')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', groupId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.one(workoutId) });
      toast({ title: 'Group removed' });
    },
  });

  return (
    <div className="space-y-4">
      {groups?.map((group) => (
        <Card key={group.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <div>
                <CardTitle className="text-lg">{group.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {GROUP_TYPE_LABELS[group.group_type]} • Rest: {group.rest_seconds || 0}s
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteGroupMutation.mutate(group.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <GroupItems workoutId={workoutId} groupId={group.id} items={group.workout_items} />
          </CardContent>
        </Card>
      ))}

      {showAddGroup ? (
        <Card>
          <CardHeader>
            <CardTitle>New Group</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g., Chest & Triceps"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={groupType} onValueChange={(v) => setGroupType(v as GroupType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GROUP_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rest (seconds)</Label>
              <Input
                type="number"
                value={restSeconds}
                onChange={(e) => setRestSeconds(Number(e.target.value))}
                min={0}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => addGroupMutation.mutate()} disabled={!groupName.trim()}>
                Add Group
              </Button>
              <Button variant="outline" onClick={() => setShowAddGroup(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setShowAddGroup(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Group
        </Button>
      )}
    </div>
  );
}

function GroupItems({ workoutId, groupId, items }: any) {
  const queryClient = useQueryClient();
  const [showAddItem, setShowAddItem] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [targetSets, setTargetSets] = useState(3);
  const [targetReps, setTargetReps] = useState(10);
  const [targetWeight, setTargetWeight] = useState(0);
  const [notes, setNotes] = useState('');

  const { data: exercises } = useQuery({
    queryKey: queryKeys.exercises.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .is('deleted_at', null)
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      const maxPosition = Math.max(0, ...(items?.map((i: any) => i.position) || []));
      const { error } = await supabase
        .from('workout_items')
        .insert({
          workout_group_id: groupId,
          exercise_id: selectedExercise,
          position: maxPosition + 1,
          target_sets: targetSets,
          target_reps: targetReps,
          target_weight: targetWeight,
          notes,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.one(workoutId) });
      setShowAddItem(false);
      setSelectedExercise('');
      setTargetSets(3);
      setTargetReps(10);
      setTargetWeight(0);
      setNotes('');
      toast({ title: 'Exercise added' });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('workout_items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', itemId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.one(workoutId) });
      toast({ title: 'Exercise removed' });
    },
  });

  return (
    <div className="space-y-2">
      {items?.map((item: any, idx: number) => (
        <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Dumbbell className="h-4 w-4 text-primary" />
            <div>
              <p className="font-medium">{item.exercises?.name || 'Unknown'}</p>
              <p className="text-sm text-muted-foreground">
                {item.target_sets} × {item.target_reps} reps
                {item.target_weight > 0 && ` @ ${item.target_weight}kg`}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteItemMutation.mutate(item.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {showAddItem ? (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="space-y-2">
            <Label>Exercise</Label>
            <Select value={selectedExercise} onValueChange={setSelectedExercise}>
              <SelectTrigger>
                <SelectValue placeholder="Select exercise" />
              </SelectTrigger>
              <SelectContent>
                {exercises?.map(ex => (
                  <SelectItem key={ex.id} value={ex.id}>{ex.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label>Sets</Label>
              <Input
                type="number"
                value={targetSets}
                onChange={(e) => setTargetSets(Number(e.target.value))}
                min={1}
              />
            </div>
            <div className="space-y-2">
              <Label>Reps</Label>
              <Input
                type="number"
                value={targetReps}
                onChange={(e) => setTargetReps(Number(e.target.value))}
                min={1}
              />
            </div>
            <div className="space-y-2">
              <Label>Weight (kg)</Label>
              <Input
                type="number"
                value={targetWeight}
                onChange={(e) => setTargetWeight(Number(e.target.value))}
                min={0}
                step={0.5}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => addItemMutation.mutate()}
              disabled={!selectedExercise}
            >
              Add
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAddItem(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setShowAddItem(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Exercise
        </Button>
      )}
    </div>
  );
}
