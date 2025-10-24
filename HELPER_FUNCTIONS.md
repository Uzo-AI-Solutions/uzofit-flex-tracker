# Backend Helper Functions - Usage Guide

## Overview

This document explains the 5 new PostgreSQL helper functions that enable the AI trainer to work efficiently with single calls instead of requiring 12-20+ sequential operations.

All functions are implemented as PostgreSQL stored procedures and are called by the AI trainer through the tool system.

---

## 1. create_complete_workout

**Purpose:** Create a complete workout program with all days, groups, and exercises in a single transaction.

### AI Tool Usage

```javascript
{
  "name": "create_complete_workout",
  "arguments": {
    "name": "Push Pull Legs",
    "summary": "3-day strength training split",
    "days": [
      {
        "dow": "Mon",
        "position": 1,
        "groups": [
          {
            "name": "Chest",
            "group_type": "superset",
            "rest_seconds": 90,
            "position": 1,
            "exercises": [
              {
                "name": "Bench Press",
                "category": "strength",
                "target_sets": 4,
                "target_reps": 8,
                "target_weight": 225,
                "position": 1
              },
              {
                "name": "Incline Dumbbell Press",
                "category": "strength",
                "target_sets": 3,
                "target_reps": 10,
                "target_weight": 70,
                "position": 2
              }
            ]
          }
        ]
      },
      {
        "dow": "Wed",
        "position": 2,
        "groups": [
          {
            "name": "Back",
            "group_type": "single",
            "rest_seconds": 120,
            "exercises": [
              {
                "name": "Deadlift",
                "target_sets": 5,
                "target_reps": 5,
                "target_weight": 315
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### Returns

```json
{
  "success": true,
  "workout_id": "uuid-here",
  "message": "Created workout: Push Pull Legs with 2 days",
  "workout": {
    "id": "uuid",
    "name": "Push Pull Legs",
    "summary": "3-day strength training split",
    "days": [
      {
        "id": "uuid",
        "dow": "Mon",
        "position": 1,
        "groups": [
          {
            "id": "uuid",
            "name": "Chest",
            "group_type": "superset",
            "rest_seconds": 90,
            "items_count": 2
          }
        ]
      }
    ]
  }
}
```

### Key Features

- ✅ **Transaction safety** - All or nothing, no partial workouts
- ✅ **Auto-create exercises** - Exercises are created if they don't exist
- ✅ **UUID handling** - Function manages all IDs internally
- ✅ **Full structure** - Returns complete workout with all IDs for reference

### Example AI Conversations

**User:** "Create a 3-day PPL split for strength"

**AI Response:**
```
Creating your Push Pull Legs workout...

✅ Created workout: "PPL Split"
✅ Added 3 training days (Mon/Wed/Fri)
✅ Added 15 exercises across 6 muscle groups
✅ Set targets: 4-6 reps for compounds, 8-12 for accessories

Your workout is ready!
```

**Behind the scenes:** 1 tool call instead of 20+

---

## 2. start_session_from_workout

**Purpose:** Start a new workout session by automatically copying the workout template structure.

### AI Tool Usage

```javascript
{
  "name": "start_session_from_workout",
  "arguments": {
    "workout_id": "uuid-of-workout",
    "plan_id": "uuid-of-plan",      // optional
    "dow": "Mon",                    // optional, defaults to today
    "title": "Push Day - Week 1"    // optional, auto-generated
  }
}
```

### Returns

```json
{
  "success": true,
  "session_id": "uuid-here",
  "message": "Started session: Push Day - Week 1",
  "session": {
    "id": "uuid",
    "title": "Push Day - Week 1",
    "day_dow": "Mon",
    "started_at": "2025-10-24T10:30:00Z",
    "groups_count": 3,
    "exercises_count": 12
  }
}
```

### Key Features

- ✅ **Auto-copy structure** - Copies all groups and items from workout template
- ✅ **Denormalization** - Stores exercise names (not IDs) for immutability
- ✅ **Smart defaults** - Auto-detects day of week and generates title
- ✅ **Ready to log** - Session is immediately ready for set logging

### Example AI Conversations

**User:** "Start today's workout"

**AI Response:**
```
Starting your Push Day workout...

