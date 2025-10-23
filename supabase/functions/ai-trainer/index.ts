import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Helper: Validate UUID format
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Helper: Fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout: AI service took too long to respond');
    }
    throw error;
  }
}

// Helper: Parse API gateway errors
async function parseAPIError(response: Response): Promise<string> {
  try {
    const errorData = await response.json();
    if (errorData.error) {
      if (typeof errorData.error === 'string') {
        return errorData.error;
      }
      if (errorData.error.message) {
        return errorData.error.message;
      }
    }
    return `API error: ${response.status} ${response.statusText}`;
  } catch {
    // If we can't parse JSON, try text
    try {
      const errorText = await response.text();
      return errorText || `API error: ${response.status} ${response.statusText}`;
    } catch {
      return `API error: ${response.status} ${response.statusText}`;
    }
  }
}

// Helper: Categorize Supabase errors
interface SupabaseErrorInfo {
  type: 'not_found' | 'permission_denied' | 'constraint_violation' | 'database_error' | 'unknown';
  message: string;
  userFriendly: string;
}

function categorizeSupabaseError(error: any): SupabaseErrorInfo {
  const code = error.code;
  const message = error.message || 'Unknown database error';

  // PGRST116: No rows returned (404)
  if (code === 'PGRST116') {
    return {
      type: 'not_found',
      message,
      userFriendly: 'The requested record was not found or you don\'t have access to it'
    };
  }

  // PGRST301: Permission denied / RLS policy violation
  if (code === 'PGRST301' || code === '42501') {
    return {
      type: 'permission_denied',
      message,
      userFriendly: 'You don\'t have permission to perform this action'
    };
  }

  // 23503: Foreign key violation
  // 23505: Unique constraint violation
  // 23514: Check constraint violation
  if (code === '23503' || code === '23505' || code === '23514') {
    return {
      type: 'constraint_violation',
      message,
      userFriendly: 'This operation violates data integrity rules. Please check your input.'
    };
  }

  // Connection/database errors
  if (message.toLowerCase().includes('connection') ||
      message.toLowerCase().includes('timeout') ||
      code?.startsWith('08')) {
    return {
      type: 'database_error',
      message,
      userFriendly: 'Database connection issue. Please try again.'
    };
  }

  return {
    type: 'unknown',
    message,
    userFriendly: 'An unexpected database error occurred'
  };
}

// Helper: Validate required fields
interface ValidationError {
  field: string;
  message: string;
}

function validateToolArgs(toolName: string, args: any): ValidationError[] {
  const errors: ValidationError[] = [];

  // UUID validations
  const uuidFields = [
    'workout_id', 'exercise_id', 'workout_day_id', 'workout_group_id',
    'workout_item_id', 'plan_id', 'session_id', 'session_group_id',
    'session_item_id', 'set_id'
  ];

  for (const field of uuidFields) {
    if (args[field] !== undefined && !isValidUUID(args[field])) {
      errors.push({ field, message: `Invalid UUID format for ${field}` });
    }
  }

  // String validations (non-empty)
  if (toolName === 'create_workout' || toolName === 'create_exercise' ||
      toolName === 'create_plan' || toolName === 'create_session') {
    if (args.name !== undefined && typeof args.name === 'string' && args.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Name cannot be empty' });
    }
  }

  // Number validations (positive)
  const positiveNumberFields = ['target_sets', 'target_reps', 'target_weight', 'rest_seconds', 'duration_weeks'];
  for (const field of positiveNumberFields) {
    if (args[field] !== undefined && (typeof args[field] !== 'number' || args[field] < 0)) {
      errors.push({ field, message: `${field} must be a positive number` });
    }
  }

  // Category validation
  if (toolName === 'create_exercise' || toolName === 'update_exercise') {
    if (args.category && !['strength', 'cardio', 'flexibility', 'balance'].includes(args.category)) {
      errors.push({
        field: 'category',
        message: 'Category must be one of: strength, cardio, flexibility, balance'
      });
    }
  }

  // Group type validation
  if (toolName === 'create_workout_group' || toolName === 'create_session_group') {
    if (args.group_type && !['straight_set', 'superset', 'circuit'].includes(args.group_type)) {
      errors.push({
        field: 'group_type',
        message: 'Group type must be one of: straight_set, superset, circuit'
      });
    }
  }

  return errors;
}

