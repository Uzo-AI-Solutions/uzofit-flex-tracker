import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { messages, action, tool_name, tool_arguments } = requestBody;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header to identify user
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }

    // Load custom system instructions if available
    let customInstructions = '';
    if (userId) {
      const { data: settings } = await supabase
        .from('user_settings')
        .select('system_instructions')
        .eq('user_id', userId)
        .maybeSingle();
      
      customInstructions = settings?.system_instructions || '';
    }

    // Base system prompt for the personal trainer
    const basePrompt = `You are UzoFit AI, a professional personal trainer assistant. You have full access to the user's fitness data and can help with:

1. Creating and editing custom workout programs
2. Setting up and managing training plans
3. Analyzing workout history and progress
4. Logging completed workout sessions
5. Making personalized recommendations based on their data

Workout Structure:
- Workouts contain multiple training days (Mon-Sun)
- Each day has workout groups (single exercises, supersets, trisets, or circuits)
- Each group contains workout items (exercises) with target sets, reps, and weight
- Rest periods are set at the group level (default) or can be overridden per exercise

Plans:
- Plans link workouts to a schedule with start date and duration
- Users can have active plans to follow
- You can create, update, and manage their training plans

Exercise Categories: strength, cardio, flexibility, sports

When creating workouts:
- Ask about goals (strength, hypertrophy, endurance, etc.)
- Consider experience level (beginner, intermediate, advanced)
- Include appropriate rest periods (60-90s for hypertrophy, 3-5min for strength)
- Balance muscle groups across the week
- Use proper exercise selection for the goals

When making recommendations:
- Analyze their workout history and plans
- Suggest progressive overload strategies
- Recommend exercise variations
- Consider recovery and training frequency

Use the provided tools to interact with the database.`;

    const systemPrompt = customInstructions 
      ? `${basePrompt}\n\nAdditional Instructions:\n${customInstructions}`
      : basePrompt;

    // Define tools for function calling
    const tools = [
      {
        type: "function",
        function: {
          name: "get_workout_history",
          description: "Retrieve the user's workout session history",
          parameters: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: "Number of recent sessions to retrieve (default 10)"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_workouts",
          description: "Get all workout programs with full details including days, groups, and exercises. Call this without parameters to see all workouts first.",
          parameters: {
            type: "object",
            properties: {
              workout_id: {
                type: "string",
                description: "Optional: Specific workout ID to get details for"
              },
              name: {
                type: "string",
                description: "Optional: Search by workout name (partial match)"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_workout",
          description: "Update an existing workout program",
          parameters: {
            type: "object",
            properties: {
              workout_id: { type: "string", description: "ID of workout to update" },
              name: { type: "string", description: "New workout name" },
              summary: { type: "string", description: "New workout summary" }
            },
            required: ["workout_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_plans",
          description: "Get all training plans with associated workout details",
          parameters: {
            type: "object",
            properties: {
              active_only: {
                type: "boolean",
                description: "Only return active plans"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_plan",
          description: "Create a new training plan from an existing workout",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Plan name" },
              workout_id: { type: "string", description: "ID of workout to use" },
              start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
              duration_weeks: { type: "number", description: "Duration in weeks" }
            },
            required: ["name", "workout_id", "start_date", "duration_weeks"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_plan",
          description: "Update or activate/deactivate a training plan",
          parameters: {
            type: "object",
            properties: {
              plan_id: { type: "string", description: "ID of plan to update" },
              is_active: { type: "boolean", description: "Set plan active status" },
              name: { type: "string", description: "New plan name" }
            },
            required: ["plan_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_recommendations",
          description: "Analyze user's data and provide personalized workout recommendations",
          parameters: {
            type: "object",
            properties: {
              focus: {
                type: "string",
                description: "Focus area: 'progression', 'volume', 'frequency', or 'general'"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_workout",
          description: "Create a new workout program in the database",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Workout program name" },
              summary: { type: "string", description: "Brief description of the workout" },
              workout_days: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    dow: {
                      type: "string",
                      enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                      description: "Day of week"
                    },
                    position: { type: "number" },
                    workout_groups: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          group_type: {
                            type: "string",
                            enum: ["single", "superset", "triset", "circuit"]
                          },
                          rest_seconds: { type: "number" },
                          position: { type: "number" },
                          workout_items: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                exercise_name: { type: "string" },
                                category: { type: "string" },
                                instructions: { type: "string" },
                                target_sets: { type: "number" },
                                target_reps: { type: "number" },
                                target_weight: { type: "number" },
                                rest_seconds_override: { type: "number" },
                                notes: { type: "string" },
                                position: { type: "number" }
                              },
                              required: ["exercise_name", "position"]
                            }
                          }
                        },
                        required: ["name", "group_type", "position", "workout_items"]
                      }
                    }
                  },
                  required: ["dow", "position", "workout_groups"]
                }
              }
            },
            required: ["name", "workout_days"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "log_session",
          description: "Log a completed workout session with exercises and sets",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Session title/name" },
              started_at: { type: "string", description: "ISO timestamp when workout started" },
              finished_at: { type: "string", description: "ISO timestamp when workout finished" },
              groups: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    group_type: { type: "string", enum: ["single", "superset", "triset", "circuit"] },
                    position: { type: "number" },
                    exercises: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          exercise_name: { type: "string" },
                          target_sets: { type: "number" },
                          position: { type: "number" },
                          sets: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                set_number: { type: "number" },
                                reps: { type: "number" },
                                weight: { type: "number" }
                              },
                              required: ["set_number", "reps", "weight"]
                            }
                          }
                        },
                        required: ["exercise_name", "position", "sets"]
                      }
                    }
                  },
                  required: ["name", "group_type", "position", "exercises"]
                }
              }
            },
            required: ["title", "started_at", "groups"]
          }
        }
      }
    ];

    // Handle tool execution
    if (action === 'execute_tool') {
      
      if (tool_name === 'get_workout_history') {
        const limit = tool_arguments.limit || 10;
        
        // Get recent sessions with details
        const { data: sessions } = await supabase
          .from('sessions')
          .select(`
            id,
            title,
            started_at,
            finished_at,
            total_volume,
            workout_id
          `)
          .order('started_at', { ascending: false })
          .limit(limit);
        
        return new Response(
          JSON.stringify({ sessions }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (tool_name === 'get_workouts') {
        const workoutId = tool_arguments.workout_id;
        const searchName = tool_arguments.name;
        
        let query = supabase
          .from('workouts')
          .select(`
            id,
            name,
            summary,
            created_at,
            workout_days!workout_days_workout_id_fkey (
              id,
              dow,
              position,
              workout_groups!workout_groups_workout_day_id_fkey (
                id,
                name,
                group_type,
                rest_seconds,
                position,
                workout_items!workout_items_workout_group_id_fkey (
                  id,
                  target_sets,
                  target_reps,
                  target_weight,
                  rest_seconds_override,
                  notes,
                  position,
                  exercise_id,
                  exercises:exercise_id (
                    id,
                    name,
                    category,
                    instructions
                  )
                )
              )
            )
          `)
          .is('deleted_at', null);
        
        if (workoutId) {
          query = query.eq('id', workoutId);
          const { data: workout } = await query.single();
          return new Response(
            JSON.stringify({ workout }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (searchName) {
          query = query.ilike('name', `%${searchName}%`);
        }
        
        const { data: workouts } = await query.order('created_at', { ascending: false });
        return new Response(
          JSON.stringify({ workouts }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (tool_name === 'update_workout') {
        const { workout_id, name, summary } = tool_arguments;
        
        const updateData: any = { updated_at: new Date().toISOString() };
        if (name) updateData.name = name;
        if (summary) updateData.summary = summary;
        
        const { data: workout, error } = await supabase
          .from('workouts')
          .update(updateData)
          .eq('id', workout_id)
          .select()
          .single();
        
        if (error) throw error;
        
        return new Response(
          JSON.stringify({ success: true, workout }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (tool_name === 'get_plans') {
        const activeOnly = tool_arguments.active_only || false;
        
        let query = supabase
          .from('plans')
          .select(`
            id,
            name,
            start_date,
            duration_weeks,
            is_active,
            workouts (
              id,
              name,
              summary
            )
          `)
          .is('deleted_at', null);
        
        if (activeOnly) {
          query = query.eq('is_active', true);
        }
        
        const { data: plans } = await query.order('created_at', { ascending: false });
        
        return new Response(
          JSON.stringify({ plans }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (tool_name === 'create_plan') {
        const { name, workout_id, start_date, duration_weeks } = tool_arguments;
        
        const { data: plan, error } = await supabase
          .from('plans')
          .insert({
            name,
            workout_id,
            start_date,
            duration_weeks,
            is_active: true
          })
          .select()
          .single();
        
        if (error) throw error;
        
        return new Response(
          JSON.stringify({ success: true, plan }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (tool_name === 'update_plan') {
        const { plan_id, is_active, name } = tool_arguments;
        
        const updateData: any = { updated_at: new Date().toISOString() };
        if (is_active !== undefined) updateData.is_active = is_active;
        if (name) updateData.name = name;
        
        const { data: plan, error } = await supabase
          .from('plans')
          .update(updateData)
          .eq('id', plan_id)
          .select()
          .single();
        
        if (error) throw error;
        
        return new Response(
          JSON.stringify({ success: true, plan }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (tool_name === 'get_recommendations') {
        // Gather comprehensive user data
        const { data: sessions } = await supabase
          .from('sessions')
          .select('id, title, started_at, total_volume')
          .order('started_at', { ascending: false })
          .limit(20);
        
        const { data: workouts } = await supabase
          .from('workouts')
          .select('id, name, summary')
          .is('deleted_at', null);
        
        const { data: plans } = await supabase
          .from('plans')
          .select('id, name, is_active, start_date, duration_weeks')
          .is('deleted_at', null);
        
        return new Response(
          JSON.stringify({ 
            sessions, 
            workouts, 
            plans,
            analysis: "Use this data to provide personalized recommendations"
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (tool_name === 'create_workout') {
        const workoutData = tool_arguments;
        
        // Create workout
        const { data: workout, error: workoutError } = await supabase
          .from('workouts')
          .insert({ name: workoutData.name, summary: workoutData.summary })
          .select()
          .single();
        
        if (workoutError) throw workoutError;
        
        // Create days, groups, and items
        for (const day of workoutData.workout_days) {
          const { data: workoutDay } = await supabase
            .from('workout_days')
            .insert({
              workout_id: workout.id,
              dow: day.dow,
              position: day.position
            })
            .select()
            .single();
          
          for (const group of day.workout_groups) {
            const { data: workoutGroup } = await supabase
              .from('workout_groups')
              .insert({
                workout_day_id: workoutDay.id,
                name: group.name,
                group_type: group.group_type,
                rest_seconds: group.rest_seconds,
                position: group.position
              })
              .select()
              .single();
            
            for (const item of group.workout_items) {
              // Ensure exercise exists
              let { data: exercise } = await supabase
                .from('exercises')
                .select('id')
                .eq('name', item.exercise_name)
                .maybeSingle();
              
              if (!exercise) {
                const { data: newEx } = await supabase
                  .from('exercises')
                  .insert({
                    name: item.exercise_name,
                    category: item.category || 'strength',
                    instructions: item.instructions
                  })
                  .select()
                  .single();
                exercise = newEx;
              }
              
              if (!exercise) {
                throw new Error(`Failed to create exercise: ${item.exercise_name}`);
              }
              
              await supabase
                .from('workout_items')
                .insert({
                  workout_group_id: workoutGroup.id,
                  exercise_id: exercise.id,
                  target_sets: item.target_sets,
                  target_reps: item.target_reps,
                  target_weight: item.target_weight,
                  rest_seconds_override: item.rest_seconds_override,
                  notes: item.notes,
                  position: item.position
                });
            }
          }
        }
        
        return new Response(
          JSON.stringify({ success: true, workout_id: workout.id, workout_name: workout.name }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (tool_name === 'log_session') {
        const sessionData = tool_arguments;
        
        // Create a dummy workout ID for ad-hoc sessions
        const dummyWorkoutId = '00000000-0000-0000-0000-000000000000';
        
        // Create session
        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .insert({
            title: sessionData.title,
            started_at: sessionData.started_at,
            finished_at: sessionData.finished_at || new Date().toISOString(),
            workout_id: dummyWorkoutId
          })
          .select()
          .single();
        
        if (sessionError) throw sessionError;
        
        let totalVolume = 0;
        
        // Create groups and items
        for (const group of sessionData.groups) {
          const { data: sessionGroup } = await supabase
            .from('session_groups')
            .insert({
              session_id: session.id,
              name: group.name,
              group_type: group.group_type,
              position: group.position
            })
            .select()
            .single();
          
          for (const exercise of group.exercises) {
            const { data: sessionItem } = await supabase
              .from('session_items')
              .insert({
                session_group_id: sessionGroup.id,
                exercise_name: exercise.exercise_name,
                target_sets: exercise.target_sets,
                position: exercise.position
              })
              .select()
              .single();
            
            // Log sets
            for (const set of exercise.sets) {
              await supabase
                .from('completed_sets')
                .insert({
                  session_item_id: sessionItem.id,
                  set_number: set.set_number,
                  reps: set.reps,
                  weight: set.weight
                });
              
              totalVolume += set.reps * set.weight;
            }
          }
        }
        
        // Update total volume
        await supabase
          .from('sessions')
          .update({ total_volume: totalVolume })
          .eq('id', session.id);
        
        return new Response(
          JSON.stringify({ success: true, session_id: session.id, total_volume: totalVolume }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Chat completion with Gemini
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
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
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
