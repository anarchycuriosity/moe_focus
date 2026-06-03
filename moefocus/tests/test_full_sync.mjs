// 完整同步链路集成测试
// 模拟: git fetch → 文件写入 → sql.js import → regenerate → stats query
import { simpleGit } from 'simple-git'
import initSqlJs from 'sql.js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { rm } from 'fs/promises'

const REMOTE = 'C:/Users/curiosity/AppData/Local/Temp/moefocus_test/remote_repo'
const LOCAL = 'C:/Users/curiosity/AppData/Local/Temp/moefocus_test/local_integration_test'
const SCHEMA_PATH = 'C:/Users/curiosity/Desktop/moe_focus/moefocus/electron/database/schema.sql'

async function main()
{
  console.log('=== MoeFocus 完整同步链路集成测试 ===\n')

  // 1. Clean and set up local directory
  try { await rm(LOCAL, { recursive: true, force: true }) } catch {}
  mkdirSync(LOCAL, { recursive: true })

  // 2. Git init + fetch from mock remote
  console.log('[1] Git: init + fetch from mock remote...')
  const g = simpleGit(LOCAL)
  await g.init(['--initial-branch=main'])
  await g.addRemote('origin', REMOTE)
  await g.fetch('origin')

  const rev = await g.raw(['rev-parse', '--verify', 'origin/main'])
  console.log(`    remote branch resolved: ${rev.trim().slice(0, 8)}...`)

  // 3. List and read remote files (simulating GitService.sync)
  console.log('[2] Listing remote files...')
  const sums_list = await g.raw(['ls-tree', '-r', '--name-only', 'origin/main:sums/'])
  const data_list = await g.raw(['ls-tree', '-r', '--name-only', 'origin/main:data/'])
  console.log('    sums/ files:', sums_list.trim().split('\n').filter(Boolean))
  console.log('    data/ files:', data_list.trim().split('\n').filter(Boolean))

  // 4. Write remote files to local directories
  console.log('[3] Writing remote files to local...')
  for (const dir of ['sums', 'data']) {
    const dir_path = join(LOCAL, dir)
    if (!existsSync(dir_path)) mkdirSync(dir_path, { recursive: true })

    const list = await g.raw(['ls-tree', '-r', '--name-only', `origin/main:${dir}/`])
    const files = list.trim().split('\n').filter(Boolean)

    for (const f of files) {
      const content = await g.show([`origin/main:${dir}/${f}`])
      writeFileSync(join(dir_path, f), content, 'utf-8')
      console.log(`    wrote ${dir}/${f} (${content.length} bytes)`)
    }
  }

  // 5. Verify files exist on disk
  console.log('[4] Verifying local files...')
  for (const f of ['sums/2026-05-15.md', 'sums/2026-05-20.md', 'data/focus_sessions.json']) {
    const p = join(LOCAL, f)
    console.log(`    ${f}: ${existsSync(p) ? 'OK (' + readFileSync(p, 'utf-8').length + ' bytes)' : 'MISSING!'}`)
  }

  // 6. Initialize sql.js database and run schema
  console.log('[5] Initializing sql.js database...')
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run('PRAGMA foreign_keys = ON')

  const schema = readFileSync(SCHEMA_PATH, 'utf-8')
  db.run(schema)
  console.log('    Schema loaded, tables:',
    db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")[0]?.values?.map(r => r[0]).join(', ') || 'none')

  // 7. Import sessions from JSON (simulating import_sessions_to_db)
  console.log('[6] Importing sessions from focus_sessions.json...')
  const json_path = join(LOCAL, 'data', 'focus_sessions.json')
  const json_data = JSON.parse(readFileSync(json_path, 'utf-8'))
  console.log(`    JSON entries: ${Object.keys(json_data).length}`)

  let imported_count = 0
  for (const [uuid, session] of Object.entries(json_data)) {
    try {
      db.run(
        `INSERT OR IGNORE INTO focus_sessions
         (uuid, subject, planned_duration_min, actual_duration_sec, rest_duration_sec, status, started_at, ended_at, date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid,
          session.subject || '',
          session.planned_duration_min || 0,
          session.actual_duration_sec || 0,
          session.rest_duration_sec || 0,
          session.status || 'completed',
          session.started_at || '',
          session.ended_at || null,
          session.date || ''
        ]
      )
      const changes = db.exec('SELECT changes()')
      if (changes.length > 0 && changes[0].values[0][0] > 0) {
        imported_count++
      }
    } catch (e) {
      console.log(`    ERROR importing ${uuid.slice(0,8)}...:`, e.message)
    }
  }
  console.log(`    Imported: ${imported_count}`)

  // 8. Verify sessions in DB
  console.log('[7] Verifying sessions in DB...')
  const sessions_result = db.exec("SELECT uuid, subject, date, actual_duration_sec FROM focus_sessions")
  if (sessions_result.length > 0) {
    for (const row of sessions_result[0].values) {
      console.log(`    ${row[0].slice(0,8)}... | ${row[2]} | ${row[1]} | ${Math.floor(row[3]/60)} min`)
    }
  } else {
    console.log('    NO SESSIONS IN DB — IMPORT FAILED!')
  }

  // 9. Run stats queries (simulating what the stats page does)
  console.log('[8] Running stats queries...')

  // Get distinct dates with completed sessions
  const dates_result = db.exec(
    "SELECT DISTINCT date FROM focus_sessions WHERE status = 'completed' ORDER BY date"
  )
  const dates = dates_result.length > 0 ? dates_result[0].values.map(r => r[0]) : []
  console.log(`    Dates with completed sessions: ${dates.join(', ') || 'NONE'}`)

  // Weekly stats for May 12 week (contains May 15)
  const weekly = db.exec(
    `SELECT date, SUM(actual_duration_sec) as total_seconds
     FROM focus_sessions
     WHERE date >= '2026-05-12' AND date < date('2026-05-12', '+7 days') AND status = 'completed'
     GROUP BY date ORDER BY date`
  )
  console.log('    Weekly stats (May 12-18):')
  if (weekly.length > 0) {
    for (const row of weekly[0].values) {
      console.log(`      ${row[0]}: ${Math.floor(row[1]/60)} min`)
    }
  } else {
    console.log('      NO DATA')
  }

  // Monthly stats for May 2026
  const monthly = db.exec(
    `SELECT date, SUM(actual_duration_sec) as total_seconds
     FROM focus_sessions
     WHERE strftime('%Y-%m', date) = '2026-05' AND status = 'completed'
     GROUP BY date ORDER BY date`
  )
  console.log('    Monthly stats (2026-05):')
  if (monthly.length > 0) {
    for (const row of monthly[0].values) {
      console.log(`      ${row[0]}: ${Math.floor(row[1]/60)} min`)
    }
  } else {
    console.log('      NO DATA')
  }

  // Focus items breakdown
  const items = db.exec(
    `SELECT COALESCE(NULL, fs.subject) as label, '#FFB7C5' as color,
            SUM(fs.actual_duration_sec) as total_seconds
     FROM focus_sessions fs
     WHERE fs.date BETWEEN '2026-05-01' AND '2026-05-31' AND fs.status = 'completed'
     GROUP BY label ORDER BY total_seconds DESC`
  )
  console.log('    Focus items (May 2026):')
  if (items.length > 0) {
    for (const row of items[0].values) {
      console.log(`      ${row[0]}: ${Math.floor(row[2]/60)} min`)
    }
  } else {
    console.log('      NO DATA')
  }

  // 10. Simulate DiaryService.generate — regenerate diaries from DB
  console.log('[9] Simulating diary regeneration...')
  for (const date of dates) {
    const day_sessions = db.exec(
      `SELECT * FROM focus_sessions WHERE date = '${date}' AND status = 'completed'`
    )
    const count = day_sessions.length > 0 ? day_sessions[0].values.length : 0

    let total_sec = 0
    if (day_sessions.length > 0) {
      for (const s of day_sessions[0].values) {
        total_sec += (s[3] || 0)  // actual_duration_sec is column index 3 in schema
      }
    }

    // Actually, let me do this more carefully
    const total_result = db.exec(
      `SELECT SUM(actual_duration_sec) FROM focus_sessions WHERE date = '${date}' AND status = 'completed'`
    )
    const total = total_result.length > 0 ? total_result[0].values[0][0] : 0
    const hours = Math.floor(total / 3600)
    const mins = Math.floor((total % 3600) / 60)
    console.log(`    ${date}: ${hours}h ${mins}m, ${count} sessions`)

    // Insert/update diary entry
    const existing = db.exec(`SELECT id FROM diary_entries WHERE date = '${date}'`)
    if (existing.length > 0 && existing[0].values.length > 0) {
      db.run("UPDATE diary_entries SET summary_text = ?, file_path = ?, updated_at = datetime('now') WHERE date = ?",
        [`# Diary - ${date}\n\nTotal: ${hours}h ${mins}m`, `/sums/${date}.md`, date])
    } else {
      db.run('INSERT INTO diary_entries (date, summary_text, file_path) VALUES (?, ?, ?)',
        [date, `# Diary - ${date}\n\nTotal: ${hours}h ${mins}m`, `/sums/${date}.md`])
    }
  }

  // 11. Verify diary_entries
  const diary_result = db.exec('SELECT date, summary_text FROM diary_entries ORDER BY date')
  console.log('    diary_entries:')
  if (diary_result.length > 0) {
    for (const row of diary_result[0].values) {
      console.log(`      ${row[0]}: ${row[1] ? String(row[1]).slice(0, 50) : '(empty)'}`)
    }
  }

  // 12. Final verdict
  console.log('\n========================================')
  console.log('FINAL VERDICT:')
  const session_count = sessions_result.length > 0 ? sessions_result[0].values.length : 0
  const diary_count = diary_result.length > 0 ? diary_result[0].values.length : 0
  const has_stats = weekly.length > 0 && weekly[0].values.length > 0

  console.log(`  focus_sessions: ${session_count} rows`)
  console.log(`  diary_entries: ${diary_count} rows`)
  console.log(`  May stats queryable: ${has_stats ? 'YES' : 'NO'}`)

  if (session_count >= 5 && diary_count >= 2 && has_stats) {
    console.log('  *** SUCCESS: Full sync pipeline works correctly ***')
  } else {
    console.log('  *** FAILURE: Something is broken in the pipeline ***')
  }
  console.log('========================================')

  db.close()
  console.log('\nDone.')
}

main().catch(e => {
  console.error('Integration test error:', e)
  process.exit(1)
})
