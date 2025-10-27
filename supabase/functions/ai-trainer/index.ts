import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "npm:@google/generative-ai@^0.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Helper: Validate UUID format
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
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


// Consolidated tools - converted to Google Gemini format
const tools = [
  {
    name: "manage_workouts",
    description: "Manage workout programs (create, read, update, delete). A workout is a template containing days, groups, and exercises.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "get", "create", "update", "delete"],
          description: "Action to perform"
        },
        workout_id: { type: "string", description: "UUID of workout (required for get, update, delete)" },
        name: { type: "string", description: "Workout name (required for create, optional for update)" },
        summary: { type: "string", description: "Workout description (optional)" }
      },
      required: ["action"]
    }
  },
  {
    name: "manage_exercises",
    description: "Manage exercise library (create, read, update, delete). Exercises are reusable across workouts.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "create", "update", "delete"],
          description: "Action to perform"
        },
        exercise_id: { type: "string", description: "UUID of exercise (required for update, delete)" },
        name: { type: "string", description: "Exercise name (required for create, optional for update)" },
        instructions: { type: "string", description: "How to perform the exercise" },
        category: {
          type: "string",
          enum: ["strength", "cardio", "flexibility", "balance"],
          description: "Exercise category (required for create, optional for update)"
        }
      },
      required: ["action"]
    }
  },
  {
    name: "manage_plans",
    description: "Manage training plans (create, read, update, delete). Plans link workouts to specific time periods.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "create", "update", "delete"],
          description: "Action to perform"
        },
        plan_id: { type: "string", description: "UUID of plan (required for update, delete)" },
        name: { type: "string", description: "Plan name (required for create, optional for update)" },
        workout_id: { type: "string", description: "UUID of workout (required for create)" },
        duration_weeks: { type: "number", description: "Duration in weeks (required for create)" },
        start_date: { type: "string", description: "Start date YYYY-MM-DD (optional for create)" },
        is_active: { type: "boolean", description: "Active status (optional for update)" }
      },
      required: ["action"]
    }
  },
  {
    name: "manage_sessions",
    description: "Manage workout sessions (create, read, update, delete, finish). Sessions track actual workouts performed.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "get", "create", "finish", "delete"],
          description: "Action to perform"
        },
        session_id: { type: "string", description: "UUID of session (required for get, finish, delete)" },
        workout_id: { type: "string", description: "UUID of workout (required for create)" },
        plan_id: { type: "string", description: "UUID of plan (optional for create)" },
        title: { type: "string", description: "Session title (required for create)" },
        day_dow: { type: "string", description: "Day of week (optional for create)" },
        limit: { type: "number", description: "Max results for list (default 50)" },
        finished_only: { type: "boolean", description: "Only show completed sessions (for list)" }
      },
      required: ["action"]
    }
  },
  {
    name: "manage_workout_structure",
    description: "Manage workout structure: days, groups, and items. Use this to build workout templates.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "create_day", "delete_day",
            "create_group", "update_group", "delete_group",
            "create_item", "update_item", "delete_item"
          ],
          description: "Action to perform on workout structure"
        },
        workout_id: { type: "string", description: "UUID of workout (for create_day)" },
        dow: { type: "string", description: "Day of week (for create_day)" },
        workout_day_id: { type: "string", description: "UUID of workout day (for delete_day, create_group)" },
        workout_group_id: { type: "string", description: "UUID of workout group (for update_group, delete_group, create_item)" },
        group_name: { type: "string", description: "Group name (for create_group, update_group)" },
        group_type: {
          type: "string",
          enum: ["straight_set", "superset", "circuit"],
          description: "Group type (for create_group)"
        },
        rest_seconds: { type: "number", description: "Rest time (for create_group, update_group)" },
        workout_item_id: { type: "string", description: "UUID of workout item (for update_item, delete_item)" },
        exercise_id: { type: "string", description: "UUID of exercise (for create_item)" },
        target_sets: { type: "number", description: "Target sets (for create_item, update_item)" },
        target_reps: { type: "number", description: "Target reps (for create_item, update_item)" },
        target_weight: { type: "number", description: "Target weight (for create_item, update_item)" },
        rest_seconds_override: { type: "number", description: "Override rest time (for create_item, update_item)" },
        notes: { type: "string", description: "Notes (for create_item, update_item)" },
        position: { type: "number", description: "Order position (optional)" }
      },
      required: ["action"]
    }
  },
  {
    name: "manage_session_data",
    description: "Manage active session data: groups, items, and completed sets. Use this during live workouts.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "create_group", "create_item",
            "log_set", "update_set", "delete_set"
          ],
          description: "Action to perform on session data"
        },
        session_id: { type: "string", description: "UUID of session (for create_group)" },
        group_name: { type: "string", description: "Group name (for create_group)" },
        group_type: {
          type: "string",
          enum: ["straight_set", "superset", "circuit"],
          description: "Group type (for create_group)"
        },
        rest_seconds: { type: "number", description: "Rest time (for create_group)" },
        session_group_id: { type: "string", description: "UUID of session group (for create_item)" },
        exercise_name: { type: "string", description: "Exercise name (for create_item)" },
        target_sets: { type: "number", description: "Target sets (for create_item)" },
        target_reps: { type: "number", description: "Target reps (for create_item)" },
        target_weight: { type: "number", description: "Target weight (for create_item)" },
        session_item_id: { type: "string", description: "UUID of session item (for log_set)" },
        set_id: { type: "string", description: "UUID of completed set (for update_set, delete_set)" },
        set_number: { type: "number", description: "Set number 1,2,3... (for log_set)" },
        weight: { type: "number", description: "Weight used (for log_set, update_set)" },
        reps: { type: "number", description: "Reps completed (for log_set, update_set)" },
        notes: { type: "string", description: "Notes (for create_item)" },
        position: { type: "number", description: "Order position (optional)" }
      },
      required: ["action"]
    }
  },
  {
    name: "get_user_settings",
    description: "Get user's custom system instructions and preferences.",
    parameters: { type: "object", properties: {}, required: [] }
  },
  {
    name: "update_user_settings",
    description: "Update user's custom system instructions and preferences.",
    parameters: {
      type: "object",
      properties: {
        system_instructions: { type: "string", description: "Custom instructions for the AI trainer" }
      },
      required: ["system_instructions"]
    }
  },
  {
    name: "create_complete_workout",
    description: "Create a complete workout with all days, groups, and exercises in ONE call. Use this instead of manually creating structure piece by piece. Much faster and safer than using manage_workout_structure repeatedly.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Workout name (required)" },
        summary: { type: "string", description: "Workout description (optional)" },
        days: {
          type: "array",
          description: "Array of workout days with groups and exercises",
          items: {
            type: "object",
            properties: {
              dow: {
                type: "string",
                enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                description: "Day of week"
              },
              position: { type: "number", description: "Order position (default: 1)" },
              groups: {
                type: "array",
                description: "Exercise groups for this day",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Group name (e.g., 'Chest & Triceps')" },
                    group_type: {
                      type: "string",
                      enum: ["single", "superset", "triset", "circuit"],
                      description: "Type of grouping"
                    },
                    rest_seconds: { type: "number", description: "Rest time between sets" },
                    position: { type: "number", description: "Order position" },
                    exercises: {
                      type: "array",
                      description: "Exercises in this group",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string", description: "Exercise name (will be created if doesn't exist)" },
                          category: {
                            type: "string",
                            enum: ["strength", "cardio", "flexibility", "balance"],
                            description: "Exercise category (default: strength)"
                          },
                          instructions: { type: "string", description: "How to perform the exercise" },
                          target_sets: { type: "number", description: "Target number of sets" },
                          target_reps: { type: "number", description: "Target number of reps" },
                          target_weight: { type: "number", description: "Target weight in kg" },
                          rest_seconds_override: { type: "number", description: "Override group rest time for this exercise" },
                          notes: { type: "string", description: "Exercise notes" },
                          position: { type: "number", description: "Order position" }
                        },
                        required: ["name"]
                      }
                    }
                  },
                  required: ["name", "group_type", "exercises"]
                }
              }
            },
            required: ["dow", "groups"]
          }
        }
      },
      required: ["name", "days"]
    }
  },
  {
    name: "start_session_from_workout",
    description: "Start a new workout session from a workout template. Automatically copies the workout structure and prepares it for logging sets. Much easier than manually creating sessions.",
    parameters: {
      type: "object",
      properties: {
        workout_id: { type: "string", description: "UUID of the workout template to use (required)" },
        plan_id: { type: "string", description: "UUID of the training plan (optional)" },
        dow: {
          type: "string",
          enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          description: "Day of week (optional, defaults to today)"
        },
        title: { type: "string", description: "Custom session title (optional, auto-generated if not provided)" }
      },
      required: ["workout_id"]
    }
  },
  {
    name: "get_exercise_history",
    description: "Get comprehensive history for a specific exercise including all past sessions, sets, PRs, and progress statistics. Use this to answer questions about exercise performance over time.",
    parameters: {
      type: "object",
      properties: {
        exercise_name: { type: "string", description: "Name of the exercise (required)" },
        start_date: { type: "string", description: "Start date in ISO format (optional, defaults to 3 months ago)" },
        end_date: { type: "string", description: "End date in ISO format (optional, defaults to today)" },
        limit: { type: "number", description: "Maximum number of sessions to return (default: 50)" }
      },
      required: ["exercise_name"]
    }
  },
  {
    name: "get_workout_analytics",
    description: "Get comprehensive analytics including volume trends, top exercises, personal records, and workout frequency. Use this to answer questions about overall progress and performance.",
    parameters: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "Start date in ISO format (optional, defaults to 3 months ago)" },
        end_date: { type: "string", description: "End date in ISO format (optional, defaults to today)" },
        workout_id: { type: "string", description: "Filter analytics to a specific workout (optional)" }
      }
    }
  },
  {
    name: "clone_workout",
    description: "Create a copy of an existing workout with optional modifications like weight scaling (for deload weeks) or rep adjustments. Useful for creating workout variations.",
    parameters: {
      type: "object",
      properties: {
        workout_id: { type: "string", description: "UUID of the workout to clone (required)" },
        new_name: { type: "string", description: "Name for the cloned workout (required)" },
        scale_weights: { type: "number", description: "Multiply all weights by this factor (optional, default: 1.0, e.g., 0.8 for deload)" },
        change_reps: { type: "number", description: "Add/subtract this many reps to all exercises (optional, default: 0)" }
      },
      required: ["workout_id", "new_name"]
    }
  }
];

