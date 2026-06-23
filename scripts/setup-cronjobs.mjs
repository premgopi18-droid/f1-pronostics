/**
 * Configure les deux crons BoxBox sur cron-job.org via leur API REST.
 * Upsert : crée si absent, met à jour si présent (détection par titre).
 *
 * Usage :
 *   CRONJOB_API_KEY=xxx CRON_SECRET=yyy SITE_URL=https://boxbox-silk.vercel.app \
 *   node scripts/setup-cronjobs.mjs
 *
 * Variables d'environnement (ou depuis .env.local si dotenv installé) :
 *   CRONJOB_API_KEY   — API key cron-job.org (Settings → API)
 *   CRON_SECRET       — même valeur que dans Vercel env vars
 *   SITE_URL          — URL de production (sans slash final)
 */

const API = 'https://api.cron-job.org'
const KEY  = process.env.CRONJOB_API_KEY
const SECRET = process.env.CRON_SECRET
const SITE = (process.env.SITE_URL ?? 'https://boxbox-silk.vercel.app').replace(/\/$/, '')

if (!KEY)    { console.error('❌  CRONJOB_API_KEY manquant'); process.exit(1) }
if (!SECRET) { console.error('❌  CRON_SECRET manquant');     process.exit(1) }

const headers = {
  'Content-Type': 'application/json',
  Authorization:  `Bearer ${KEY}`,
}

// Schéma de schedule : toutes les heures, tous les jours
function schedule(minuteMark) {
  return {
    timezone: 'UTC',
    hours:    [-1],   // toutes les heures
    minutes:  [minuteMark],
    mdays:    [-1],   // tous les jours du mois
    months:   [-1],   // tous les mois
    wdays:    [-1],   // tous les jours de la semaine
  }
}

const JOBS = [
  {
    title: 'BoxBox — F1 Sync',
    url:   `${SITE}/api/f1/sync`,
    minuteMark: 0,    // toutes les heures à :00
  },
  {
    title: 'BoxBox — Scoring & Notifications',
    url:   `${SITE}/api/scores/trigger`,
    minuteMark: 30,   // toutes les heures à :30
  },
]

async function apireq(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${method} ${path} → ${res.status}: ${text}`)
  }
  return res.status === 204 ? null : res.json()
}

async function listJobs() {
  const data = await apireq('GET', '/jobs')
  return data.jobs ?? []
}

async function upsertJob(def, existing) {
  const jobBody = {
    url:            def.url,
    enabled:        true,
    title:          def.title,
    saveResponses:  true,
    requestMethod:  0, // GET
    requestTimeout: 60,
    schedule:       schedule(def.minuteMark),
    requestHeaders: [{ name: 'x-cron-secret', value: SECRET }],
    auth:           { enable: false },
  }

  if (existing) {
    await apireq('PATCH', `/jobs/${existing.jobId}`, { job: jobBody })
    console.log(`✅  Mis à jour : ${def.title} (id: ${existing.jobId})`)
  } else {
    const res = await apireq('PUT', '/jobs', { job: jobBody })
    console.log(`✅  Créé : ${def.title} (id: ${res.jobId})`)
  }
}

async function main() {
  console.log(`\n🔧  Setup crons BoxBox → ${SITE}\n`)

  const existing = await listJobs()

  for (const def of JOBS) {
    const found = existing.find((j) => j.title === def.title)
    await upsertJob(def, found ?? null)
  }

  console.log('\n🏁  Terminé. Vérifie sur https://cron-job.org/en/members/jobs/\n')
}

main().catch((err) => { console.error('❌ ', err.message); process.exit(1) })
