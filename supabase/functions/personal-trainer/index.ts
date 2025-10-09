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
    const { messages, action } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // System prompt for the personal trainer
    const systemPrompt = `You are UzoFit AI, a professional personal trainer assistant. You help users create workout programs and log their training sessions.

Your capabilities:
1. Create custom workout programs based on user goals, experience level, and preferences
2. Analyze user's workout history to suggest improvements or variations
3. Log completed workout sessions when users tell you what they did

Workout Structure:
- Workouts contain multiple training days (Mon-Sun)
- Each day has workout groups (single exercises, supersets, trisets, or circuits)
- Each group contains workout items (exercises) with target sets, reps, and weight
- Rest periods are set at the group level (default) or can be overridden per exercise

Exercise Categories: strength, cardio, flexibility, sports

When creating workouts:
- Ask about goals (strength, hypertrophy, endurance, etc.)
- Consider experience level (beginner, intermediate, advanced)
- Include appropriate rest periods (60-90s for hypertrophy, 3-5min for strength)
- Balance muscle groups across the week
- Use proper exercise selection for the goals

When logging sessions:
- Get workout name, date/time, and all exercises performed with sets/reps/weight
- Calculate total volume (sets × reps × weight)

Use the provided tools to interact with the database.`;

    // Define tools for function calling
    const tools = [
      {
        type: "function",
        function: {
          name: "get_workout_history",
          description: "Retrieve the user's workout history and existing workout programs",
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
      const { tool_name, tool_arguments } = await req.json();
      
      if (tool_name === 'get_workout_history') {
        const limit = tool_arguments.limit || 10;
        
        // Get recent sessions
        const { data: sessions } = await supabase
          .from('sessions')
          .select(`
            id,
            title,
            started_at,
            finished_at,
            total_volume
          `)
          .order('started_at', { ascending: false })
          .limit(limit);
        
        // Get existing workouts
        const { data: workouts } = await supabase
          .from('workouts')
          .select('id, name, summary')
          .is('deleted_at', null)
          .limit(20);
        
        return new Response(
          JSON.stringify({ sessions, workouts }),
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
