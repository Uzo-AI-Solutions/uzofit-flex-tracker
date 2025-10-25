# UzoFit - AI-Powered Smart Workout Tracker

A comprehensive workout tracking application with **AI personal trainer** built for serious lifters who want to organize their training programs, track progress, and achieve their fitness goals through intelligent assistance.

## ✨ What Makes UzoFit Special

- **🤖 AI Personal Trainer**: Create complete workouts, analyze progress, and get personalized recommendations through natural conversation
- **📊 Advanced Analytics**: Deep insights into your training history with exercise-specific metrics and personal records
- **💪 Complete Workout Management**: Build structured programs with supersets, trisets, and circuits
- **📱 Real-Time Session Tracking**: Log your workouts set-by-set with live volume calculations
- **🔒 Privacy-First**: Your data is completely isolated with Row Level Security - nobody else can see it
- **📤 Share & Backup**: Export/import workouts as JSON to share with training partners or backup your programs

## 🏋️ Features

### 🤖 AI Personal Trainer (Powered by Claude)
**Your intelligent training companion that understands your fitness journey**

- **Natural Language Workout Creation**: Describe your ideal workout in plain English, and the AI creates complete programs with proper exercise groupings, sets, reps, and rest periods
- **Conversational Training Assistant**: Chat with your AI trainer to get workout advice, ask questions about form, and receive personalized recommendations
- **Smart Analytics & Progress Insights**: Ask questions like "What's my bench press progress?" or "How's my volume trending?" and get detailed answers based on your complete training history
- **14 Specialized AI Tools** including:
  - Complete workout creation from descriptions
  - Exercise history analysis with personal records
  - Workout analytics and performance trends
  - Session management and logging assistance
  - Workout cloning with modifications (deload weeks, progressive overload)
  - Exercise library management
  - Training plan recommendations
- **Personalized Training Style**: Customize AI behavior with your preferences, goals, and training philosophy in Settings
- **Real-Time Session Support**: Get guidance during active workouts, log sets via conversation, and receive form tips
- **Smart Recommendations**: AI analyzes your history to suggest volume progressions, exercise variations, and recovery strategies

Location: **Trainer** page

---

### 📋 Workout Builder
- Create custom workout programs with multiple training days (Monday-Sunday)
- Organize exercises into groups:
  - **Single**: Standard sets of one exercise
  - **Superset**: Two exercises back-to-back
  - **Triset**: Three exercises in sequence
  - **Circuit**: Multiple exercises in rotation
- Set target sets, reps, and weights for each exercise
- Configure rest timers between groups and per-exercise overrides
- Add exercise-specific notes and form cues
- Manage your exercise library with custom exercises
- Exercise categories: strength, cardio, flexibility, balance
- Soft delete protection - never lose your workout history
- Position-based ordering for precise workout structure

### 📅 Training Plans & Scheduling
- Create structured training plans based on your workouts
- Set plan duration in weeks and start dates
- Activate/deactivate plans (only one active at a time)
- View your weekly training schedule at a glance
- Visual 7-day week view with scheduled workout indicators
- Quick session start - launch today's workout with one click
- Auto-detects day of week for proper workout selection
- Track which days you've completed

### 💪 Active Session Tracking
- Start today's workout with one click from your active plan
- Real-time workout logging interface
- Log each set with actual reps and weight used
- Set-by-set completion tracking (shows completed/target sets)
- Real-time total volume calculation (reps × weight × all sets)
- Session duration timer
- Mark exercises as complete as you progress
- Finish sessions with complete workout summary
- Automatic session save to history with timestamp

### 📊 Training History & Analytics
**View & Analyze Your Progress**
- View all completed training sessions in reverse chronological order
- Detailed session breakdowns with all logged sets
- Track total volume and duration per session
- Review exercise performance over time
- Per-set volume calculations
- Date and time information for every session

**Advanced Analytics (via AI or Backend Functions)**
- Exercise-specific history with personal records
- Volume trends over custom date ranges
- Weekly performance breakdowns
- Top 10 most-trained exercises
- Average session duration and volume
- 1RM estimates and max weight achievements
- Total sets and reps by exercise
- Session-by-session performance comparisons

### 🔄 Import/Export
- Export entire workout programs as structured JSON files
- Share workouts with training partners or across devices
- Backup your programs securely
- Import workouts from JSON with full validation
- Automatic exercise creation during import (or reuse existing)
- Preserves complete workout structure: days, groups, items, targets
- Imported workouts marked with "(Imported)" suffix

