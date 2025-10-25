-- Fix the GROUP BY issue in create_complete_workout function
DROP FUNCTION IF EXISTS public.create_complete_workout(UUID, TEXT, TEXT, JSONB);

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

  -- Build result with full workout structure (fixed GROUP BY)
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
          SELECT COALESCE(jsonb_agg(day_obj ORDER BY day_obj->>'position'), '[]'::jsonb)
          FROM (
            SELECT jsonb_build_object(
              'id', wd.id,
              'dow', wd.dow,
              'position', wd.position,
              'groups', (
                SELECT COALESCE(jsonb_agg(group_obj ORDER BY group_obj->>'position'), '[]'::jsonb)
                FROM (
                  SELECT jsonb_build_object(
                    'id', wg.id,
                    'name', wg.name,
                    'group_type', wg.group_type,
                    'rest_seconds', wg.rest_seconds,
                    'position', wg.position,
                    'items_count', (
                      SELECT count(*)
                      FROM public.workout_items
                      WHERE workout_group_id = wg.id
                        AND deleted_at IS NULL
                    )
                  ) as group_obj
                  FROM public.workout_groups wg
                  WHERE wg.workout_day_id = wd.id
                    AND wg.deleted_at IS NULL
                ) groups_subq
              )
            ) as day_obj
            FROM public.workout_days wd
            WHERE wd.workout_id = w.id
              AND wd.deleted_at IS NULL
          ) days_subq
        )
      )
      FROM public.workouts w
      WHERE w.id = v_workout_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;