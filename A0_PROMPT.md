# UzoFit Mobile - React Native Fitness Tracker App

## 🎯 Project Overview

Build a **comprehensive workout tracking mobile application** for serious lifters using **React Native** and **Expo**. This app replicates the exact functionality of the existing web app with mobile-native enhancements.

### Core Purpose
Enable users to create complex workout programs, schedule training plans, track live workout sessions with rest timers, and review complete training history with progressive overload data.

---

## 📊 Complete Database Schema

### Database: Supabase (PostgreSQL with Row Level Security)

**Authentication:** Supabase Auth with auto-confirm enabled (any authenticated user can read/write all data)

### Tables & Relationships

#### 1. **exercises**
```sql
- id: UUID PRIMARY KEY (auto-generated)
- name: TEXT NOT NULL UNIQUE
- category: TEXT NOT NULL DEFAULT 'strength'
- instructions: TEXT (optional form cues)
- updated_at: TIMESTAMPTZ NOT NULL DEFAULT now()
- deleted_at: TIMESTAMPTZ (soft delete)
```

#### 2. **workouts** (workout programs/templates)
```sql
- id: UUID PRIMARY KEY
- name: TEXT NOT NULL
- summary: TEXT (optional description)
- updated_at: TIMESTAMPTZ NOT NULL DEFAULT now()
- deleted_at: TIMESTAMPTZ
```

#### 3. **workout_days**
```sql
- id: UUID PRIMARY KEY
- workout_id: UUID → workouts(id) ON DELETE CASCADE
- dow: ENUM('Mon','Tue','Wed','Thu','Fri','Sat','Sun') NOT NULL
- position: INT NOT NULL DEFAULT 1
- updated_at: TIMESTAMPTZ NOT NULL DEFAULT now()
- deleted_at: TIMESTAMPTZ
- UNIQUE(workout_id, dow)
```

#### 4. **workout_groups**
```sql
- id: UUID PRIMARY KEY
- workout_day_id: UUID → workout_days(id) ON DELETE CASCADE
- name: TEXT NOT NULL
- group_type: ENUM('single','superset','triset','circuit') NOT NULL
- rest_seconds: INT (rest after completing this group)
- position: INT NOT NULL
- updated_at: TIMESTAMPTZ NOT NULL DEFAULT now()
- deleted_at: TIMESTAMPTZ
```

**Group Types Explained:**
- `single`: Regular sets of one exercise
- `superset`: Two exercises performed back-to-back
- `triset`: Three exercises in sequence
- `circuit`: Multiple exercises in rotation

#### 5. **workout_items** (exercises within groups)
```sql
- id: UUID PRIMARY KEY
- workout_group_id: UUID → workout_groups(id) ON DELETE CASCADE
- exercise_id: UUID → exercises(id) NOT NULL
- position: INT NOT NULL
- target_sets: INT
- target_reps: INT
- target_weight: DOUBLE PRECISION
- rest_seconds_override: INT (overrides group rest for this exercise)
- notes: TEXT
- updated_at: TIMESTAMPTZ NOT NULL DEFAULT now()
- deleted_at: TIMESTAMPTZ
```

#### 6. **plans** (training schedules)
```sql
- id: UUID PRIMARY KEY
- name: TEXT NOT NULL
- workout_id: UUID → workouts(id) ON DELETE RESTRICT
- duration_weeks: INT NOT NULL CHECK(duration_weeks > 0)
- start_date: DATE NOT NULL DEFAULT CURRENT_DATE
- is_active: BOOLEAN NOT NULL DEFAULT true
- updated_at: TIMESTAMPTZ NOT NULL DEFAULT now()
- deleted_at: TIMESTAMPTZ
```

#### 7. **sessions** (completed workouts - IMMUTABLE)
```sql
- id: UUID PRIMARY KEY
- title: TEXT NOT NULL
- plan_id: UUID → plans(id) (optional)
- workout_id: UUID → workouts(id) NOT NULL
- day_dow: ENUM (day of week performed)
- started_at: TIMESTAMPTZ NOT NULL
- finished_at: TIMESTAMPTZ (null while active)
- total_volume: DOUBLE PRECISION (calculated: sum of reps × weight)
- updated_at: TIMESTAMPTZ NOT NULL DEFAULT now()
```

