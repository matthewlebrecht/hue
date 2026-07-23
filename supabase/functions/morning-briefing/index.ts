// HUE — morning briefing
//
// One paragraph over data HUE already holds: today's schedule, weather, what's
// low in the kitchen, and where the money stands.
//
// The client sends the context rather than the function re-reading the database.
// Everything here is already on screen in the app, already RLS-checked when it
// was fetched, and the balance/budget math lives in one place on the client —
// duplicating it server-side would mean two implementations to keep in step.
//
// Deploy:
//   supabase functions deploy morning-briefing
// (uses the same ANTHROPIC_API_KEY secret as meal-ideas)

import Anthropic from 'npm:@anthropic-ai/sdk'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    if (!req.headers.get('Authorization')) return json({ error: 'Not signed in.' }, 401)

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY is not set on the function.' }, 500)

    const ctx = await req.json()
    const anthropic = new Anthropic({ apiKey })

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 400,
      output_config: { effort: 'low' },
      system:
        "You write a single short paragraph each morning for a two-person household's " +
        'kitchen display. Matthew and Ashlee. Read at a glance from across the room.\n\n' +
        'Rules:\n' +
        '- One paragraph. Three or four sentences at most. No lists, no headings, no preamble.\n' +
        "- Lead with what's actually happening today. Weather earns a clause, not a sentence, " +
        'unless it changes plans.\n' +
        '- Mention money only if something is off — over budget, or an unusually big week. ' +
        "Silence means fine. Never state the net worth.\n" +
        "- Mention the kitchen only if something's out that matters.\n" +
        '- Warm and plain, like a housemate talking over coffee. Never chirpy. No emoji.\n' +
        '- If the day is genuinely quiet, say so briefly rather than inventing significance.\n' +
        '- Use their names sparingly, and never call anyone "Boss".',
      messages: [{ role: 'user', content: buildPrompt(ctx) }],
    })

    const block = response.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') return json({ error: 'No briefing came back.' }, 502)

    return json({ text: block.text.trim() })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

function buildPrompt(ctx) {
  const parts = []

  parts.push(`Today is ${ctx.date}.`)

  if (ctx.weather) {
    parts.push(
      `Weather: ${ctx.weather.label}, currently ${ctx.weather.temp}F, high ${ctx.weather.high}F, ` +
        `low ${ctx.weather.low}F, ${ctx.weather.rainChance}% chance of precipitation.`
    )
  }

  parts.push(
    ctx.today?.length
      ? `On the calendar today:\n${ctx.today.map((e) => `- ${e}`).join('\n')}`
      : 'Nothing on the calendar today.'
  )

  if (ctx.tomorrow?.length) {
    parts.push(`Tomorrow:\n${ctx.tomorrow.map((e) => `- ${e}`).join('\n')}`)
  }
  if (ctx.upcoming?.length) {
    parts.push(`Coming up:\n${ctx.upcoming.map((e) => `- ${e}`).join('\n')}`)
  }

  if (ctx.kitchen?.out?.length || ctx.kitchen?.low?.length) {
    parts.push(
      `Kitchen: out of ${ctx.kitchen.out?.join(', ') || 'nothing'}; ` +
        `low on ${ctx.kitchen.low?.join(', ') || 'nothing'}.`
    )
  } else {
    parts.push('Kitchen is stocked.')
  }

  if (ctx.money) {
    parts.push(
      `Money: ${ctx.money.status}. Spent ${ctx.money.spent} this month` +
        (ctx.money.limit ? ` against a ${ctx.money.limit} budget.` : ' (no budget set).') +
        (ctx.money.overCategories?.length
          ? ` Over on: ${ctx.money.overCategories.join(', ')}.`
          : '')
    )
  }

  parts.push('\nWrite the briefing.')
  return parts.join('\n\n')
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
