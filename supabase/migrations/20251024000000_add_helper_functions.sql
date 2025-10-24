-- =====================================================
-- HELPER FUNCTIONS FOR AI TRAINER
-- These functions simplify complex operations so the AI
-- can accomplish tasks in single calls instead of 12-20+
-- =====================================================

-- =====================================================
-- 1. CREATE_COMPLETE_WORKOUT
-- Creates a complete workout with all days, groups, and exercises
-- in a single transaction
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_complete_workout(
  p_user_id UUID,
  p_workout_name TEXT,
  p_workout_summary TEXT DEFAULT NULL,
  p_days JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workout_id UUID;
  v_day JSONB;
  v_day_id UUID;
  v_group JSONB;
  v_group_id UUID;
  v_exercise JSONB;
  v_exercise_id UUID;
  v_item_id UUID;
  v_result JSONB;
BEGIN
  -- Validate inputs
  IF p_workout_name IS NULL OR trim(p_workout_name) = '' THEN
    RAISE EXCEPTION 'Workout name is required';
  END IF;

  -- Create the workout
  INSERT INTO public.workouts (name, summary, user_id)
  VALUES (p_workout_name, p_workout_summary, p_user_id)
  RETURNING id INTO v_workout_id;

  -- Process each day
  FOR v_day IN SELECT * FROM jsonb_array_elements(p_days)
  LOOP
    -- Create workout day
    INSERT INTO public.workout_days (
      workout_id,
      dow,
      position
    )
    VALUES (
      v_workout_id,
      (v_day->>'dow')::public.day_of_week,
      COALESCE((v_day->>'position')::int, 1)
    )
    RETURNING id INTO v_day_id;

    -- Process each group in the day
    FOR v_group IN SELECT * FROM jsonb_array_elements(v_day->'groups')
    LOOP
      -- Create workout group
      INSERT INTO public.workout_groups (
        workout_day_id,
        name,
        group_type,
        rest_seconds,
        position
      )
      VALUES (
        v_day_id,
        v_group->>'name',
        (v_group->>'group_type')::public.group_type,
        (v_group->>'rest_seconds')::int,
        COALESCE((v_group->>'position')::int, 1)
      )
      RETURNING id INTO v_group_id;

      -- Process each exercise in the group
      FOR v_exercise IN SELECT * FROM jsonb_array_elements(v_group->'exercises')
      LOOP
        -- Find or create exercise
        SELECT id INTO v_exercise_id
        FROM public.exercises
        WHERE name = v_exercise->>'name'
          AND user_id = p_user_id
          AND deleted_at IS NULL;

        IF v_exercise_id IS NULL THEN
          INSERT INTO public.exercises (
            name,
            category,
            instructions,
            user_id
          )
          VALUES (
            v_exercise->>'name',
            COALESCE(v_exercise->>'category', 'strength'),
            v_exercise->>'instructions',
            p_user_id
          )
          RETURNING id INTO v_exercise_id;
        END IF;

        -- Create workout item
        INSERT INTO public.workout_items (
          workout_group_id,
          exercise_id,
          position,
          target_sets,
          target_reps,
          target_weight,
          rest_seconds_override,
          notes
        )
        VALUES (
          v_group_id,
          v_exercise_id,
          COALESCE((v_exercise->>'position')::int, 1),
          (v_exercise->>'target_sets')::int,
          (v_exercise->>'target_reps')::int,
          (v_exercise->>'target_weight')::double precision,
          (v_exercise->>'rest_seconds_override')::int,
          v_exercise->>'notes'
        );
      END LOOP;
    END LOOP;
  END LOOP;

  -- Build result with full workout structure
  SELECT jsonb_build_object(
    'success', true,
    'workout_id', v_workout_id,
    'message', format('Created workout: %s with %s days', p_workout_name, jsonb_array_length(p_days)),
    'workout', (
      SELECT jsonb_build_object(
        'id', w.id,
        'name', w.name,
        'summary', w.summary,
        'days', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', wd.id,
              'dow', wd.dow,
              'position', wd.position,
              'groups', (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', wg.id,
                    'name', wg.name,
                    'group_type', wg.group_type,
                    'rest_seconds', wg.rest_seconds,
                    'items_count', (
                      SELECT count(*)
                      FROM public.workout_items
                      WHERE workout_group_id = wg.id
                        AND deleted_at IS NULL
                    )
                  )
                )
                FROM public.workout_groups wg
                WHERE wg.workout_day_id = wd.id
                  AND wg.deleted_at IS NULL
                ORDER BY wg.position
              )
            )
          )
          FROM public.workout_days wd
          WHERE wd.workout_id = w.id
            AND wd.deleted_at IS NULL
          ORDER BY wd.position
        )
      )
      FROM public.workouts w
      WHERE w.id = v_workout_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- =====================================================