#### 8. **session_groups** (snapshot of workout groups)
```sql
- id: UUID PRIMARY KEY
- session_id: UUID → sessions(id) ON DELETE CASCADE
- name: TEXT NOT NULL
- group_type: ENUM('single','superset','triset','circuit') NOT NULL
- rest_seconds: INT
- position: INT NOT NULL
- updated_at: TIMESTAMPTZ NOT NULL DEFAULT now()
```

#### 9. **session_items** (snapshot of exercises)
```sql
- id: UUID PRIMARY KEY
- session_group_id: UUID → session_groups(id) ON DELETE CASCADE
- exercise_name: TEXT NOT NULL (denormalized for history)
- position: INT NOT NULL
- target_sets: INT
- target_reps: INT
- target_weight: DOUBLE PRECISION
- rest_seconds: INT
- notes: TEXT
- updated_at: TIMESTAMPTZ NOT NULL DEFAULT now()
```

#### 10. **completed_sets** (actual logged sets)
```sql
- id: UUID PRIMARY KEY
- session_item_id: UUID → session_items(id) ON DELETE CASCADE
- set_number: INT NOT NULL
- reps: INT NOT NULL
- weight: DOUBLE PRECISION NOT NULL
- created_at: TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at: TIMESTAMPTZ NOT NULL DEFAULT now()
```

### Key Database Patterns

1. **Soft Delete**: All workout-related tables use `deleted_at` - never hard delete to preserve history
2. **Cascade Deletes**: Days → Groups → Items cascade on delete
3. **Session Immutability**: Sessions snapshot workout structure at session start (denormalized)
4. **Position Fields**: All ordered collections use integer `position` for manual ordering

---

## 📱 Complete Screen Specifications

### Navigation Structure: Bottom Tab + Stack Navigation

**Bottom Tabs:**
1. Dashboard
2. Workouts
3. Plans
4. History
5. Settings

### 1. **Auth Screen**
- Email/password sign-up and login
- Supabase Auth integration
- Auto-redirect to Dashboard on successful auth
- Remember user session

### 2. **Dashboard Screen**
**Features:**
- Display active plan name and current week
- Show "Today's Workout" if there's a workout scheduled for current day
- "Start Workout" button → creates session and navigates to SessionActive
- Recent sessions list (last 5 with date, title, volume)
- Quick stats: total sessions, total volume this week
- If no active plan: prompt to create plan

### 3. **Workouts List Screen**
**Features:**
- List all workouts (where deleted_at is null)
- Search/filter by name
- Each workout card shows:
  - Workout name
  - Summary
  - Number of training days
  - Last updated date
- "Create Workout" FAB button
- Tap workout → WorkoutDetail
- Long press → Delete confirmation (soft delete)

### 4. **Workout Create Screen**
**Form Fields:**
- Workout name (required)
- Summary (optional, multiline)
- "Create Workout" button → saves and navigates to WorkoutDetail

### 5. **Workout Detail Screen** ⭐ COMPLEX
**Layout:**
- Header: Workout name, edit button, delete button
- Horizontal day tabs (Mon, Tue, Wed, etc.)
- "Add Day" button
- Content for selected day:

**Day Management:**
- Add day: Select from available days not yet added
- Delete day: Confirmation dialog, soft delete
- Each day shows list of groups

**Group Management:**
- "Add Group" button → Dialog with:
  - Group name (required)
  - Group type dropdown: Single/Superset/Triset/Circuit
  - Rest seconds (numeric input, default 90)
- Groups displayed as expandable cards showing:
  - Group name, type badge, rest time
  - List of exercises in group
  - Edit/Delete buttons
- Drag to reorder groups (update position field)

**Exercise Management within Groups:**
- "Add Exercise" button in each group
- Exercise selection dialog:
  - Search existing exercises
  - "Create New Exercise" option
  - Select exercise → Add to group form:
    - Target sets (numeric)
    - Target reps (numeric)
    - Target weight (numeric, decimal)
    - Rest override (optional, numeric)
    - Notes (optional, multiline)
- Exercise cards show: name, sets×reps@weight
- Drag to reorder exercises within group
- Edit/Delete buttons per exercise

**Exercise Library Management:**
- "Manage Exercises" button → Exercise list modal
- All exercises with search
- Create new exercise:
  - Name (required, unique)
  - Category (dropdown: strength/cardio/flexibility/other)
  - Instructions (optional, multiline)