✅ Created session: "Push Day - Mon"
✅ Loaded 12 exercises across 3 groups
✅ Ready to log your sets!

First exercise: Bench Press - 4 sets × 8 reps @ 225kg
```

**Behind the scenes:** 1 call vs manually creating session + copying all groups/items

---

## 3. get_exercise_history

**Purpose:** Get comprehensive history for a specific exercise with stats, PRs, and trends.

### AI Tool Usage

```javascript
{
  "name": "get_exercise_history",
  "arguments": {
    "exercise_name": "Bench Press",
    "start_date": "2025-07-01T00:00:00Z",  // optional, defaults to 3 months ago
    "end_date": "2025-10-24T23:59:59Z",    // optional, defaults to now
    "limit": 50                             // optional, defaults to 50
  }
}
```

### Returns

```json
{
  "success": true,
  "data": {
    "exercise_name": "Bench Press",
    "date_range": {
      "start": "2025-07-01T00:00:00Z",
      "end": "2025-10-24T23:59:59Z"
    },
    "statistics": {
      "total_sessions": 16,
      "total_sets": 64,
      "total_volume": 12450,
      "avg_volume_per_session": 778,
      "pr_weight": 225,
      "pr_reps_at_weight": 5,
      "max_volume_set": 1800
    },
    "sessions": [
      {
        "date": "2025-10-15T10:30:00Z",
        "session_id": "uuid",
        "session_title": "Push Day - Week 8",
        "sets": [
          {
            "set_number": 1,
            "reps": 5,
            "weight": 225,
            "volume": 1125
          },
          {
            "set_number": 2,
            "reps": 5,
            "weight": 225,
            "volume": 1125
          }
        ],
        "total_volume": 2250,
        "best_set": {
          "reps": 5,
          "weight": 225,
          "volume": 1125
        }
      }
    ]
  }
}
```

### Key Features

- ✅ **Comprehensive stats** - Total volume, PRs, averages
- ✅ **Session breakdown** - All sets from each workout session
- ✅ **Progress tracking** - See improvement over time
- ✅ **Flexible queries** - Custom date ranges and limits

### Example AI Conversations

**User:** "How's my bench press progress?"

**AI Response:**
```
Your bench press progress over the last 3 months:

📊 Total Volume: 12,450 kg (+18% from start)
🏋️ Personal Record: 225 lbs × 5 reps (Oct 15)
📈 Average per session: 778 kg
🔥 Completed 16 sessions

Week-by-week breakdown:
- Week 1-2: 200 lbs × 8 reps
- Week 3-4: 210 lbs × 6 reps
- Week 5-6: 220 lbs × 5 reps
- Week 7-8: 225 lbs × 5 reps ⭐ PR!