-- 2. START_SESSION_FROM_WORKOUT
-- Creates a session by copying workout template structure
-- Automatically detects day of week if not provided
-- =====================================================

CREATE OR REPLACE FUNCTION public.start_session_from_workout(
  p_user_id UUID,
  p_workout_id UUID,
  p_plan_id UUID DEFAULT NULL,
  p_dow public.day_of_week DEFAULT NULL,
  p_title TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_id UUID;
  v_day_dow public.day_of_week;
  v_title TEXT;
  v_workout_day_id UUID;
  v_group RECORD;
  v_session_group_id UUID;
  v_item RECORD;
  v_result JSONB;
BEGIN
  -- Determine day of week (today if not specified)
  v_day_dow := COALESCE(
    p_dow,
    CASE EXTRACT(DOW FROM CURRENT_DATE)
      WHEN 0 THEN 'Sun'::public.day_of_week
      WHEN 1 THEN 'Mon'::public.day_of_week
      WHEN 2 THEN 'Tue'::public.day_of_week
      WHEN 3 THEN 'Wed'::public.day_of_week
      WHEN 4 THEN 'Thu'::public.day_of_week
      WHEN 5 THEN 'Fri'::public.day_of_week
      WHEN 6 THEN 'Sat'::public.day_of_week
    END
  );

  -- Generate title if not provided
  SELECT COALESCE(p_title, name || ' - ' || v_day_dow)
  INTO v_title
  FROM public.workouts
  WHERE id = p_workout_id;

  -- Get the workout day for this day of week
  SELECT id INTO v_workout_day_id
  FROM public.workout_days
  WHERE workout_id = p_workout_id
    AND dow = v_day_dow
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_workout_day_id IS NULL THEN
    RAISE EXCEPTION 'No workout found for % in this program', v_day_dow;
  END IF;

  -- Create the session
  INSERT INTO public.sessions (
    title,
    plan_id,
    workout_id,
    day_dow,
    started_at,
    user_id
  )
  VALUES (
    v_title,
    p_plan_id,
    p_workout_id,
    v_day_dow,
    now(),
    p_user_id
  )
  RETURNING id INTO v_session_id;

  -- Copy workout groups to session groups
  FOR v_group IN
    SELECT *
    FROM public.workout_groups
    WHERE workout_day_id = v_workout_day_id
      AND deleted_at IS NULL
    ORDER BY position
  LOOP
    INSERT INTO public.session_groups (
      session_id,
      name,
      group_type,
      rest_seconds,
      position
    )
    VALUES (
      v_session_id,
      v_group.name,
      v_group.group_type,
      v_group.rest_seconds,
      v_group.position
    )
    RETURNING id INTO v_session_group_id;

    -- Copy workout items to session items
    FOR v_item IN
      SELECT
        wi.*,
        e.name as exercise_name
      FROM public.workout_items wi
      JOIN public.exercises e ON e.id = wi.exercise_id
      WHERE wi.workout_group_id = v_group.id
        AND wi.deleted_at IS NULL
      ORDER BY wi.position
    LOOP
      INSERT INTO public.session_items (
        session_group_id,
        exercise_name,
        position,
        target_sets,
        target_reps,
        target_weight,
        rest_seconds,
        notes
      )
      VALUES (
        v_session_group_id,
        v_item.exercise_name,
        v_item.position,
        v_item.target_sets,
        v_item.target_reps,
        v_item.target_weight,
        COALESCE(v_item.rest_seconds_override, v_group.rest_seconds),
        v_item.notes
      );
    END LOOP;
  END LOOP;

  -- Build result
  SELECT jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'message', format('Started session: %s', v_title),
    'session', (
      SELECT jsonb_build_object(
        'id', s.id,
        'title', s.title,
        'day_dow', s.day_dow,
        'started_at', s.started_at,
        'groups_count', (
          SELECT count(*)
          FROM public.session_groups
          WHERE session_id = s.id
        ),
        'exercises_count', (
          SELECT count(*)
          FROM public.session_items si
          JOIN public.session_groups sg ON sg.id = si.session_group_id
          WHERE sg.session_id = s.id
        )
      )
      FROM public.sessions s
      WHERE s.id = v_session_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- =====================================================
-- 3. GET_EXERCISE_HISTORY
-- Returns comprehensive history for a specific exercise
-- including all sets, PRs, and statistics
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_exercise_history(
  p_user_id UUID,
  p_exercise_name TEXT,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  -- Set date range (default: last 3 months)
  v_start_date := COALESCE(p_start_date, now() - interval '3 months');
  v_end_date := COALESCE(p_end_date, now());

  -- Build comprehensive result
  SELECT jsonb_build_object(
    'exercise_name', p_exercise_name,
    'date_range', jsonb_build_object(
      'start', v_start_date,
      'end', v_end_date
    ),
    'statistics', (
      SELECT jsonb_build_object(
        'total_sessions', count(DISTINCT s.id),
        'total_sets', count(cs.id),
        'total_volume', COALESCE(sum(cs.reps * cs.weight), 0),
        'avg_volume_per_session', COALESCE(avg(session_volume), 0),
        'pr_weight', COALESCE(max(cs.weight), 0),
        'pr_reps_at_weight', (
          SELECT cs2.reps
          FROM public.completed_sets cs2
          WHERE cs2.weight = max(cs.weight)
          ORDER BY cs2.reps DESC
          LIMIT 1
        ),
        'max_volume_set', COALESCE(max(cs.reps * cs.weight), 0)
      )
      FROM public.sessions s
      JOIN public.session_groups sg ON sg.session_id = s.id
      JOIN public.session_items si ON si.session_group_id = sg.id
      LEFT JOIN public.completed_sets cs ON cs.session_item_id = si.id
      LEFT JOIN LATERAL (
        SELECT sum(cs_inner.reps * cs_inner.weight) as session_volume
        FROM public.completed_sets cs_inner
        WHERE cs_inner.session_item_id = si.id
      ) sv ON true
      WHERE s.user_id = p_user_id
        AND si.exercise_name ILIKE p_exercise_name
        AND s.started_at >= v_start_date
        AND s.started_at <= v_end_date
        AND s.finished_at IS NOT NULL
    ),
    'sessions', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', s.started_at,
          'session_id', s.id,
          'session_title', s.title,
          'sets', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'set_number', cs.set_number,
                'reps', cs.reps,
                'weight', cs.weight,
                'volume', cs.reps * cs.weight
              )
              ORDER BY cs.set_number
            )
            FROM public.completed_sets cs
            WHERE cs.session_item_id = si.id
          ),
          'total_volume', (
            SELECT COALESCE(sum(cs.reps * cs.weight), 0)
            FROM public.completed_sets cs
            WHERE cs.session_item_id = si.id
          ),
          'best_set', (
            SELECT jsonb_build_object(
              'reps', cs.reps,
              'weight', cs.weight,
              'volume', cs.reps * cs.weight
            )
            FROM public.completed_sets cs
            WHERE cs.session_item_id = si.id
            ORDER BY cs.reps * cs.weight DESC
            LIMIT 1
          )
        )
        ORDER BY s.started_at DESC
      )
      FROM public.sessions s
      JOIN public.session_groups sg ON sg.session_id = s.id
      JOIN public.session_items si ON si.session_group_id = sg.id
      WHERE s.user_id = p_user_id
        AND si.exercise_name ILIKE p_exercise_name
        AND s.started_at >= v_start_date
        AND s.started_at <= v_end_date
        AND s.finished_at IS NOT NULL
      LIMIT p_limit
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- =====================================================
-- 4. GET_WORKOUT_ANALYTICS
-- Returns comprehensive analytics about workout performance
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_workout_analytics(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_workout_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  -- Set date range (default: last 3 months)
  v_start_date := COALESCE(p_start_date, now() - interval '3 months');
  v_end_date := COALESCE(p_end_date, now());

  SELECT jsonb_build_object(
    'date_range', jsonb_build_object(
      'start', v_start_date,
      'end', v_end_date
    ),
    'summary', (
      SELECT jsonb_build_object(
        'total_sessions', count(*),
        'total_volume', COALESCE(sum(s.total_volume), 0),
        'total_time_minutes', COALESCE(
          sum(EXTRACT(EPOCH FROM (s.finished_at - s.started_at)) / 60),
          0
        ),
        'avg_session_duration', COALESCE(
          avg(EXTRACT(EPOCH FROM (s.finished_at - s.started_at)) / 60),
          0
        ),
        'avg_volume_per_session', COALESCE(avg(s.total_volume), 0)
      )
      FROM public.sessions s
      WHERE s.user_id = p_user_id
        AND s.started_at >= v_start_date
        AND s.started_at <= v_end_date
        AND s.finished_at IS NOT NULL
        AND (p_workout_id IS NULL OR s.workout_id = p_workout_id)
    ),
    'by_week', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'week_start', week_start,
          'sessions', session_count,
          'total_volume', total_volume,
          'avg_duration', avg_duration
        )
        ORDER BY week_start DESC
      )
      FROM (
        SELECT
          date_trunc('week', s.started_at) as week_start,
          count(*) as session_count,
          COALESCE(sum(s.total_volume), 0) as total_volume,
          COALESCE(avg(EXTRACT(EPOCH FROM (s.finished_at - s.started_at)) / 60), 0) as avg_duration
        FROM public.sessions s
        WHERE s.user_id = p_user_id
          AND s.started_at >= v_start_date
          AND s.started_at <= v_end_date
          AND s.finished_at IS NOT NULL
          AND (p_workout_id IS NULL OR s.workout_id = p_workout_id)
        GROUP BY date_trunc('week', s.started_at)
      ) weekly_stats
    ),
    'top_exercises', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'exercise_name', exercise_name,
          'frequency', frequency,
          'total_volume', total_volume,
          'avg_weight', avg_weight
        )
        ORDER BY frequency DESC
      )
      FROM (
        SELECT
          si.exercise_name,
          count(DISTINCT s.id) as frequency,
          COALESCE(sum(cs.reps * cs.weight), 0) as total_volume,
          COALESCE(avg(cs.weight), 0) as avg_weight
        FROM public.sessions s
        JOIN public.session_groups sg ON sg.session_id = s.id
        JOIN public.session_items si ON si.session_group_id = sg.id
        LEFT JOIN public.completed_sets cs ON cs.session_item_id = si.id
        WHERE s.user_id = p_user_id
          AND s.started_at >= v_start_date
          AND s.started_at <= v_end_date
          AND s.finished_at IS NOT NULL
          AND (p_workout_id IS NULL OR s.workout_id = p_workout_id)
        GROUP BY si.exercise_name
        ORDER BY count(DISTINCT s.id) DESC
        LIMIT 10
      ) top_ex
    ),
    'personal_records', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'exercise_name', exercise_name,
          'date', pr_date,
          'weight', pr_weight,
          'reps', pr_reps,
          'volume', pr_volume
        )
        ORDER BY pr_date DESC
      )
      FROM (
        SELECT DISTINCT ON (si.exercise_name)
          si.exercise_name,
          s.started_at as pr_date,
          cs.weight as pr_weight,
          cs.reps as pr_reps,
          cs.reps * cs.weight as pr_volume
        FROM public.sessions s
        JOIN public.session_groups sg ON sg.session_id = s.id
        JOIN public.session_items si ON si.session_group_id = sg.id
        JOIN public.completed_sets cs ON cs.session_item_id = si.id
        WHERE s.user_id = p_user_id
          AND s.started_at >= v_start_date
          AND s.started_at <= v_end_date
          AND s.finished_at IS NOT NULL
          AND (p_workout_id IS NULL OR s.workout_id = p_workout_id)
        ORDER BY si.exercise_name, cs.weight DESC, cs.reps DESC
      ) prs
      LIMIT 20
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- =====================================================
-- 5. CLONE_WORKOUT
-- Creates a copy of an existing workout with optional modifications
-- =====================================================