### 6. **Plans List Screen**
**Features:**
- List all plans (where deleted_at is null)
- Filter: Active/Inactive toggle
- Each plan card shows:
  - Plan name
  - Workout name
  - Duration (weeks)
  - Start date → End date
  - Current week indicator
  - Active badge (green) or inactive (gray)
- "Create Plan" FAB
- Tap plan → PlanDetail
- Long press → Delete/Activate/Deactivate options

### 7. **Plan Create Screen**
**Form:**
- Plan name (required)
- Select workout (dropdown from workouts list)
- Duration in weeks (numeric input, min 1)
- Start date (date picker, default today)
- Is Active checkbox (default true)
- "Create Plan" button

### 8. **Plan Detail Screen**
**Content:**
- Plan info card (name, workout, duration, dates)
- Toggle active/inactive status
- Weekly calendar view showing:
  - All 7 days with workout days highlighted
  - Current week indicator
  - Completed sessions marked with checkmark
- "Start Today's Workout" button (if applicable)
- Edit/Delete buttons
- List of completed sessions for this plan

### 9. **Session Active Screen** ⭐ MOST CRITICAL
**This is the live workout tracking screen**

**Header:**
- Session title
- Elapsed time counter (started_at → now)
- "Finish Session" button

**Workout Structure Display:**
- Groups displayed in order with type badges
- Each group shows rest timer after completion

**Exercise Cards:**
- Exercise name, category
- Target: sets × reps @ weight
- Notes (if any)
- Set logging interface:
  - Set number buttons (1, 2, 3, etc. up to target_sets)
  - For each set:
    - Reps input (numeric)
    - Weight input (numeric)
    - "Log Set" button
  - Completed sets show: Set 1: 10 reps @ 135 lbs ✓
  - Progress indicator (sets completed / target sets)
- "Mark Complete" button when target sets reached

**Rest Timer:**
- Appears after completing a group
- Countdown timer (rest_seconds)
- Skip button
- Sound/haptic feedback when timer completes
- Visual progress ring

**Real-time Updates:**
- Refetch session data every 3 seconds
- Live total volume calculation displayed
- Auto-save all logged sets

**Finish Session:**
- Calculate final total volume (sum of all reps × weight)
- Update session.finished_at and session.total_volume
- Navigate to SessionDetail

### 10. **Session Detail Screen** (History View)
**Content:**
- Session info card:
  - Title, date, duration
  - Total volume (highlighted)
  - Plan name (if linked)
- Complete workout breakdown:
  - All groups with type badges
  - All exercises with targets
  - All logged sets with reps and weight
  - Visual comparison: target vs actual
- "Delete Session" button (hard delete since historical)

### 11. **History List Screen**
**Features:**
- List all sessions ordered by started_at DESC
- Filter by date range (date picker)
- Each session card shows:
  - Title
  - Date and time
  - Duration
  - Total volume
  - Number of exercises
- Tap session → SessionDetail
- Pull to refresh
- Infinite scroll for older sessions

### 12. **Import/Export Screen**
**Two Sections:**

**Export Section:**
- Dropdown to select workout
- "Export Workout" button
- Downloads/shares JSON file with exact format:

