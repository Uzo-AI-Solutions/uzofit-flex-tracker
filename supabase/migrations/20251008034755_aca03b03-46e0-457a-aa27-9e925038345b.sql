-- ENUMS
CREATE TYPE public.day_of_week AS ENUM ('Mon','Tue','Wed','Thu','Fri','Sat','Sun');
CREATE TYPE public.group_type AS ENUM ('single','superset','triset','circuit');

-- EXERCISES
CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'strength',
  instructions TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- WORKOUTS (structure)
CREATE TABLE public.workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  summary TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.workout_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  dow public.day_of_week NOT NULL,
  position INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (workout_id, dow)
);

CREATE TABLE public.workout_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_day_id UUID NOT NULL REFERENCES public.workout_days(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  group_type public.group_type NOT NULL,
  rest_seconds INT,
  position INT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.workout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_group_id UUID NOT NULL REFERENCES public.workout_groups(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id),
  position INT NOT NULL,
  target_sets INT,
  target_reps INT,
  target_weight DOUBLE PRECISION,
  rest_seconds_override INT,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- PLANS (duration for a workout)
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE RESTRICT,
  duration_weeks INT NOT NULL CHECK (duration_weeks > 0),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- SESSIONS (immutable)
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  plan_id UUID REFERENCES public.plans(id),
  workout_id UUID NOT NULL REFERENCES public.workouts(id),
  day_dow public.day_of_week,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  total_volume DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.session_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  group_type public.group_type NOT NULL,
  rest_seconds INT,
  position INT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.session_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_group_id UUID NOT NULL REFERENCES public.session_groups(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  position INT NOT NULL,
  target_sets INT,
  target_reps INT,
  target_weight DOUBLE PRECISION,
  rest_seconds INT,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.completed_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_item_id UUID NOT NULL REFERENCES public.session_items(id) ON DELETE CASCADE,
  set_number INT NOT NULL,
  reps INT NOT NULL,
  weight DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INDEXES
CREATE INDEX idx_workout_days_workout_dow ON public.workout_days(workout_id, dow);
CREATE INDEX idx_workout_days_workout_pos ON public.workout_days(workout_id, position);
CREATE INDEX idx_workout_groups_day_pos ON public.workout_groups(workout_day_id, position);
CREATE INDEX idx_workout_items_group_pos ON public.workout_items(workout_group_id, position);
CREATE INDEX idx_plans_active ON public.plans(is_active);
CREATE INDEX idx_plans_workout ON public.plans(workout_id);
CREATE INDEX idx_plans_start ON public.plans(start_date);
CREATE INDEX idx_session_groups_session_pos ON public.session_groups(session_id, position);
CREATE INDEX idx_session_items_group_pos ON public.session_items(session_group_id, position);
CREATE INDEX idx_completed_sets_item_set ON public.completed_sets(session_item_id, set_number);
CREATE INDEX idx_exercises_updated ON public.exercises(updated_at);
CREATE INDEX idx_workouts_updated ON public.workouts(updated_at);
CREATE INDEX idx_workout_days_updated ON public.workout_days(updated_at);
CREATE INDEX idx_workout_groups_updated ON public.workout_groups(updated_at);
CREATE INDEX idx_workout_items_updated ON public.workout_items(updated_at);
CREATE INDEX idx_plans_updated ON public.plans(updated_at);
CREATE INDEX idx_sessions_updated ON public.sessions(updated_at);
CREATE INDEX idx_session_groups_updated ON public.session_groups(updated_at);
CREATE INDEX idx_session_items_updated ON public.session_items(updated_at);
CREATE INDEX idx_completed_sets_updated ON public.completed_sets(updated_at);
CREATE INDEX idx_exercises_name ON public.exercises(name) WHERE deleted_at IS NULL;

-- RLS (personal app: any authenticated user can read/write)
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completed_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_exercises" ON public.exercises FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_workouts" ON public.workouts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_workout_days" ON public.workout_days FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_workout_groups" ON public.workout_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_workout_items" ON public.workout_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_plans" ON public.plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_sessions" ON public.sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_session_groups" ON public.session_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_session_items" ON public.session_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_completed_sets" ON public.completed_sets FOR ALL TO authenticated USING (true) WITH CHECK (true);