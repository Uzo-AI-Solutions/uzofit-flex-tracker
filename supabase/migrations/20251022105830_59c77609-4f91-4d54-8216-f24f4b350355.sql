-- First, get the user_id for kosiuzodinma@gmail.com and store it
DO $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Get the user_id for kosiuzodinma@gmail.com
  SELECT id INTO target_user_id FROM auth.users WHERE email = 'kosiuzodinma@gmail.com';
  
  -- Add user_id column to workouts
  ALTER TABLE public.workouts ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  UPDATE public.workouts SET user_id = target_user_id WHERE user_id IS NULL;
  ALTER TABLE public.workouts ALTER COLUMN user_id SET NOT NULL;
  
  -- Add user_id column to exercises
  ALTER TABLE public.exercises ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  UPDATE public.exercises SET user_id = target_user_id WHERE user_id IS NULL;
  ALTER TABLE public.exercises ALTER COLUMN user_id SET NOT NULL;
  
  -- Add user_id column to plans
  ALTER TABLE public.plans ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  UPDATE public.plans SET user_id = target_user_id WHERE user_id IS NULL;
  ALTER TABLE public.plans ALTER COLUMN user_id SET NOT NULL;
  
  -- Add user_id column to sessions
  ALTER TABLE public.sessions ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  UPDATE public.sessions SET user_id = target_user_id WHERE user_id IS NULL;
  ALTER TABLE public.sessions ALTER COLUMN user_id SET NOT NULL;
END $$;

-- Drop old permissive policies
DROP POLICY IF EXISTS "auth_all_workouts" ON public.workouts;
DROP POLICY IF EXISTS "auth_all_exercises" ON public.exercises;
DROP POLICY IF EXISTS "auth_all_plans" ON public.plans;
DROP POLICY IF EXISTS "auth_all_sessions" ON public.sessions;
DROP POLICY IF EXISTS "auth_all_workout_days" ON public.workout_days;
DROP POLICY IF EXISTS "auth_all_workout_groups" ON public.workout_groups;
DROP POLICY IF EXISTS "auth_all_workout_items" ON public.workout_items;
DROP POLICY IF EXISTS "auth_all_session_groups" ON public.session_groups;
DROP POLICY IF EXISTS "auth_all_session_items" ON public.session_items;
DROP POLICY IF EXISTS "auth_all_completed_sets" ON public.completed_sets;

-- Create proper RLS policies for workouts
CREATE POLICY "Users can view their own workouts" ON public.workouts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own workouts" ON public.workouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own workouts" ON public.workouts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own workouts" ON public.workouts
  FOR DELETE USING (auth.uid() = user_id);

-- Create proper RLS policies for exercises
CREATE POLICY "Users can view their own exercises" ON public.exercises
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own exercises" ON public.exercises
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own exercises" ON public.exercises
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own exercises" ON public.exercises
  FOR DELETE USING (auth.uid() = user_id);

-- Create proper RLS policies for plans
CREATE POLICY "Users can view their own plans" ON public.plans
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own plans" ON public.plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own plans" ON public.plans
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own plans" ON public.plans
  FOR DELETE USING (auth.uid() = user_id);