async function handleToolCall(toolName: string, args: any, userId: string, supabase: any) {
  console.log(`Executing tool: ${toolName}`, args);

  try {
    // Basic validation - full validation will happen per-action
    const action = args.action;

    switch (toolName) {
      case "manage_workouts": {
        switch (action) {
          case "list": {
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

          case "get": {
            if (!args.workout_id) {
              return { success: false, error: 'workout_id is required for get action' };
            }
            if (!isValidUUID(args.workout_id)) {
              return { success: false, error: 'Invalid workout_id format' };
            }

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

          case "create": {
            if (!args.name || args.name.trim().length === 0) {
              return { success: false, error: 'name is required for create action' };
            }

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

          case "update": {
            if (!args.workout_id) {
              return { success: false, error: 'workout_id is required for update action' };
            }
            if (!isValidUUID(args.workout_id)) {
              return { success: false, error: 'Invalid workout_id format' };
            }

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

          case "delete": {
            if (!args.workout_id) {
              return { success: false, error: 'workout_id is required for delete action' };
            }
            if (!isValidUUID(args.workout_id)) {
              return { success: false, error: 'Invalid workout_id format' };
            }

            const { error } = await supabase
              .from('workouts')
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', args.workout_id)
              .eq('user_id', userId);

            if (error) throw error;
            return { success: true, message: "Workout deleted" };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      }

      case "manage_exercises": {
        switch (action) {
          case "list": {
            const { data, error } = await supabase
              .from('exercises')
              .select('*')
              .eq('user_id', userId)
              .is('deleted_at', null)
              .order('name');

            if (error) throw error;
            return { success: true, data };
          }

          case "create": {
            if (!args.name || args.name.trim().length === 0) {
              return { success: false, error: 'name is required for create action' };
            }
            if (!args.category) {
              return { success: false, error: 'category is required for create action' };
            }
            if (!['strength', 'cardio', 'flexibility', 'balance'].includes(args.category)) {
              return { success: false, error: 'category must be strength, cardio, flexibility, or balance' };
            }

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

          case "update": {
            if (!args.exercise_id) {
              return { success: false, error: 'exercise_id is required for update action' };
            }
            if (!isValidUUID(args.exercise_id)) {
              return { success: false, error: 'Invalid exercise_id format' };
            }

            const updates: any = {};
            if (args.name) updates.name = args.name;
            if (args.instructions !== undefined) updates.instructions = args.instructions;
            if (args.category) {
              if (!['strength', 'cardio', 'flexibility', 'balance'].includes(args.category)) {
                return { success: false, error: 'category must be strength, cardio, flexibility, or balance' };
              }
              updates.category = args.category;
            }

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

          case "delete": {
            if (!args.exercise_id) {
              return { success: false, error: 'exercise_id is required for delete action' };
            }
            if (!isValidUUID(args.exercise_id)) {
              return { success: false, error: 'Invalid exercise_id format' };
            }

            const { error } = await supabase
              .from('exercises')
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', args.exercise_id)
              .eq('user_id', userId);

            if (error) throw error;
            return { success: true, message: "Exercise deleted" };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      }

      case "manage_plans": {
        switch (action) {
          case "list": {
            const { data, error } = await supabase
              .from('plans')
              .select('*, workouts!plans_workout_id_fkey (*)')
              .eq('user_id', userId)
              .is('deleted_at', null)
              .order('start_date', { ascending: false });

            if (error) throw error;
            return { success: true, data };
          }

          case "create": {
            if (!args.name || args.name.trim().length === 0) {
              return { success: false, error: 'name is required for create action' };
            }
            if (!args.workout_id) {
              return { success: false, error: 'workout_id is required for create action' };
            }
            if (!isValidUUID(args.workout_id)) {
              return { success: false, error: 'Invalid workout_id format' };
            }
            if (!args.duration_weeks || args.duration_weeks < 1) {
              return { success: false, error: 'duration_weeks must be at least 1' };
            }

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

          case "update": {
            if (!args.plan_id) {
              return { success: false, error: 'plan_id is required for update action' };
            }
            if (!isValidUUID(args.plan_id)) {
              return { success: false, error: 'Invalid plan_id format' };
            }

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

          case "delete": {
            if (!args.plan_id) {
              return { success: false, error: 'plan_id is required for delete action' };
            }
            if (!isValidUUID(args.plan_id)) {
              return { success: false, error: 'Invalid plan_id format' };
            }

            const { error } = await supabase
              .from('plans')
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', args.plan_id)
              .eq('user_id', userId);

            if (error) throw error;
            return { success: true, message: "Plan deleted" };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      }

      case "manage_sessions": {
        switch (action) {
          case "list": {
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

          case "get": {
            if (!args.session_id) {
              return { success: false, error: 'session_id is required for get action' };
            }
            if (!isValidUUID(args.session_id)) {
              return { success: false, error: 'Invalid session_id format' };
            }

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

          case "create": {
            if (!args.workout_id) {
              return { success: false, error: 'workout_id is required for create action' };
            }
            if (!isValidUUID(args.workout_id)) {
              return { success: false, error: 'Invalid workout_id format' };
            }
            if (!args.title || args.title.trim().length === 0) {
              return { success: false, error: 'title is required for create action' };
            }
            if (args.plan_id && !isValidUUID(args.plan_id)) {
              return { success: false, error: 'Invalid plan_id format' };
            }

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

          case "finish": {
            if (!args.session_id) {
              return { success: false, error: 'session_id is required for finish action' };
            }
            if (!isValidUUID(args.session_id)) {
              return { success: false, error: 'Invalid session_id format' };
            }

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

          case "delete": {
            if (!args.session_id) {
              return { success: false, error: 'session_id is required for delete action' };
            }
            if (!isValidUUID(args.session_id)) {
              return { success: false, error: 'Invalid session_id format' };
            }

            const { error } = await supabase
              .from('sessions')
              .delete()
              .eq('id', args.session_id)
              .eq('user_id', userId);

            if (error) throw error;
            return { success: true, message: "Session deleted" };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      }

      case "manage_workout_structure": {
        switch (action) {
          case "create_day": {
            if (!args.workout_id || !isValidUUID(args.workout_id)) {
              return { success: false, error: 'Valid workout_id is required' };
            }
            if (!args.dow) {
              return { success: false, error: 'dow (day of week) is required' };
            }

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

          case "delete_day": {
            if (!args.workout_day_id || !isValidUUID(args.workout_day_id)) {
              return { success: false, error: 'Valid workout_day_id is required' };
            }

            const { error } = await supabase
              .from('workout_days')
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', args.workout_day_id);

            if (error) throw error;
            return { success: true, message: "Workout day removed" };
          }

          case "create_group": {
            if (!args.workout_day_id || !isValidUUID(args.workout_day_id)) {
              return { success: false, error: 'Valid workout_day_id is required' };
            }
            if (!args.group_name) {
              return { success: false, error: 'group_name is required' };
            }
            if (!args.group_type || !['straight_set', 'superset', 'circuit'].includes(args.group_type)) {
              return { success: false, error: 'group_type must be straight_set, superset, or circuit' };
            }

            const { data, error } = await supabase
              .from('workout_groups')
              .insert({
                workout_day_id: args.workout_day_id,
                name: args.group_name,
                group_type: args.group_type,
                rest_seconds: args.rest_seconds,
                position: args.position || 1
              })
              .select()
              .single();

            if (error) throw error;
            return { success: true, data, message: `Created ${args.group_type} group: ${args.group_name}` };
          }

          case "update_group": {
            if (!args.workout_group_id || !isValidUUID(args.workout_group_id)) {
              return { success: false, error: 'Valid workout_group_id is required' };
            }

            const updates: any = {};
            if (args.group_name) updates.name = args.group_name;
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

          case "delete_group": {
            if (!args.workout_group_id || !isValidUUID(args.workout_group_id)) {
              return { success: false, error: 'Valid workout_group_id is required' };
            }

            const { error } = await supabase
              .from('workout_groups')
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', args.workout_group_id);

            if (error) throw error;
            return { success: true, message: "Group removed" };
          }

          case "create_item": {
            if (!args.workout_group_id || !isValidUUID(args.workout_group_id)) {
              return { success: false, error: 'Valid workout_group_id is required' };
            }
            if (!args.exercise_id || !isValidUUID(args.exercise_id)) {
              return { success: false, error: 'Valid exercise_id is required' };
            }

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

          case "update_item": {
            if (!args.workout_item_id || !isValidUUID(args.workout_item_id)) {
              return { success: false, error: 'Valid workout_item_id is required' };
            }

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

          case "delete_item": {
            if (!args.workout_item_id || !isValidUUID(args.workout_item_id)) {
              return { success: false, error: 'Valid workout_item_id is required' };
            }

            const { error } = await supabase
              .from('workout_items')
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', args.workout_item_id);

            if (error) throw error;
            return { success: true, message: "Exercise removed from group" };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      }

      case "manage_session_data": {
        switch (action) {
          case "create_group": {
            if (!args.session_id || !isValidUUID(args.session_id)) {
              return { success: false, error: 'Valid session_id is required' };
            }
            if (!args.group_name) {
              return { success: false, error: 'group_name is required' };
            }
            if (!args.group_type || !['straight_set', 'superset', 'circuit'].includes(args.group_type)) {
              return { success: false, error: 'group_type must be straight_set, superset, or circuit' };
            }

            const { data, error } = await supabase
              .from('session_groups')
              .insert({
                session_id: args.session_id,
                name: args.group_name,
                group_type: args.group_type,
                rest_seconds: args.rest_seconds,
                position: args.position || 1
              })
              .select()
              .single();

            if (error) throw error;
            return { success: true, data, message: "Added group to session" };
          }

          case "create_item": {
            if (!args.session_group_id || !isValidUUID(args.session_group_id)) {
              return { success: false, error: 'Valid session_group_id is required' };
            }
            if (!args.exercise_name) {
              return { success: false, error: 'exercise_name is required' };
            }

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

          case "log_set": {
            if (!args.session_item_id || !isValidUUID(args.session_item_id)) {
              return { success: false, error: 'Valid session_item_id is required' };
            }
            if (args.set_number === undefined || args.set_number < 1) {
              return { success: false, error: 'set_number must be at least 1' };
            }
            if (args.weight === undefined || args.reps === undefined) {
              return { success: false, error: 'weight and reps are required' };
            }

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
            if (!args.set_id || !isValidUUID(args.set_id)) {
              return { success: false, error: 'Valid set_id is required' };
            }

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
            if (!args.set_id || !isValidUUID(args.set_id)) {
              return { success: false, error: 'Valid set_id is required' };
            }

            const { error } = await supabase
              .from('completed_sets')
              .delete()
              .eq('id', args.set_id);

            if (error) throw error;
            return { success: true, message: "Set deleted" };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      }

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

      case "create_complete_workout": {
        if (!args.name || args.name.trim().length === 0) {
          return { success: false, error: 'Workout name is required' };
        }
        if (!args.days || !Array.isArray(args.days) || args.days.length === 0) {
          return { success: false, error: 'At least one day is required' };
        }

        const { data, error } = await supabase.rpc('create_complete_workout', {
          p_user_id: userId,
          p_workout_name: args.name,
          p_workout_summary: args.summary || null,
          p_days: args.days
        });

        if (error) throw error;
        return data;
      }

      case "start_session_from_workout": {
        if (!args.workout_id) {
          return { success: false, error: 'workout_id is required' };
        }
        if (!isValidUUID(args.workout_id)) {
          return { success: false, error: 'Invalid workout_id format' };
        }

        const { data, error } = await supabase.rpc('start_session_from_workout', {
          p_user_id: userId,
          p_workout_id: args.workout_id,
          p_plan_id: args.plan_id || null,
          p_dow: args.dow || null,
          p_title: args.title || null
        });

        if (error) throw error;
        return data;
      }

      case "get_exercise_history": {
        if (!args.exercise_name || args.exercise_name.trim().length === 0) {
          return { success: false, error: 'exercise_name is required' };
        }

        const { data, error } = await supabase.rpc('get_exercise_history', {
          p_user_id: userId,
          p_exercise_name: args.exercise_name,
          p_start_date: args.start_date || null,
          p_end_date: args.end_date || null,
          p_limit: args.limit || 50
        });

        if (error) throw error;
        return { success: true, data };
      }

      case "get_workout_analytics": {
        const { data, error } = await supabase.rpc('get_workout_analytics', {
          p_user_id: userId,
          p_start_date: args.start_date || null,
          p_end_date: args.end_date || null,
          p_workout_id: args.workout_id || null
        });

        if (error) throw error;
        return { success: true, data };
      }

      case "clone_workout": {
        if (!args.workout_id) {
          return { success: false, error: 'workout_id is required' };
        }
        if (!isValidUUID(args.workout_id)) {
          return { success: false, error: 'Invalid workout_id format' };
        }
        if (!args.new_name || args.new_name.trim().length === 0) {
          return { success: false, error: 'new_name is required' };
        }

        const { data, error } = await supabase.rpc('clone_workout', {
          p_user_id: userId,
          p_workout_id: args.workout_id,
          p_new_name: args.new_name,
          p_scale_weights: args.scale_weights || 1.0,
          p_change_reps: args.change_reps || 0
        });

        if (error) throw error;
        return data;
      }

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
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

    // Initialize Google Generative AI
    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations: tools }],
    });

    // Convert messages from OpenAI format to Gemini format
    // Gemini expects alternating user/model roles
    const geminiMessages = messages.map((msg: any) => {
      if (msg.role === 'system') {
        // Skip system messages as they're in systemInstruction
        return null;
      }
      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      };
    }).filter((msg: any) => msg !== null);

    // Start chat session
    const chat = model.startChat({
      history: geminiMessages.slice(0, -1), // All messages except the last
    });

    // Send the last message and get streaming response
    const lastMessage = geminiMessages[geminiMessages.length - 1];
    const result = await chat.sendMessageStream(lastMessage.parts);

    // Stream the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullText = '';
          let functionCalls: any[] = [];

          // Collect all chunks
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
              fullText += chunkText;

              // Send streaming chunk to client in OpenAI-compatible format
              const streamChunk = {
                choices: [{
                  delta: { content: chunkText },
                  index: 0
                }]
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(streamChunk)}\n\n`));
            }

            // Check for function calls
            if (chunk.functionCalls && chunk.functionCalls().length > 0) {
              functionCalls = chunk.functionCalls();
            }
          }

          // Handle function calls if present
          if (functionCalls.length > 0) {
            console.log('Function calls detected:', functionCalls.map(fc => fc.name));

            const functionResponses = [];
            const toolFailures: string[] = [];

            for (const functionCall of functionCalls) {
              try {
                const result = await handleToolCall(
                  functionCall.name,
                  functionCall.args,
                  user.id,
                  supabase
                );

                // Track failed tools
                if (!result.success) {
                  toolFailures.push(`${functionCall.name}: ${result.error}`);
                }

                // Truncate large results
                const resultString = JSON.stringify(result);
                const truncatedResult = resultString.length > 50000
                  ? resultString.substring(0, 50000) + '...[truncated]'
                  : resultString;

                functionResponses.push({
                  name: functionCall.name,
                  response: { result: truncatedResult }
                });
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                toolFailures.push(`${functionCall.name}: ${errorMessage}`);

                functionResponses.push({
                  name: functionCall.name,
                  response: {
                    result: JSON.stringify({
                      success: false,
                      error: errorMessage
                    })
                  }
                });
              }
            }

            // Log tool failures
            if (toolFailures.length > 0) {
              console.warn('Tool execution failures:', toolFailures);
            }

            // Send function responses back to model and stream final response
            const finalResult = await chat.sendMessageStream({
              functionResponses
            });

            for await (const chunk of finalResult.stream) {
              const chunkText = chunk.text();
              if (chunkText) {
                const streamChunk = {
                  choices: [{
                    delta: { content: chunkText },
                    index: 0
                  }]
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(streamChunk)}\n\n`));
              }
            }
          }

          // Send done signal
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
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
