export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type GroupType = 'single' | 'superset' | 'triset' | 'circuit';

export const DAYS_OF_WEEK: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  single: 'Single',
  superset: 'Superset',
  triset: 'Triset',
  circuit: 'Circuit',
};
