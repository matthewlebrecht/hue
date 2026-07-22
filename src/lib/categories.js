import { supabase } from './supabase.js'

export async function fetchCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, type')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function createCategory(name, type = 'expense') {
  const { data, error } = await supabase
    .from('categories')
    .insert({ name: name.trim(), type })
    .select()
    .single()
  if (error) throw error
  return data
}
