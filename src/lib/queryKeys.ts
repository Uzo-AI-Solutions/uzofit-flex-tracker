export const queryKeys = {
  workouts: {
    all: ['workouts'] as const,
    one: (id: string) => ['workouts', id] as const,
    days: (workoutId: string) => ['workouts', workoutId, 'days'] as const,
  },
  plans: {
    all: ['plans'] as const,
    one: (id: string) => ['plans', id] as const,
    active: () => ['plans', 'active'] as const,
  },
  sessions: {
    all: ['sessions'] as const,
    one: (id: string) => ['sessions', id] as const,
    active: () => ['sessions', 'active'] as const,
  },
  exercises: {
    all: ['exercises'] as const,
    one: (id: string) => ['exercises', id] as const,
  },
} as const;