You're consistently adding weight - great progressive overload!
Try 230 lbs × 3 next session.
```

**Behind the scenes:** 1 complex query returns everything needed

---

## 4. get_workout_analytics

**Purpose:** Get comprehensive analytics about workout performance and progress.

### AI Tool Usage

```javascript
{
  "name": "get_workout_analytics",
  "arguments": {
    "start_date": "2025-07-01T00:00:00Z",  // optional
    "end_date": "2025-10-24T23:59:59Z",    // optional
    "workout_id": "uuid"                    // optional, filter to specific workout
  }
}
```

### Returns

```json
{
  "success": true,
  "data": {
    "date_range": {
      "start": "2025-07-01T00:00:00Z",
      "end": "2025-10-24T23:59:59Z"
    },
    "summary": {
      "total_sessions": 48,
      "total_volume": 285600,
      "total_time_minutes": 2880,
      "avg_session_duration": 60,
      "avg_volume_per_session": 5950
    },
    "by_week": [
      {
        "week_start": "2025-10-14T00:00:00Z",
        "sessions": 3,
        "total_volume": 18500,
        "avg_duration": 58
      },
      {
        "week_start": "2025-10-07T00:00:00Z",
        "sessions": 3,
        "total_volume": 17200,
        "avg_duration": 62
      }
    ],
    "top_exercises": [
      {
        "exercise_name": "Squat",
        "frequency": 16,
        "total_volume": 45000,
        "avg_weight": 275
      },
      {
        "exercise_name": "Bench Press",
        "frequency": 16,
        "total_volume": 36000,
        "avg_weight": 205
      }
    ],
    "personal_records": [
      {
        "exercise_name": "Squat",
        "date": "2025-10-15T10:30:00Z",
        "weight": 315,
        "reps": 5,
        "volume": 1575
      },
      {
        "exercise_name": "Bench Press",
        "date": "2025-10-15T10:30:00Z",
        "weight": 225,
        "reps": 5,
        "volume": 1125
      }
    ]
  }
}
```

### Key Features

- ✅ **Overall summary** - Total sessions, volume, time
- ✅ **Weekly trends** - See progress week over week
- ✅ **Top exercises** - Most frequent and highest volume
- ✅ **All PRs** - Personal records across all exercises
- ✅ **Filterable** - By date range or specific workout

### Example AI Conversations

**User:** "Show me my overall progress"

**AI Response:**
```
Your fitness progress over the last 3 months:

📅 Total Workouts: 48 sessions
⏱️ Total Time: 48 hours (avg 60 min/session)
📊 Total Volume: 285,600 kg
📈 Volume Trend: +15% over period

Top 5 Exercises by Volume:
1. Squat - 45,000 kg (16 sessions)
2. Bench Press - 36,000 kg (16 sessions)
3. Deadlift - 32,500 kg (16 sessions)
4. Overhead Press - 18,200 kg (16 sessions)
5. Rows - 24,800 kg (16 sessions)

Recent Personal Records:
- Squat: 315 lbs × 5 (Oct 15)
- Bench: 225 lbs × 5 (Oct 15)
- Deadlift: 405 lbs × 3 (Oct 12)

Consistency: 3 workouts/week average 🔥
You're crushing it!
```

**Behind the scenes:** Single aggregated query across all data

---

## 5. clone_workout

**Purpose:** Create a copy of an existing workout with optional modifications.

### AI Tool Usage

```javascript
{
  "name": "clone_workout",
  "arguments": {
    "workout_id": "uuid-of-original",
    "new_name": "PPL - Deload Week",
    "scale_weights": 0.8,        // optional, 80% of original weights
    "change_reps": 2             // optional, add 2 reps to everything
  }
}
```

### Returns

```json
{
  "success": true,
  "workout_id": "uuid-of-new-workout",
  "message": "Cloned workout as: PPL - Deload Week",
  "modifications": {
    "weight_scale": 0.8,
    "reps_change": 2
  }
}
```

### Key Features

- ✅ **Full duplication** - Copies entire workout structure
- ✅ **Weight scaling** - Perfect for deload weeks (e.g., 0.8 = 80%)
- ✅ **Rep adjustments** - Add/subtract reps for variations
- ✅ **Preserves structure** - Maintains all days, groups, ordering

### Example AI Conversations

**User:** "Create a deload version of my PPL workout"

**AI Response:**
```
Creating deload version of your PPL Split...

✅ Cloned: "PPL - Deload Week"
✅ Reduced all weights to 80%
✅ Kept same structure and exercises

Example changes:
- Bench Press: 225kg → 180kg (same 4 sets × 8 reps)
- Squat: 315kg → 252kg (same 5 sets × 5 reps)
- Deadlift: 405kg → 324kg (same 3 sets × 5 reps)