### 🎨 Exercise Management
- Built-in exercise library with 15+ common exercises
- Add unlimited custom exercises with detailed instructions
- Categorize exercises: strength, cardio, flexibility, balance
- Form cues and technique notes per exercise
- Reuse exercises across multiple workouts
- Track exercise usage across your programs
- Create exercises on-the-fly during workout building
- Manage exercise library via AI trainer

### ⚙️ Settings & Personalization
- **AI Trainer Custom Instructions**: Define your training preferences, goals, and style
- Customize how the AI trainer interacts with you
- Store detailed preferences in your user profile
- Examples: preferred rep ranges, exercise restrictions, training philosophy
- Persistent across all AI conversations

### 🔒 Security & Data Privacy
- Row Level Security (RLS) on all database tables
- User-specific data isolation - you only see your own data
- Automatic user_id assignment on all records
- Secure authentication with Supabase Auth
- No cross-user data access
- Protected routes requiring authentication

## 🚀 Getting Started

### First Time Setup
1. **Sign Up** - Create your account on the Auth page
2. **Try the AI Trainer** - Visit the Trainer page and ask it to create a workout for you (e.g., "Create me a 3-day push/pull/legs program")
3. **Browse Exercises** - Check the exercise library in Workouts
4. **Create a Workout** - Build your first training program (manually or via AI)
5. **Make a Plan** - Set up a training plan with your workout
6. **Personalize Your AI** - Go to Settings to add custom instructions for your AI trainer
7. **Start Training** - Begin your first session!

## 📖 How to Use

### Using the AI Personal Trainer

The AI Trainer is the fastest way to get started and manage your fitness journey through natural conversation.

**Creating Workouts with AI:**
1. Go to **Trainer** page
2. Describe what you want: "Create a 4-day upper/lower split with compound movements"
3. AI generates the complete workout with proper structure
4. Review and start using it immediately

**Getting Analytics:**
- "What's my bench press progress over the last 3 months?"
- "Show me my total volume trends"
- "What are my personal records?"
- AI provides detailed analytics based on your complete history

**Workout Modifications:**
- "Clone my Upper Body workout but reduce all weights by 20% for a deload week"
- "Create a variation of my PPL program with more volume"
- AI creates modified versions instantly

**Session Management:**
- "Start a session from my Push Day workout"
- "Log 225lbs for 5 reps on bench press"
- AI helps you track workouts through conversation

**Personalizing Your AI:**
1. Go to **Settings**
2. Add custom instructions like:
   - "I prefer high volume training (4-5 sets per exercise)"
   - "I have a shoulder injury, avoid overhead pressing"
   - "My goal is powerlifting, focus on big compound lifts"
3. AI incorporates your preferences into all responses

**Pro Tips:**
- Be specific in your requests for better results
- Ask follow-up questions to refine workouts
- Use AI to explain exercise techniques and form
- Request workout recommendations based on your history

---

### Creating Your First Workout (Manual Method)

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

**JSON Format Structure:**

The JSON must follow this exact structure. Required fields are marked with `*`:

