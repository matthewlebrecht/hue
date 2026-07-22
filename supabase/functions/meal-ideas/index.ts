// HUE — meal ideas
//
// Reads the household inventory and asks Claude for 2-3 dinners that mostly use
// what's on hand. Runs as an Edge Function because the Anthropic API key must
// never reach the browser — the iPad is a shared kitchen device, and anything in
// the client bundle is readable by anyone who opens devtools.
//
// Deploy:
//   supabase functions deploy meal-ideas
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Ideas, not recipes — the brief is explicit that this should say "taco night's
 * doable", never "4 servings, 400g beef". The schema enforces that shape so the
 * model can't drift into recipe territory.
 */
const MEAL_SCHEMA = {
  type: 'object',
  properties: {
    headline: {
      type: 'string',
      description:
        "One short line for the kitchen dashboard, e.g. 'Taco night or a stir-fry'. No punctuation at the end.",
    },
    ideas: {
      type: 'array',
      description: '2-3 dinner ideas.',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description:
              'Short dish name in Title Case, e.g. "Crispy Chicken Sandwich", "Mac and Cheese".',
          },
          note: {
            type: 'string',
            description: 'One sentence on why it works tonight. Casual, not a recipe.',
          },
          have: {
            type: 'array',
            description: 'Inventory items this uses that are on hand.',
            items: { type: 'string' },
          },
          grab: {
            type: 'array',
            description:
              'Anything needed that is low, out, or not tracked. Empty if it can be made as-is.',
            items: { type: 'string' },
          },
        },
        required: ['name', 'note', 'have', 'grab'],
        additionalProperties: false,
      },
    },
  },
  required: ['headline', 'ideas'],
  additionalProperties: false,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Not signed in.' }, 401)
    }

    // Read inventory as the CALLER, not with the service role — the household RLS
    // policy stays in force, and this function can't become a way to read the
    // database without a session.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: inventory, error } = await supabase
      .from('inventory')
      .select('item, status, qty_loose')

    if (error) return json({ error: error.message }, 400)

    const onHand = (inventory ?? []).filter((i) => i.status !== 'out')
    if (onHand.length === 0) {
      return json({
        headline: 'Kitchen needs a shop first',
        ideas: [],
      })
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY is not set on the function.' }, 500)

    const anthropic = new Anthropic({ apiKey })

    const lines = (inventory ?? [])
      .map((i) => `- ${i.item}: ${i.status}${i.qty_loose ? ` (${i.qty_loose})` : ''}`)
      .join('\n')

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2000,
      // A short suggestion task — low effort keeps it fast and cheap, which
      // matters because this runs off a tap on a kitchen screen.
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: MEAL_SCHEMA },
      },
      system:
        "You suggest dinners for a two-person household from what's in their kitchen. " +
        'Give ideas, not recipes — no quantities, no servings, no step-by-step. ' +
        'Favour meals that mostly use what they already have. ' +
        'If something is marked low, you can still use it but say so. ' +
        'Never suggest a meal that needs more than two things they lack. ' +
        'Be warm and brief, like a housemate thinking out loud.',
      messages: [
        {
          role: 'user',
          content: `Here's what's in the kitchen right now:\n\n${lines}\n\nWhat should we have for dinner?`,
        },
      ],
    })

    const block = response.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') {
      return json({ error: 'No suggestion came back.' }, 502)
    }

    return json(JSON.parse(block.text))
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