CREATE OR REPLACE FUNCTION public.clone_workout(
  p_user_id UUID,
  p_workout_id UUID,
  p_new_name TEXT,
  p_scale_weights NUMERIC DEFAULT 1.0,
  p_change_reps INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_workout_id UUID;
  v_day RECORD;
  v_new_day_id UUID;
  v_group RECORD;
  v_new_group_id UUID;
  v_item RECORD;
  v_result JSONB;
BEGIN
  -- Verify source workout exists and belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM public.workouts
    WHERE id = p_workout_id
      AND user_id = p_user_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Workout not found or access denied';
  END IF;

  -- Create new workout
  INSERT INTO public.workouts (name, summary, user_id)
  SELECT
    p_new_name,
    summary || ' (Cloned)',
    p_user_id
  FROM public.workouts
  WHERE id = p_workout_id
  RETURNING id INTO v_new_workout_id;

  -- Clone all workout days
  FOR v_day IN
    SELECT *
    FROM public.workout_days
    WHERE workout_id = p_workout_id
      AND deleted_at IS NULL
    ORDER BY position
  LOOP
    INSERT INTO public.workout_days (workout_id, dow, position)
    VALUES (v_new_workout_id, v_day.dow, v_day.position)
    RETURNING id INTO v_new_day_id;

    -- Clone all groups for this day
    FOR v_group IN
      SELECT *
      FROM public.workout_groups
      WHERE workout_day_id = v_day.id
        AND deleted_at IS NULL
      ORDER BY position
    LOOP
      INSERT INTO public.workout_groups (
        workout_day_id,
        name,
        group_type,
        rest_seconds,
        position
      )
      VALUES (
        v_new_day_id,
        v_group.name,
        v_group.group_type,
        v_group.rest_seconds,
        v_group.position
      )
      RETURNING id INTO v_new_group_id;

      -- Clone all items for this group (with modifications)
      FOR v_item IN
        SELECT *
        FROM public.workout_items
        WHERE workout_group_id = v_group.id
          AND deleted_at IS NULL
        ORDER BY position
      LOOP
        INSERT INTO public.workout_items (
          workout_group_id,
          exercise_id,
          position,
          target_sets,
          target_reps,
          target_weight,
          rest_seconds_override,
          notes
        )
        VALUES (
          v_new_group_id,
          v_item.exercise_id,
          v_item.position,
          v_item.target_sets,
          CASE
            WHEN v_item.target_reps IS NOT NULL
            THEN v_item.target_reps + p_change_reps
            ELSE NULL
          END,
          CASE
            WHEN v_item.target_weight IS NOT NULL
            THEN v_item.target_weight * p_scale_weights
            ELSE NULL
          END,
          v_item.rest_seconds_override,
          v_item.notes
        );
      END LOOP;
    END LOOP;
  END LOOP;

  -- Build result
  SELECT jsonb_build_object(
    'success', true,
    'workout_id', v_new_workout_id,
    'message', format('Cloned workout as: %s', p_new_name),
    'modifications', jsonb_build_object(
      'weight_scale', p_scale_weights,
      'reps_change', p_change_reps
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- =====================================================
-- GRANT PERMISSIONS
-- Allow authenticated users to execute these functions
-- =====================================================

GRANT EXECUTE ON FUNCTION public.create_complete_workout TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_session_from_workout TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_exercise_history TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workout_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION public.clone_workout TO authenticated;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION public.create_complete_workout IS
'Creates a complete workout with all nested structure (days, groups, exercises) in a single transaction. Auto-creates exercises if they don''t exist.';

COMMENT ON FUNCTION public.start_session_from_workout IS
'Starts a new workout session by copying the workout template structure. Auto-detects day of week if not provided.';

COMMENT ON FUNCTION public.get_exercise_history IS
'Returns comprehensive history for a specific exercise including all sets, PRs, and statistics over a date range.';

COMMENT ON FUNCTION public.get_workout_analytics IS
'Returns comprehensive analytics including volume trends, top exercises, and personal records.';

COMMENT ON FUNCTION public.clone_workout IS
'Creates a copy of an existing workout with optional weight scaling and rep adjustments.';