```json
{
  "name": "Your Workout Name*",
  "summary": "Workout description (optional)",
  "workout_days": [
    {
      "dow": "Mon|Tue|Wed|Thu|Fri|Sat|Sun*",
      "position": 1,
      "workout_groups": [
        {
          "name": "Group Name*",
          "group_type": "single|superset|triset|circuit*",
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
                "name": "Exercise Name*",
                "category": "strength*",
                "instructions": "Form cues (optional)"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

**Field Definitions:**
- `name`: Workout program name (text)
- `summary`: Brief workout description (text, optional)
- `dow`: Day of week (enum: Mon, Tue, Wed, Thu, Fri, Sat, Sun)
- `position`: Order of items (integer, starts at 1)
- `group_type`: Exercise grouping (enum: single, superset, triset, circuit)
- `rest_seconds`: Rest time between groups (integer, seconds)
- `target_sets`: Target number of sets (integer)
- `target_reps`: Target repetitions (integer)
- `target_weight`: Target weight in lbs (decimal number)
- `rest_seconds_override`: Custom rest for specific exercise (integer, optional)
- `notes`: Exercise-specific notes (text, optional)
- `category`: Exercise type (text, default: "strength")
- `instructions`: Form cues and technique notes (text, optional)

**Import Notes:**
- The importer automatically creates exercises if they don't exist
- Existing exercises (matched by name) will be reused
- All UUID fields (id, workout_id, etc.) are auto-generated - don't include them
- Timestamp fields (created_at, updated_at) are auto-generated - don't include them
- The workout name will have " (Imported)" appended automatically

## 🛠️ Technical Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Components**: shadcn/ui, Radix UI primitives
- **Styling**: Tailwind CSS with custom fitness theme and gradients
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: React Router v6 with protected routes
- **Form Validation**: React Hook Form + Zod schemas

### Backend & Database
- **Platform**: Lovable Cloud (Supabase)
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Authentication**: Supabase Auth with auto-confirm signup
- **Edge Functions**: Deno-based serverless functions
- **Real-time**: TanStack Query for data synchronization

### AI & Intelligence
- **AI Model**: Claude (Anthropic) via Supabase Edge Function
- **AI Integration**: Custom tool-based system with 14 specialized tools
- **Capabilities**:
  - Natural language workout creation
  - Conversational analytics and insights
  - Exercise history analysis
  - Personalized recommendations
  - Real-time training assistance
- **Function**: `ai-trainer` edge function (`/home/user/uzofit-flex-tracker/supabase/functions/ai-trainer/index.ts`)

### Database Functions & Optimization
- **Helper Functions**: PostgreSQL functions for complex operations
  - `create_complete_workout()` - Bulk workout creation
  - `start_session_from_workout()` - Session initialization
  - `get_exercise_history()` - Exercise analytics
  - `get_workout_analytics()` - Performance metrics
- **Benefits**: Reduced API calls, atomic transactions, efficient queries

## 💾 Database Schema

### Core Workout Management
- **workouts**: Base workout program templates with name, summary, and soft delete support
- **workout_days**: Training days within workouts (Mon-Sun) with positioning
- **workout_groups**: Exercise groupings (single/superset/triset/circuit) with rest periods
- **workout_items**: Individual exercises with targets (sets/reps/weight) and notes
- **exercises**: Global exercise library with categories and instructions

### Training Plans & Sessions
- **plans**: Training plan schedules with duration, start dates, and active status
- **sessions**: Completed training sessions with duration and total volume
- **session_groups**: Session-specific exercise groupings (copied from workout template)
- **session_items**: Session-specific exercises (copied from workout template)
- **completed_sets**: Individual set logs with actual reps, weight, and timestamps

### User Management
- **user_settings**: User preferences and AI trainer custom instructions

**Key Features:**
- All tables protected by Row Level Security (RLS)
- Automatic `user_id` filtering for data isolation
- Soft deletes on workouts preserve historical data
- Foreign key relationships maintain data integrity

## 🎯 Best Practices

### Getting Started
1. **Start with AI**: Let the AI trainer create your first workout by describing your goals
2. **Personalize Early**: Add custom instructions in Settings so the AI understands your preferences
3. **Start Simple**: Begin with basic workouts before complex programs

### Training & Logging
4. **Be Consistent**: Log every set for accurate progress tracking and better AI recommendations
5. **Use Plans**: Structure your training with 4-12 week plans for consistent progress
6. **Track Everything**: The more data you log, the better insights AI can provide
7. **Rest Days**: Schedule rest days by skipping days in workout structure

### Progress & Analysis
8. **Ask Your AI**: Use conversational queries like "How's my squat progressing?" for instant insights
9. **Progressive Overload**: Review history (or ask AI) to gradually increase weights
10. **Check Analytics**: Regularly review volume trends and personal records via the AI trainer
11. **Use Deloads**: Ask AI to clone your workout with reduced weights (e.g., -20%) for recovery weeks

### Data Management
12. **Export Regularly**: Backup your favorite programs as JSON files
13. **Share Programs**: Export and share successful programs with training partners
14. **Customize**: Adjust rest times and targets based on your needs and recovery

### Advanced Tips
15. **Exercise Variations**: Ask AI to suggest alternative exercises if you lack equipment
16. **Form Help**: Ask AI for form cues and technique tips on specific exercises
17. **Program Design**: Let AI create periodized programs with varying intensity and volume
18. **Quick Logging**: Use AI to log sets during workouts through conversation

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
