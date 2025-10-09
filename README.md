# UzoFit - Smart Workout Tracker

A comprehensive workout tracking application built for serious lifters who want to organize their training programs, track progress, and achieve their fitness goals.

## 🏋️ Features

### 📋 Workout Builder
- Create custom workout programs with multiple training days
- Organize exercises into groups (single sets, supersets, trisets, circuits)
- Set target sets, reps, and weights for each exercise
- Add rest timers between groups
- Manage your exercise library with custom exercises
- Soft delete protection - never lose your workout history

### 📅 Training Plans
- Create structured training plans based on your workouts
- Set plan duration (weeks) and start dates
- Activate/deactivate plans as needed
- View your weekly training schedule at a glance
- Track which days you've completed

### 💪 Active Session Tracking
- Start today's workout with one click from your active plan
- Follow your workout structure with live rest timers
- Log each set with actual reps and weight used
- Real-time total volume calculation
- Mark exercises as complete as you progress
- Finish sessions with complete workout summary

### 📊 Training History
- View all completed training sessions
- Detailed session breakdowns with all logged sets
- Track total volume per session
- Review exercise performance over time
- Filter by date and workout type

### 🔄 Import/Export
- Export entire workout programs as JSON files
- Share workouts with training partners
- Backup your programs
- Import workouts from JSON
- Automatically handles exercise creation during import

### 🎨 Exercise Management
- Built-in exercise library with 15+ common exercises
- Add custom exercises with instructions
- Categorize exercises (strength, cardio, etc.)
- Search and filter exercises
- Track exercise usage across workouts

## 🚀 Getting Started

### First Time Setup
1. **Sign Up** - Create your account on the Auth page
2. **Browse Exercises** - Check the exercise library in Workouts
3. **Create a Workout** - Build your first training program
4. **Make a Plan** - Set up a training plan with your workout
5. **Start Training** - Begin your first session!

## 📖 How to Use

### Creating Your First Workout

1. Navigate to **Workouts** page
2. Click **Create Workout**
3. Enter workout name and summary
4. Add training days (e.g., Monday, Wednesday, Friday)
5. For each day, add exercise groups:
   - **Single**: Regular sets of one exercise
   - **Superset**: Two exercises back-to-back
   - **Triset**: Three exercises in sequence
   - **Circuit**: Multiple exercises in rotation
6. Add exercises to each group with targets (sets/reps/weight)
7. Set rest periods between groups
8. Save your workout

### Setting Up a Training Plan

1. Go to **Plans** page
2. Click **Create Plan**
3. Select your workout
4. Choose plan duration (4-16+ weeks recommended)
5. Set start date (defaults to today)
6. Mark as active to begin training
7. View your training schedule

### Running a Training Session

1. From **Dashboard** or **Plan Detail**, click **Start Today's Workout**
2. Follow the workout structure:
   - Complete exercises in order
   - Log each set (reps and weight)
   - Use rest timers between groups
   - Mark exercises complete when done
3. Review your total volume
4. Click **Finish Session** when complete
5. Session automatically saves to History

### Tracking Your Progress

- **Dashboard**: Quick view of active plan and recent sessions
- **History**: Browse all completed sessions
- **Session Detail**: Review exact sets, reps, and weights from past workouts
- **Workouts**: Adjust programs based on progress

### Managing Exercises

1. Go to **Workouts** → **Workout Detail**
2. Click **Manage Exercises** in any group
3. Select from existing exercises or create new ones
4. Add exercise details:
   - Name (e.g., "Bench Press")
   - Category (strength, cardio, flexibility)
   - Instructions (optional form cues)
5. Use exercises across multiple workouts

### Import/Export Workouts

**Export:**
1. Go to **Import/Export** page
2. Select workout to export
3. Click **Export Workout**
4. JSON file downloads automatically

**Import:**
1. Go to **Import/Export** page
2. Paste JSON content in text area
3. Click **Import Workout**
4. Workout appears in your library (with " (Imported)" suffix)

## 🛠️ Technical Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI Components**: shadcn/ui, Radix UI
- **Styling**: Tailwind CSS with custom fitness theme
- **Backend**: Lovable Cloud (Supabase)
- **Database**: PostgreSQL with Row Level Security
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v6
- **Form Validation**: React Hook Form + Zod
- **Authentication**: Supabase Auth with auto-confirm

## 💾 Database Schema

- **workouts**: Base workout programs
- **workout_days**: Training days within workouts
- **workout_groups**: Exercise groupings (single/superset/etc)
- **workout_items**: Individual exercises with targets
- **exercises**: Exercise library
- **plans**: Training plan schedules
- **sessions**: Completed training sessions
- **session_groups**: Session exercise groupings
- **session_items**: Session exercises
- **completed_sets**: Logged set data (reps/weight)

## 🎯 Best Practices

1. **Start Simple**: Begin with basic workouts before complex programs
2. **Be Consistent**: Log every set for accurate progress tracking
3. **Use Plans**: Structure your training with 4-12 week plans
4. **Rest Days**: Schedule rest days by skipping days in workout structure
5. **Progressive Overload**: Review history to gradually increase weights
6. **Export Regularly**: Backup your favorite programs
7. **Customize**: Adjust rest times and targets based on your needs

## 🔧 Development

### Prerequisites
- Node.js & npm installed ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))

### Setup
```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to directory
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm i

# Start development server
npm run dev
```

### Project Structure
```
src/
├── components/       # Reusable UI components
├── hooks/           # Custom React hooks (auth, etc.)
├── integrations/    # Supabase client & types
├── lib/             # Utilities, types, query keys
└── pages/           # Route components
```

## 🌐 Deployment

Simply open [Lovable](https://lovable.dev/projects/f50b80ac-d251-4194-b4fc-82bfd947634c) and click **Share → Publish**.

## 🔗 Custom Domain

Navigate to **Project > Settings > Domains** and click **Connect Domain**.

[Learn more about custom domains](https://docs.lovable.dev/features/custom-domain#custom-domain)

## 📄 License

Built with [Lovable](https://lovable.dev)