-- Create proper RLS policies for sessions
CREATE POLICY "Users can view their own sessions" ON public.sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own sessions" ON public.sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sessions" ON public.sessions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own sessions" ON public.sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for child tables using parent's user_id
CREATE POLICY "Users can view workout_days for their workouts" ON public.workout_days
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workouts 
      WHERE workouts.id = workout_days.workout_id 
      AND workouts.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert workout_days for their workouts" ON public.workout_days
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workouts 
      WHERE workouts.id = workout_days.workout_id 
      AND workouts.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update workout_days for their workouts" ON public.workout_days
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workouts 
      WHERE workouts.id = workout_days.workout_id 
      AND workouts.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete workout_days for their workouts" ON public.workout_days
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workouts 
      WHERE workouts.id = workout_days.workout_id 
      AND workouts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view workout_groups for their workouts" ON public.workout_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workout_days 
      JOIN public.workouts ON workouts.id = workout_days.workout_id
      WHERE workout_days.id = workout_groups.workout_day_id 
      AND workouts.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert workout_groups for their workouts" ON public.workout_groups
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_days 
      JOIN public.workouts ON workouts.id = workout_days.workout_id
      WHERE workout_days.id = workout_groups.workout_day_id 
      AND workouts.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update workout_groups for their workouts" ON public.workout_groups
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workout_days 
      JOIN public.workouts ON workouts.id = workout_days.workout_id
      WHERE workout_days.id = workout_groups.workout_day_id 
      AND workouts.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete workout_groups for their workouts" ON public.workout_groups
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workout_days 
      JOIN public.workouts ON workouts.id = workout_days.workout_id
      WHERE workout_days.id = workout_groups.workout_day_id 
      AND workouts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view workout_items for their workouts" ON public.workout_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workout_groups 
      JOIN public.workout_days ON workout_days.id = workout_groups.workout_day_id
      JOIN public.workouts ON workouts.id = workout_days.workout_id
      WHERE workout_groups.id = workout_items.workout_group_id 
      AND workouts.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert workout_items for their workouts" ON public.workout_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_groups 
      JOIN public.workout_days ON workout_days.id = workout_groups.workout_day_id
      JOIN public.workouts ON workouts.id = workout_days.workout_id
      WHERE workout_groups.id = workout_items.workout_group_id 
      AND workouts.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update workout_items for their workouts" ON public.workout_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workout_groups 
      JOIN public.workout_days ON workout_days.id = workout_groups.workout_day_id
      JOIN public.workouts ON workouts.id = workout_days.workout_id
      WHERE workout_groups.id = workout_items.workout_group_id 
      AND workouts.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete workout_items for their workouts" ON public.workout_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workout_groups 
      JOIN public.workout_days ON workout_days.id = workout_groups.workout_day_id
      JOIN public.workouts ON workouts.id = workout_days.workout_id
      WHERE workout_groups.id = workout_items.workout_group_id 
      AND workouts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view session_groups for their sessions" ON public.session_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sessions 
      WHERE sessions.id = session_groups.session_id 
      AND sessions.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert session_groups for their sessions" ON public.session_groups
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions 
      WHERE sessions.id = session_groups.session_id 
      AND sessions.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update session_groups for their sessions" ON public.session_groups
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.sessions 
      WHERE sessions.id = session_groups.session_id 
      AND sessions.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete session_groups for their sessions" ON public.session_groups
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.sessions 
      WHERE sessions.id = session_groups.session_id 
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view session_items for their sessions" ON public.session_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.session_groups 
      JOIN public.sessions ON sessions.id = session_groups.session_id
      WHERE session_groups.id = session_items.session_group_id 
      AND sessions.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert session_items for their sessions" ON public.session_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.session_groups 
      JOIN public.sessions ON sessions.id = session_groups.session_id
      WHERE session_groups.id = session_items.session_group_id 
      AND sessions.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update session_items for their sessions" ON public.session_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.session_groups 
      JOIN public.sessions ON sessions.id = session_groups.session_id
      WHERE session_groups.id = session_items.session_group_id 
      AND sessions.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete session_items for their sessions" ON public.session_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.session_groups 
      JOIN public.sessions ON sessions.id = session_groups.session_id
      WHERE session_groups.id = session_items.session_group_id 
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view completed_sets for their sessions" ON public.completed_sets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.session_items 
      JOIN public.session_groups ON session_groups.id = session_items.session_group_id
      JOIN public.sessions ON sessions.id = session_groups.session_id
      WHERE session_items.id = completed_sets.session_item_id 
      AND sessions.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert completed_sets for their sessions" ON public.completed_sets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.session_items 
      JOIN public.session_groups ON session_groups.id = session_items.session_group_id
      JOIN public.sessions ON sessions.id = session_groups.session_id
      WHERE session_items.id = completed_sets.session_item_id 
      AND sessions.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update completed_sets for their sessions" ON public.completed_sets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.session_items 
      JOIN public.session_groups ON session_groups.id = session_items.session_group_id
      JOIN public.sessions ON sessions.id = session_groups.session_id
      WHERE session_items.id = completed_sets.session_item_id 
      AND sessions.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete completed_sets for their sessions" ON public.completed_sets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.session_items 
      JOIN public.session_groups ON session_groups.id = session_items.session_group_id
      JOIN public.sessions ON sessions.id = session_groups.session_id
      WHERE session_items.id = completed_sets.session_item_id 
      AND sessions.user_id = auth.uid()
    )
  );