```json
{
  "name": "Workout Name",
  "summary": "Description",
  "workout_days": [
    {
      "dow": "Mon",
      "position": 1,
      "workout_groups": [
        {
          "name": "Group Name",
          "group_type": "single",
          "rest_seconds": 90,
          "position": 1,
          "workout_items": [
            {
              "position": 1,
              "target_sets": 3,
              "target_reps": 10,
              "target_weight": 135.0,
              "rest_seconds_override": null,
              "notes": "Optional notes",
              "exercises": {
                "name": "Exercise Name",
                "category": "strength",
                "instructions": "Form cues"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

**Import Section:**
- JSON text input (multiline)
- "Import Workout" button
- Import logic:
  1. Parse JSON
  2. Create new workout with "(Imported)" suffix
  3. For each day → create workout_day
  4. For each group → create workout_group
  5. For each item:
     - Check if exercise exists (by name)
     - If exists: use existing exercise_id
     - If not: create new exercise with provided data
     - Create workout_item with exercise_id
- Success: Navigate to imported workout detail
- Error: Show detailed error message

### 13. **Settings Screen**
**Options:**
- Account info (email, display name)
- Default rest time preference
- Weight unit (lbs/kg)
- Theme selection (light/dark/system)
- Export all data (complete JSON backup)
- Delete account (confirmation required)
- Logout button

---

## 🔄 Critical User Flows

### Flow 1: Create Complete Workout
1. Workouts → Create Workout
2. Enter name "Push Day" → Create
3. WorkoutDetail → Add Day "Mon"
4. Add Group → "Chest" / Single / 90s rest
5. Add Exercise → Search "Bench Press" → Select
6. Set targets: 4 sets × 8 reps @ 185 lbs → Save
7. Add Exercise → "Incline DB Press" → 3×10@70
8. Add Group → "Triceps" / Superset / 60s
9. Add Exercises: "Skull Crushers" + "Overhead Extension"
10. Result: Complete workout with 2 groups, 4 exercises

### Flow 2: Create Plan and Start Training
1. Plans → Create Plan
2. Name "October Hypertrophy", Select "Push Day", 8 weeks, Start today → Create
3. PlanDetail shows weekly calendar
4. Dashboard → "Start Today's Workout" button
5. Creates session, navigates to SessionActive
6. User logs sets for each exercise
7. Rest timer runs between groups
8. Finish Session → Volume calculated → History

### Flow 3: Track Live Session
1. SessionActive screen loads with workout structure
2. First exercise: Bench Press, Target 4×8@185
3. User performs set: 8 reps @ 185 lbs → Log Set
4. Set 1 marked complete, progress 1/4
5. Repeat for sets 2, 3, 4
6. Exercise marked complete
7. Move to next exercise
8. After completing group: Rest timer starts (90s countdown)
9. User can skip or wait
10. Proceed to next group
11. After all exercises: Finish Session
12. Total volume calculated: 8,420 lbs
13. Navigate to History with session saved

### Flow 4: Import Workout
1. ImportExport screen
2. User pastes JSON from friend
3. Click Import
4. System parses JSON:
   - Creates workout "Friend's Legs (Imported)"
   - Creates 2 days (Mon, Thu)
   - Creates 6 groups across both days
   - Finds existing exercises: Squat, Deadlift
   - Creates new exercises: Bulgarian Split Squat, Nordic Curls
   - Links all workout_items with correct exercise_ids
5. Success toast
6. Navigate to imported workout detail
7. User can now create plan with this workout

---

## 🛠️ Technical Stack Specifications

### Core Technologies
- **Framework:** React Native with Expo (managed workflow)
- **Language:** TypeScript (strict mode)
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Navigation:** React Navigation v6 (Bottom Tabs + Stack)
- **State Management:** TanStack Query (React Query) v5
- **Forms:** React Hook Form + Zod validation
- **UI Components:** React Native Paper or NativeBase (Material Design)

### Required Libraries
```json
{
  "@supabase/supabase-js": "^2.74.0",
  "@tanstack/react-query": "^5.83.0",
  "@react-navigation/native": "^6.x",
  "@react-navigation/bottom-tabs": "^6.x",
  "@react-navigation/stack": "^6.x",
  "react-hook-form": "^7.61.0",
  "zod": "^3.25.0",
  "date-fns": "^3.6.0",
  "expo": "~51.0.0",
  "expo-haptics": "*",
  "expo-notifications": "*",
  "expo-file-system": "*",
  "expo-sharing": "*",
  "react-native-paper": "^5.x"
}
```

### Mobile-Specific Features

#### 1. **Haptic Feedback**
- Set logged: Light impact
- Exercise completed: Medium impact
- Group completed: Heavy impact
- Timer complete: Notification feedback
- Error: Error feedback

#### 2. **Rest Timer Notifications**
- Background timer support
- Push notification when timer completes
- Sound alert
- Vibration pattern

#### 3. **Gesture Controls**
- Swipe left on set → Quick log (use target values)
- Swipe right on exercise → Mark complete
- Long press on group → Reorder mode
- Pull down on SessionActive → Refresh
- Pinch to zoom on history charts (future feature)

#### 4. **Offline Support**
- Queue mutations when offline
- Sync when connection restored
- Show offline indicator
- Cache recent workouts and plans

#### 5. **Native Features**
- Share workout JSON via native share sheet
- Import from clipboard (detect JSON)
- Export to files app
- Camera access for exercise form videos (future)

---

## ✅ Validation Rules & Business Logic

### Workout Validation
- Workout name: required, 1-100 characters
- Cannot delete workout if used by active plan
- Cannot have duplicate days in same workout
- Group must have 1-4 exercises based on type:
  - Single: 1 exercise
  - Superset: 2 exercises
  - Triset: 3 exercises
  - Circuit: 1-10 exercises

### Exercise Validation
- Exercise name: required, unique, 1-100 characters
- Target sets: 1-20
- Target reps: 1-100
- Target weight: 0-1000 lbs
- Rest seconds: 0-600 (0-10 minutes)

### Plan Validation
- Plan name: required, 1-100 characters
- Duration: 1-52 weeks
- Start date: any date (past or future allowed)
- Only one active plan allowed at a time
- Cannot delete plan if has associated sessions

### Session Validation
- Cannot start session if one already active (unfinished)
- Cannot edit session after finished_at is set
- Logged reps: 1-100
- Logged weight: 0-1000 lbs
- Set number must be sequential (1, 2, 3...)

### Import Validation
- JSON must parse successfully
- Required fields: name, workout_days array
- Each day must have valid dow enum
- Each group must have valid group_type enum
- Exercise names must be non-empty strings

---

## 🎨 UI/UX Guidelines

### Design System
- **Color Scheme:** Fitness theme with primary blue/teal, secondary orange
- **Typography:**
  - Headers: Bold, 24-32pt
  - Body: Regular, 14-16pt
  - Labels: Medium, 12pt
- **Spacing:** 8pt grid system (8, 16, 24, 32)
- **Cards:** Elevated with subtle shadow, rounded corners (12pt radius)
- **Buttons:**
  - Primary: Filled with primary color
  - Secondary: Outlined
  - Danger: Red for delete actions
  - FAB: Circular, bottom right, 56pt diameter

### Mobile Patterns
- Bottom tabs always visible (except SessionActive - full screen)
- Headers with back button on all stack screens
- Swipeable cards for list items
- Pull-to-refresh on all lists
- Loading states: Skeleton screens or spinners
- Empty states: Illustration + helpful message + CTA
- Error states: Clear message + retry button

### Accessibility
- All interactive elements minimum 44×44pt touch target
- Screen reader labels on all buttons/inputs
- High contrast mode support
- Font scaling support (respect system settings)
- Haptic feedback for all actions

---

## 🧪 Testing Checklist

### Core Workflows to Test
- [ ] Sign up new account
- [ ] Create workout with all 4 group types
- [ ] Add multiple days to workout
- [ ] Reorder groups and exercises
- [ ] Create exercise library
- [ ] Create plan from workout
- [ ] Activate/deactivate plans
- [ ] Start session from active plan
- [ ] Log sets during active session
- [ ] Complete session and verify volume calculation
- [ ] View session in history
- [ ] Export workout to JSON
- [ ] Import workout from JSON (with new exercises)
- [ ] Delete workout (verify soft delete)
- [ ] Delete plan (verify restriction if has sessions)

### Edge Cases to Verify
- [ ] Start session with no active plan (should work)
- [ ] Try to start second session while one active (should block)
- [ ] Import malformed JSON (should show error)
- [ ] Import workout with existing exercise names (should reuse)
- [ ] Navigate away during active session (should preserve state)
- [ ] Finish session with incomplete exercises (allowed)
- [ ] Log set with 0 reps (should validate min 1)
- [ ] Create workout with no days (allowed)
- [ ] Create plan in past date (allowed)
- [ ] Multiple concurrent rest timers (shouldn't happen)

### Performance Checks
- [ ] List 100+ workouts smoothly
- [ ] SessionActive with 20+ exercises
- [ ] History with 500+ sessions loads quickly
- [ ] Import large workout (10 days, 50 exercises)
- [ ] Offline mode queues mutations
- [ ] Session refetch every 3s doesn't lag UI

---

## 📝 Implementation Notes

### Supabase Setup
1. Create project on Supabase
2. Run migration SQL from schema section
3. Enable Row Level Security on all tables
4. Create policies: `auth_all_[table]` FOR ALL TO authenticated USING (true)
5. Enable realtime on sessions table (for live updates)
6. Configure Auth: Enable email provider, disable email confirmation

### Query Keys Structure
```typescript
export const queryKeys = {
  workouts: {
    all: ['workouts'] as const,
    one: (id: string) => ['workouts', id] as const,
  },
  exercises: {
    all: ['exercises'] as const,
  },
  plans: {
    all: ['plans'] as const,
    one: (id: string) => ['plans', id] as const,
    active: ['plans', 'active'] as const,
  },
  sessions: {
    all: ['sessions'] as const,
    one: (id: string) => ['sessions', id] as const,
    active: ['sessions', 'active'] as const,
  },
};
```

### Session Creation Logic
When "Start Workout" clicked:
1. Create session record (started_at = now, finished_at = null)
2. Fetch workout structure (days → groups → items)
3. For each group: Create session_group (snapshot)
4. For each item: Create session_item (snapshot with exercise name)
5. Navigate to SessionActive with session_id
6. Poll every 3s for completed_sets updates

### Volume Calculation
```typescript
const calculateTotalVolume = (session: Session): number => {
  let total = 0;
  session.session_groups.forEach(group => {
    group.session_items.forEach(item => {
      item.completed_sets.forEach(set => {
        total += set.reps * set.weight;
      });
    });
  });
  return total;
};
```

### Rest Timer Implementation
```typescript
// Use Expo Notifications for background support
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';

