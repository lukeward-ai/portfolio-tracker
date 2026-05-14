import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf-8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.split('=')[0].trim(), l.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '')])
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEMO_USER_ID = 'ed66494f-e701-4b4f-8530-e341f3dfa225'
const ISA_ID = 'a25504aa-446d-436c-99b6-10498309be14'
const INVEST_ID = '031a6352-0f40-4e34-ad36-8681faf2514d'

console.log('Setting broker on ISA portfolio...')
const { error: e1 } = await supabase.from('portfolios')
  .update({ description: 'Trading 212' })
  .eq('id', ISA_ID)
if (e1) { console.error('ISA update failed:', e1.message); process.exit(1) }

console.log('Setting broker on Invest portfolio...')
const { error: e2 } = await supabase.from('portfolios')
  .update({ description: 'Trading 212' })
  .eq('id', INVEST_ID)
if (e2) { console.error('Invest update failed:', e2.message); process.exit(1) }

// Check if Davy already exists
const { data: existing } = await supabase.from('portfolios')
  .select('id')
  .eq('user_id', DEMO_USER_ID)
  .eq('name', 'Davy')
  .maybeSingle()

let davyId
if (existing) {
  console.log('Davy portfolio already exists:', existing.id)
  davyId = existing.id
  await supabase.from('portfolios').update({ description: 'Davy' }).eq('id', davyId)
} else {
  console.log('Creating Davy portfolio...')
  const { data: davy, error: e3 } = await supabase.from('portfolios').insert({
    user_id: DEMO_USER_ID,
    name: 'Davy',
    description: 'Davy',
  }).select().single()
  if (e3) { console.error('Davy insert failed:', e3.message); process.exit(1) }
  davyId = davy.id

  console.log('Creating Davy cash positions...')
  const { error: e4 } = await supabase.from('cash_positions').insert([
    { portfolio_id: davyId, user_id: DEMO_USER_ID, currency: 'USD', amount: 0 },
    { portfolio_id: davyId, user_id: DEMO_USER_ID, currency: 'EUR', amount: 0 },
    { portfolio_id: davyId, user_id: DEMO_USER_ID, currency: 'GBP', amount: 0 },
  ])
  if (e4) { console.error('Davy cash insert failed:', e4.message); process.exit(1) }
}

console.log('\n✓ Migration complete')
console.log(`  ISA (Trading 212):    ${ISA_ID}`)
console.log(`  Invest (Trading 212): ${INVEST_ID}`)
console.log(`  Davy:                 ${davyId}`)
console.log(`\nAdd to demo-user.ts:\nexport const DEMO_DAVY_PORTFOLIO_ID = '${davyId}'`)
