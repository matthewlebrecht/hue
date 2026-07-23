import { supabase } from './supabase.js'

/**
 * Household settings — shared across devices on purpose. The kitchen iPad and a
 * phone must not disagree about what time someone has to leave.
 */
export async function getSetting(key, fallback = null) {
  const { data, error } = await supabase
    .from('hue_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  if (error) throw error
  return data?.value ?? fallback
}

export async function setSetting(key, value) {
  const { error } = await supabase
    .from('hue_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
}

export const DEFAULT_COMMUTE = {
  riders: [
    { id: 'matthew', name: 'Matthew', destination: 'gallivan', arrive_by: '08:00', enabled: true },
    {
      id: 'ashlee',
      name: 'Ashlee',
      destination: 'city_center',
      arrive_by: '08:00',
      enabled: false,
    },
  ],
}