const useRestTimer = (seconds: number, onComplete: () => void) => {
  const [remaining, setRemaining] = useState(seconds);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!isActive || remaining <= 0) return;

    const interval = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          setIsActive(false);
          onComplete();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return 0;
        }
        return r - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, remaining]);

  return { remaining, isActive, start: () => setIsActive(true), skip: () => setIsActive(false) };
};
```

---

## 🚀 Build Instructions for a0.dev

**Primary Goal:** Create a pixel-perfect, fully functional mobile app that replicates all features of the web version.

**Key Requirements:**
1. ✅ Use exact database schema provided (PostgreSQL enums, cascade deletes, soft deletes)
2. ✅ Implement all 13 screens with specified features
3. ✅ Support all 4 user flows completely
4. ✅ Include mobile-native features (haptics, gestures, notifications)
5. ✅ Match JSON import/export format exactly
6. ✅ Implement real-time session tracking with 3s refetch
7. ✅ Add validation rules and business logic
8. ✅ Support offline-first with mutation queue
9. ✅ Include all edge case handling
10. ✅ Test against provided checklist

**Success Criteria:**
- A user can export a workout from the web app and import it seamlessly into the mobile app
- Active session tracking works smoothly with 20+ exercises
- Rest timers work in background with notifications
- All CRUD operations work offline and sync when online
- App feels native with proper gestures and haptic feedback

**Deliverables:**
1. Complete Expo/React Native app
2. Supabase project with schema applied
3. Working authentication flow
4. All screens implemented and navigable
5. Import/Export functionality tested with sample data
6. README with setup instructions

---

## 🎁 Seed Data (Include in Initial Setup)

### Exercises (15 common exercises)
1. Barbell Bench Press (strength)
2. Barbell Squat (strength)
3. Deadlift (strength)
4. Pull-ups (strength)
5. Barbell Row (strength)
6. Overhead Press (strength)
7. Incline Dumbbell Press (strength)
8. Romanian Deadlift (strength)
9. Leg Press (strength)
10. Lat Pulldown (strength)
11. Dumbbell Curl (strength)
12. Tricep Dips (strength)
13. Face Pulls (strength)
14. Running (cardio)
15. Plank (core)

### Sample Workout: "Push Pull Legs"
- **Monday (Push):** Bench Press 4×8, Incline DB Press 3×10, Overhead Press 3×8, Tricep Dips 3×12
- **Wednesday (Pull):** Deadlift 4×5, Barbell Row 4×8, Pull-ups 3×10, Face Pulls 3×15
- **Friday (Legs):** Squat 4×8, Romanian Deadlift 3×10, Leg Press 3×12

This gives users a complete working example immediately after signup.

---

## 🔗 Additional Resources

- **Supabase Docs:** https://supabase.com/docs
- **React Navigation:** https://reactnavigation.org/
- **TanStack Query:** https://tanstack.com/query/latest
- **Expo Notifications:** https://docs.expo.dev/versions/latest/sdk/notifications/
- **React Native Paper:** https://callstack.github.io/react-native-paper/

---

**IMPORTANT: This specification is comprehensive and production-ready. Follow it exactly to ensure feature parity with the web version while adding mobile-native enhancements that make the app feel native and performant.**