const tools = [
  // Workout CRUD
  {
    type: "function",
    function: {
      name: "list_workouts",
      description: "Get all workouts for the user with full details including days, groups, and exercises",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_workout",
      description: "Get a specific workout by ID with full details",
      parameters: {
        type: "object",
        properties: {
          workout_id: { type: "string", description: "UUID of the workout" }
        },
        required: ["workout_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_workout",
      description: "Create a new workout program",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the workout" },
          summary: { type: "string", description: "Optional summary/description" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_workout",
      description: "Update an existing workout",
      parameters: {
        type: "object",
        properties: {
          workout_id: { type: "string", description: "UUID of the workout" },
          name: { type: "string", description: "New name" },
          summary: { type: "string", description: "New summary" }
        },
        required: ["workout_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_workout",
      description: "Delete a workout (soft delete)",
      parameters: {
        type: "object",
        properties: {
          workout_id: { type: "string", description: "UUID of the workout" }
        },
        required: ["workout_id"]
      }
    }
  },
  // Exercise CRUD
  {
    type: "function",
    function: {
      name: "list_exercises",
      description: "Get all exercises for the user",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "create_exercise",
      description: "Create a new exercise",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the exercise" },
          instructions: { type: "string", description: "How to perform the exercise" },
          category: { type: "string", description: "Category (strength, cardio, flexibility, balance)" }
        },
        required: ["name", "category"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_exercise",
      description: "Update an existing exercise",
      parameters: {
        type: "object",
        properties: {
          exercise_id: { type: "string", description: "UUID of the exercise" },
          name: { type: "string", description: "New name" },
          instructions: { type: "string", description: "New instructions" },
          category: { type: "string", description: "New category" }
        },
        required: ["exercise_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_exercise",
      description: "Delete an exercise (soft delete)",
      parameters: {
        type: "object",
        properties: {
          exercise_id: { type: "string", description: "UUID of the exercise" }
        },
        required: ["exercise_id"]
      }
    }
  },
  // Workout Day CRUD
  {
    type: "function",
    function: {
      name: "create_workout_day",
      description: "Add a day to a workout",
      parameters: {
        type: "object",
        properties: {
          workout_id: { type: "string", description: "UUID of the workout" },
          dow: { type: "string", description: "Day of week (monday, tuesday, etc.)" },
          position: { type: "number", description: "Order position" }
        },
        required: ["workout_id", "dow"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_workout_day",
      description: "Remove a day from a workout",
      parameters: {
        type: "object",
        properties: {
          workout_day_id: { type: "string", description: "UUID of the workout day" }
        },
        required: ["workout_day_id"]
      }
    }
  },
  // Workout Group CRUD
  {
    type: "function",
    function: {
      name: "create_workout_group",
      description: "Add a group to a workout day (straight_set, superset, circuit)",
      parameters: {
        type: "object",
        properties: {
          workout_day_id: { type: "string", description: "UUID of the workout day" },
          name: { type: "string", description: "Name of the group" },
          group_type: { type: "string", description: "Type: straight_set, superset, or circuit" },
          rest_seconds: { type: "number", description: "Rest time between sets" },
          position: { type: "number", description: "Order position" }
        },
        required: ["workout_day_id", "name", "group_type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_workout_group",
      description: "Update a workout group",
      parameters: {
        type: "object",
        properties: {
          workout_group_id: { type: "string", description: "UUID of the workout group" },
          name: { type: "string", description: "New name" },
          rest_seconds: { type: "number", description: "New rest time" }
        },
        required: ["workout_group_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_workout_group",
      description: "Remove a group from a workout day",
      parameters: {
        type: "object",
        properties: {
          workout_group_id: { type: "string", description: "UUID of the workout group" }
        },
        required: ["workout_group_id"]
      }
    }
  },
  // Workout Item CRUD
  {
    type: "function",
    function: {
      name: "create_workout_item",
      description: "Add an exercise to a workout group",
      parameters: {
        type: "object",
        properties: {
          workout_group_id: { type: "string", description: "UUID of the workout group" },
          exercise_id: { type: "string", description: "UUID of the exercise" },
          position: { type: "number", description: "Order position" },
          target_sets: { type: "number", description: "Target number of sets" },
          target_reps: { type: "number", description: "Target reps per set" },
          target_weight: { type: "number", description: "Target weight" },
          rest_seconds_override: { type: "number", description: "Override rest time for this exercise" },
          notes: { type: "string", description: "Additional notes" }
        },
        required: ["workout_group_id", "exercise_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_workout_item",
      description: "Update an exercise in a workout",
      parameters: {
        type: "object",
        properties: {
          workout_item_id: { type: "string", description: "UUID of the workout item" },
          target_sets: { type: "number", description: "New target sets" },
          target_reps: { type: "number", description: "New target reps" },
          target_weight: { type: "number", description: "New target weight" },
          rest_seconds_override: { type: "number", description: "New rest time override" },
          notes: { type: "string", description: "New notes" }
        },
        required: ["workout_item_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_workout_item",
      description: "Remove an exercise from a workout group",
      parameters: {
        type: "object",
        properties: {
          workout_item_id: { type: "string", description: "UUID of the workout item" }
        },
        required: ["workout_item_id"]
      }
    }
  },
  // Plan CRUD
  {
    type: "function",
    function: {
      name: "list_plans",
      description: "Get all training plans for the user",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "create_plan",
      description: "Create a new training plan",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the plan" },
          workout_id: { type: "string", description: "UUID of the workout to use" },
          duration_weeks: { type: "number", description: "Duration in weeks" },
          start_date: { type: "string", description: "Start date (YYYY-MM-DD)" }
        },
        required: ["name", "workout_id", "duration_weeks"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_plan",
      description: "Update a training plan",
      parameters: {
        type: "object",
        properties: {
          plan_id: { type: "string", description: "UUID of the plan" },
          name: { type: "string", description: "New name" },
          is_active: { type: "boolean", description: "Set active status" }
        },
        required: ["plan_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_plan",
      description: "Delete a training plan",
      parameters: {
        type: "object",
        properties: {
          plan_id: { type: "string", description: "UUID of the plan" }
        },
        required: ["plan_id"]
      }
    }
  },
  // Session CRUD (History)
  {
    type: "function",
    function: {
      name: "list_sessions",
      description: "Get workout session history with optional filters",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max number of sessions to return (default 50)" },
          finished_only: { type: "boolean", description: "Only return completed sessions" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_session",
      description: "Get detailed session data including all completed sets",
      parameters: {
        type: "object",
        properties: {
          session_id: { type: "string", description: "UUID of the session" }
        },
        required: ["session_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_session",
      description: "Start a new workout session",
      parameters: {
        type: "object",
        properties: {
          workout_id: { type: "string", description: "UUID of the workout" },
          plan_id: { type: "string", description: "Optional UUID of the plan" },
          title: { type: "string", description: "Session title" },
          day_dow: { type: "string", description: "Day of week" }
        },
        required: ["workout_id", "title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "finish_session",
      description: "Mark a session as finished",
      parameters: {
        type: "object",
        properties: {
          session_id: { type: "string", description: "UUID of the session" }
        },
        required: ["session_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_session",
      description: "Delete a workout session",
      parameters: {
        type: "object",
        properties: {
          session_id: { type: "string", description: "UUID of the session" }
        },
        required: ["session_id"]
      }
    }
  },
  // Session Group CRUD
  {
    type: "function",
    function: {
      name: "create_session_group",
      description: "Add a group to an active session",
      parameters: {
        type: "object",
        properties: {
          session_id: { type: "string", description: "UUID of the session" },
          name: { type: "string", description: "Name of the group" },
          group_type: { type: "string", description: "Type: straight_set, superset, or circuit" },
          rest_seconds: { type: "number", description: "Rest time between sets" },
          position: { type: "number", description: "Order position" }
        },
        required: ["session_id", "name", "group_type"]
      }
    }
  },
  // Session Item CRUD
  {
    type: "function",
    function: {
      name: "create_session_item",
      description: "Add an exercise to a session group",
      parameters: {
        type: "object",
        properties: {
          session_group_id: { type: "string", description: "UUID of the session group" },
          exercise_name: { type: "string", description: "Name of the exercise" },
          position: { type: "number", description: "Order position" },
          target_sets: { type: "number", description: "Target sets" },
          target_reps: { type: "number", description: "Target reps" },
          target_weight: { type: "number", description: "Target weight" },
          notes: { type: "string", description: "Notes" }
        },
        required: ["session_group_id", "exercise_name"]
      }
    }
  },
  // Completed Set CRUD
  {
    type: "function",
    function: {
      name: "log_set",
      description: "Log a completed set during a workout session",
      parameters: {
        type: "object",
        properties: {
          session_item_id: { type: "string", description: "UUID of the session item" },
          set_number: { type: "number", description: "Set number (1, 2, 3, etc.)" },
          weight: { type: "number", description: "Weight used" },
          reps: { type: "number", description: "Reps completed" }
        },
        required: ["session_item_id", "set_number", "weight", "reps"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_set",
      description: "Update a logged set",
      parameters: {
        type: "object",
        properties: {
          set_id: { type: "string", description: "UUID of the completed set" },
          weight: { type: "number", description: "New weight" },
          reps: { type: "number", description: "New reps" }
        },
        required: ["set_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_set",
      description: "Delete a logged set",
      parameters: {
        type: "object",
        properties: {
          set_id: { type: "string", description: "UUID of the completed set" }
        },
        required: ["set_id"]
      }
    }
  },
  // User Settings
  {
    type: "function",
    function: {
      name: "get_user_settings",
      description: "Get user's custom system instructions",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "update_user_settings",
      description: "Update user's custom system instructions",
      parameters: {
        type: "object",
        properties: {
          system_instructions: { type: "string", description: "Custom instructions for the AI" }
        },
        required: ["system_instructions"]
      }
    }
  }
];

async function handleToolCall(toolName: string, args: any, userId: string, supabase: any) {
  console.log(`Executing tool: ${toolName}`, args);

  try {
    // Validate arguments before processing
    const validationErrors = validateToolArgs(toolName, args);
    if (validationErrors.length > 0) {
      return {
        success: false,
        error: 'Validation failed',
        validationErrors: validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')
      };
    }

    switch (toolName) {
      // Workout CRUD
      case "list_workouts": {
        const { data, error } = await supabase
          .from('workouts')
          .select(`
            *,
            workout_days!workout_days_workout_id_fkey (
              *,
              workout_groups!workout_groups_workout_day_id_fkey (
                *,
                workout_items!workout_items_workout_group_id_fkey (
                  *,
                  exercises!workout_items_exercise_id_fkey (*)
                )
              )
            )
          `)
          .eq('user_id', userId)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false });
        
        if (error) throw error;
        return { success: true, data };
      }

      case "get_workout": {
        const { data, error } = await supabase
          .from('workouts')
          .select(`
            *,
            workout_days!workout_days_workout_id_fkey (
              *,
              workout_groups!workout_groups_workout_day_id_fkey (
                *,
                workout_items!workout_items_workout_group_id_fkey (
                  *,
                  exercises!workout_items_exercise_id_fkey (*)
                )
              )
            )
          `)
          .eq('id', args.workout_id)
          .eq('user_id', userId)
          .is('deleted_at', null)
          .single();
        
        if (error) throw error;
        return { success: true, data };
      }

      case "create_workout": {
        const { data, error } = await supabase
          .from('workouts')
          .insert({
            name: args.name,
            summary: args.summary,
            user_id: userId
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data, message: `Created workout: ${args.name}` };
      }

      case "update_workout": {
        const updates: any = {};
        if (args.name) updates.name = args.name;
        if (args.summary !== undefined) updates.summary = args.summary;
        
        const { data, error } = await supabase
          .from('workouts')
          .update(updates)
          .eq('id', args.workout_id)
          .eq('user_id', userId)
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data, message: "Workout updated" };
      }

      case "delete_workout": {
        const { error } = await supabase
          .from('workouts')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', args.workout_id)
          .eq('user_id', userId);
        
        if (error) throw error;
        return { success: true, message: "Workout deleted" };
      }

      // Exercise CRUD
      case "list_exercises": {
        const { data, error } = await supabase
          .from('exercises')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .order('name');
        
        if (error) throw error;
        return { success: true, data };
      }

      case "create_exercise": {
        const { data, error } = await supabase
          .from('exercises')
          .insert({
            name: args.name,
            instructions: args.instructions,
            category: args.category,
            user_id: userId
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data, message: `Created exercise: ${args.name}` };
      }

      case "update_exercise": {
        const updates: any = {};
        if (args.name) updates.name = args.name;
        if (args.instructions !== undefined) updates.instructions = args.instructions;
        if (args.category) updates.category = args.category;
        
        const { data, error } = await supabase
          .from('exercises')
          .update(updates)
          .eq('id', args.exercise_id)
          .eq('user_id', userId)
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data, message: "Exercise updated" };
      }

      case "delete_exercise": {
        const { error } = await supabase
          .from('exercises')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', args.exercise_id)
          .eq('user_id', userId);
        
        if (error) throw error;
        return { success: true, message: "Exercise deleted" };
      }

      // Workout Day CRUD
      case "create_workout_day": {
        const { data, error } = await supabase
          .from('workout_days')
          .insert({
            workout_id: args.workout_id,
            dow: args.dow,
            position: args.position || 1
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data, message: `Added ${args.dow} to workout` };
      }

      case "delete_workout_day": {
        const { error } = await supabase
          .from('workout_days')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', args.workout_day_id);
        
        if (error) throw error;
        return { success: true, message: "Workout day removed" };
      }

      // Workout Group CRUD
      case "create_workout_group": {
        const { data, error } = await supabase
          .from('workout_groups')
          .insert({
            workout_day_id: args.workout_day_id,
            name: args.name,
            group_type: args.group_type,
            rest_seconds: args.rest_seconds,
            position: args.position || 1
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data, message: `Created ${args.group_type} group: ${args.name}` };
      }

      case "update_workout_group": {
        const updates: any = {};
        if (args.name) updates.name = args.name;
        if (args.rest_seconds !== undefined) updates.rest_seconds = args.rest_seconds;
        
        const { data, error } = await supabase
          .from('workout_groups')
          .update(updates)
          .eq('id', args.workout_group_id)
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data, message: "Group updated" };
      }

      case "delete_workout_group": {
        const { error } = await supabase
          .from('workout_groups')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', args.workout_group_id);
        
        if (error) throw error;
        return { success: true, message: "Group removed" };
      }

      // Workout Item CRUD
      case "create_workout_item": {
        const { data, error } = await supabase
          .from('workout_items')
          .insert({
            workout_group_id: args.workout_group_id,
            exercise_id: args.exercise_id,
            position: args.position || 1,
            target_sets: args.target_sets,
            target_reps: args.target_reps,
            target_weight: args.target_weight,
            rest_seconds_override: args.rest_seconds_override,
            notes: args.notes
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data, message: "Exercise added to group" };
      }

      case "update_workout_item": {
        const updates: any = {};
        if (args.target_sets !== undefined) updates.target_sets = args.target_sets;
        if (args.target_reps !== undefined) updates.target_reps = args.target_reps;
        if (args.target_weight !== undefined) updates.target_weight = args.target_weight;
        if (args.rest_seconds_override !== undefined) updates.rest_seconds_override = args.rest_seconds_override;
        if (args.notes !== undefined) updates.notes = args.notes;
        
        const { data, error } = await supabase
          .from('workout_items')
          .update(updates)
          .eq('id', args.workout_item_id)
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data, message: "Exercise updated" };
      }

      case "delete_workout_item": {
        const { error } = await supabase
          .from('workout_items')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', args.workout_item_id);
        
        if (error) throw error;
        return { success: true, message: "Exercise removed from group" };
      }

      // Plan CRUD
      case "list_plans": {
        const { data, error } = await supabase
          .from('plans')
          .select('*, workouts!plans_workout_id_fkey (*)')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .order('start_date', { ascending: false });
        
        if (error) throw error;
        return { success: true, data };
      }

      case "create_plan": {
        const { data, error } = await supabase
          .from('plans')
          .insert({
            name: args.name,
            workout_id: args.workout_id,
            duration_weeks: args.duration_weeks,
            start_date: args.start_date || new Date().toISOString().split('T')[0],
            user_id: userId
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data, message: `Created plan: ${args.name}` };
      }

      case "update_plan": {
        const updates: any = {};
        if (args.name) updates.name = args.name;
        if (args.is_active !== undefined) updates.is_active = args.is_active;
        
        const { data, error } = await supabase
          .from('plans')
          .update(updates)
          .eq('id', args.plan_id)
          .eq('user_id', userId)
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data, message: "Plan updated" };
      }

      case "delete_plan": {
        const { error } = await supabase
          .from('plans')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', args.plan_id)
          .eq('user_id', userId);
        
        if (error) throw error;
        return { success: true, message: "Plan deleted" };
      }

      // Session CRUD (History)
      case "list_sessions": {
        let query = supabase
          .from('sessions')
          .select('*')
          .eq('user_id', userId)
          .order('started_at', { ascending: false });
        
        if (args.finished_only) {
          query = query.not('finished_at', 'is', null);
        }
        
        if (args.limit) {
          query = query.limit(args.limit);
        } else {
          query = query.limit(50);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        return { success: true, data };
      }

      case "get_session": {
        const { data, error } = await supabase
          .from('sessions')
          .select(`
            *,
            session_groups!session_groups_session_id_fkey (
              *,
              session_items!session_items_session_group_id_fkey (
                *,
                completed_sets!completed_sets_session_item_id_fkey (*)
              )
            )
          `)
          .eq('id', args.session_id)
          .eq('user_id', userId)
          .single();
        
        if (error) throw error;
        return { success: true, data };
      }

      case "create_session": {
        const { data, error } = await supabase
          .from('sessions')
          .insert({
            workout_id: args.workout_id,
            plan_id: args.plan_id,
            title: args.title,
            day_dow: args.day_dow,
            started_at: new Date().toISOString(),
            user_id: userId
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data, message: `Started session: ${args.title}` };
      }

      case "finish_session": {
        const { data, error } = await supabase
          .from('sessions')
          .update({ finished_at: new Date().toISOString() })
          .eq('id', args.session_id)
          .eq('user_id', userId)
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data, message: "Session completed!" };
      }

      case "delete_session": {
        const { error } = await supabase
          .from('sessions')
          .delete()
          .eq('id', args.session_id)
          .eq('user_id', userId);
        
        if (error) throw error;
        return { success: true, message: "Session deleted" };
      }

      // Session Group CRUD
      case "create_session_group": {
        const { data, error } = await supabase
          .from('session_groups')
          .insert({
            session_id: args.session_id,
            name: args.name,
            group_type: args.group_type,
            rest_seconds: args.rest_seconds,
            position: args.position || 1
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data, message: `Added group to session` };
      }

      // Session Item CRUD
      case "create_session_item": {
        const { data, error } = await supabase
          .from('session_items')
          .insert({
            session_group_id: args.session_group_id,
            exercise_name: args.exercise_name,
            position: args.position || 1,
            target_sets: args.target_sets,
            target_reps: args.target_reps,
            target_weight: args.target_weight,
            notes: args.notes
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data, message: "Exercise added to session" };
      }

      // Completed Set CRUD
      case "log_set": {
        const { data, error } = await supabase
          .from('completed_sets')
          .insert({
            session_item_id: args.session_item_id,
            set_number: args.set_number,
            weight: args.weight,
            reps: args.reps
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data, message: `Logged set ${args.set_number}: ${args.weight}kg x ${args.reps}` };
      }

      case "update_set": {
        const updates: any = {};
        if (args.weight !== undefined) updates.weight = args.weight;
        if (args.reps !== undefined) updates.reps = args.reps;
        
        const { data, error } = await supabase
          .from('completed_sets')
          .update(updates)
          .eq('id', args.set_id)
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data, message: "Set updated" };
      }

      case "delete_set": {
        const { error } = await supabase
          .from('completed_sets')
          .delete()
          .eq('id', args.set_id);
        
        if (error) throw error;
        return { success: true, message: "Set deleted" };
      }

      // User Settings
      case "get_user_settings": {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        return { success: true, data: data || { system_instructions: null } };
      }

      case "update_user_settings": {
        const { data, error } = await supabase
          .from('user_settings')
          .upsert({
            user_id: userId,
            system_instructions: args.system_instructions
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, data, message: "Settings updated" };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    console.error(`Error in ${toolName}:`, error);
    console.error('Error type:', typeof error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');

    // Log full error object structure for debugging
    try {
      console.error('Full error object:', JSON.stringify(error, null, 2));
    } catch (stringifyError) {
      console.error('Could not stringify error object');
    }

    // Extract all possible error information
    let errorMessage = 'Unknown error';
    let errorDetails = '';
    let errorHint = '';

    if (error && typeof error === 'object') {
      // Try to extract message from various possible properties
      if ('message' in error && error.message) {
        errorMessage = String(error.message);
      } else if ('msg' in error && error.msg) {
        errorMessage = String(error.msg);
      } else if ('error' in error && error.error) {
        errorMessage = String(error.error);
      }

      // Extract PostgreSQL-specific error details
      if ('details' in error && error.details) {
        errorDetails = String(error.details);
      }
      if ('hint' in error && error.hint) {
        errorHint = String(error.hint);
      }

      // Categorize Supabase errors for better error messages
      if ('code' in error) {
        const errorInfo = categorizeSupabaseError(error);
        console.error('Supabase error type:', errorInfo.type);

        const fullMessage = [
          errorInfo.userFriendly,
          errorDetails ? `Details: ${errorDetails}` : '',
          errorHint ? `Hint: ${errorHint}` : ''
        ].filter(Boolean).join('. ');

        return {
          success: false,
          error: fullMessage,
          errorType: errorInfo.type,
          technicalDetails: errorInfo.message,
          pgDetails: errorDetails || undefined,
          pgHint: errorHint || undefined,
          stack: error instanceof Error ? error.stack : undefined
        };
      }
    }

    // Combine all error information
    const fullMessage = [
      errorMessage,
      errorDetails ? `Details: ${errorDetails}` : '',
      errorHint ? `Hint: ${errorHint}` : ''
    ].filter(Boolean).join('. ');

    return {
      success: false,
      error: fullMessage,
      stack: error instanceof Error ? error.stack : undefined
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { messages } = await req.json();
    
    // Get user settings for custom instructions
    const { data: settings } = await supabase
      .from('user_settings')
      .select('system_instructions')
      .eq('user_id', user.id)
      .single();

    const baseSystemPrompt = `You are an expert personal fitness trainer AI assistant with complete access to the user's fitness data. You can help with:

- Creating and managing workout programs (list, create, update, delete workouts and exercises)
- Building training plans (create, update plans)
- Logging workout sessions (start sessions, log sets, track progress)
- Analyzing training history (view past sessions, completed sets, progress)
- Providing fitness advice and recommendations

You have tools to perform ALL CRUD operations on workouts, exercises, plans, sessions, and completed sets. When users ask about their data, always use the appropriate tools to fetch current information.

Be conversational, encouraging, and provide specific, actionable advice based on their actual data.`;

    const systemPrompt = settings?.system_instructions 
      ? `${baseSystemPrompt}\n\nCustom Instructions: ${settings.system_instructions}`
      : baseSystemPrompt;

    const response = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        tools,
        tool_choice: 'auto'
      }),
    });

    if (!response.ok) {
      const errorMessage = await parseAPIError(response);
      console.error('AI gateway error:', response.status, errorMessage);
      throw new Error(`AI service error (${response.status}): ${errorMessage}`);
    }

    const aiResponse = await response.json();

    // Handle edge cases: Check if response structure is valid
    if (!aiResponse.choices || !Array.isArray(aiResponse.choices) || aiResponse.choices.length === 0) {
      console.error('Invalid AI response structure:', aiResponse);
      throw new Error('AI service returned an invalid response structure');
    }

    const message = aiResponse.choices[0]?.message;
    if (!message) {
      console.error('Missing message in AI response:', aiResponse);
      throw new Error('AI service returned a response without a message');
    }

    // Handle tool calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolResults = [];
      const toolFailures: string[] = [];

      for (const toolCall of message.tool_calls) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await handleToolCall(
            toolCall.function.name,
            args,
            user.id,
            supabase
          );

          // Track failed tools
          if (!result.success) {
            toolFailures.push(`${toolCall.function.name}: ${result.error}`);
          }

          // Truncate large results to prevent issues
          const resultString = JSON.stringify(result);
          const truncatedResult = resultString.length > 50000
            ? resultString.substring(0, 50000) + '...[truncated]'
            : resultString;

          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: toolCall.function.name,
            content: truncatedResult
          });
        } catch (error) {
          // Handle JSON parse errors or other tool execution errors
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          toolFailures.push(`${toolCall.function.name}: ${errorMessage}`);

          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: toolCall.function.name,
            content: JSON.stringify({
              success: false,
              error: errorMessage
            })
          });
        }
      }

      // Log tool failures for monitoring
      if (toolFailures.length > 0) {
        console.warn('Tool execution failures:', toolFailures);
      }

      // Continue with AI response even if some tools failed
      // The AI will see the failure results and can respond appropriately
      const finalResponse = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
            message,
            ...toolResults
          ]
        }),
      });

      if (!finalResponse.ok) {
        const errorMessage = await parseAPIError(finalResponse);
        console.error('AI gateway error on final response:', finalResponse.status, errorMessage);
        throw new Error(`AI service error on final response (${finalResponse.status}): ${errorMessage}`);
      }

      const finalData = await finalResponse.json();

      // Validate final response structure
      if (!finalData.choices || !Array.isArray(finalData.choices) || finalData.choices.length === 0) {
        console.error('Invalid final AI response structure:', finalData);
        throw new Error('AI service returned an invalid final response structure');
      }

      return new Response(JSON.stringify(finalData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(aiResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in ai-trainer:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    console.error('Request details:', {
      url: req.url,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries())
    });
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
