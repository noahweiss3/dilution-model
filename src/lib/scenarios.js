// Scenarios data layer. Each row in the `scenarios` Supabase table:
//   id uuid pk, user_id text (clerk user id), name text,
//   data jsonb (full scenario state), created_at, updated_at.

export async function listScenarios(supabase) {
  const { data, error } = await supabase
    .from('scenarios')
    .select('id, name, updated_at, created_at')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function loadScenario(supabase, id) {
  const { data, error } = await supabase
    .from('scenarios')
    .select('id, name, data, updated_at')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createScenario(supabase, name, data) {
  const { data: row, error } = await supabase
    .from('scenarios')
    .insert({ name, data })
    .select('id, name, updated_at')
    .single()
  if (error) throw error
  return row
}

export async function updateScenario(supabase, id, patch) {
  const { data, error } = await supabase
    .from('scenarios')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, name, updated_at')
    .single()
  if (error) throw error
  return data
}

export async function deleteScenario(supabase, id) {
  const { error } = await supabase
    .from('scenarios')
    .delete()
    .eq('id', id)
  if (error) throw error
}