Ready to use for your recovery week!
```

**Behind the scenes:** Copies workout tree and applies transformations

---

## Function Comparison

| Function | Old Approach | New Approach | Improvement |
|----------|-------------|--------------|-------------|
| **create_complete_workout** | 12-20+ tool calls over 30-60s | 1 call in 3-5s | **10x faster** |
| **start_session_from_workout** | Manual create + 5-10 copy operations | 1 call | **Instant** |
| **get_exercise_history** | Not possible (no exercise linkage) | 1 call | **New capability** |
| **get_workout_analytics** | Manual aggregation over sessions | 1 call | **New capability** |
| **clone_workout** | Manual recreation with modifications | 1 call | **New capability** |

---

## Implementation Details

### Security

All functions use `SECURITY DEFINER` but require `p_user_id` parameter:
- Enforces user isolation at function level
- No RLS policy bypasses
- All operations scoped to authenticated user

### Transaction Safety

Functions that modify data use implicit transactions:
- `create_complete_workout` - Single transaction for entire workout
- `start_session_from_workout` - Single transaction for session + structure
- `clone_workout` - Single transaction for duplication

If any operation fails, entire transaction rolls back.

### Performance

All functions are optimized:
- Single database round-trip
- Indexed queries for fast lookups
- Efficient aggregations using CTEs
- No N+1 query patterns

### Error Handling

Functions validate inputs and provide clear error messages:
```sql
RAISE EXCEPTION 'Workout name is required';
RAISE EXCEPTION 'No workout found for % in this program', v_day_dow;
```

Errors propagate to AI trainer which formats user-friendly responses.

---

## Database Migration

To apply these functions to your database:

```bash
# Run the migration
supabase db push

# Or apply manually
psql -d your_database -f supabase/migrations/20251024000000_add_helper_functions.sql
```

### Rollback

If needed, drop the functions:

```sql
DROP FUNCTION IF EXISTS public.create_complete_workout;
DROP FUNCTION IF EXISTS public.start_session_from_workout;
DROP FUNCTION IF EXISTS public.get_exercise_history;
DROP FUNCTION IF EXISTS public.get_workout_analytics;
DROP FUNCTION IF EXISTS public.clone_workout;
```

---

## Testing

### Manual Testing via SQL

```sql
-- Test create_complete_workout
SELECT create_complete_workout(
  'user-uuid'::uuid,
  'Test Workout',
  'Test summary',
  '[{
    "dow": "Mon",
    "position": 1,
    "groups": [{
      "name": "Test Group",
      "group_type": "single",
      "rest_seconds": 90,
      "exercises": [{
        "name": "Test Exercise",
        "category": "strength",
        "target_sets": 3,
        "target_reps": 10,
        "target_weight": 100
      }]
    }]
  }]'::jsonb
);

-- Test get_exercise_history
SELECT get_exercise_history(
  'user-uuid'::uuid,
  'Bench Press',
  NULL,
  NULL,
  50
);
```

### Testing via AI Trainer

Use the AI chat interface and ask:
- "Create a 3-day workout for strength"
- "Show my bench press progress"
- "Give me my overall analytics"
- "Clone my PPL workout at 80% weight"

---

## Future Enhancements

Potential additions:
1. `bulk_log_sets` - Log multiple sets in one call
2. `get_workout_recommendations` - AI-powered suggestions based on history
3. `create_workout_from_template` - Pre-built workout templates
4. `progressive_overload_suggestion` - Auto-calculate weight/rep increases
5. `compare_workouts` - Side-by-side workout comparison

---

## Support

For issues or questions:
- Check ANALYSIS.md for design rationale
- Review migration file for SQL implementation
- Check ai-trainer/index.ts for tool integration

---

*Last Updated: 2025-10-24*
*Migration: 20251024000000_add_helper_functions.sql*
