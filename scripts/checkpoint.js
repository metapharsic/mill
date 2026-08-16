#!/usr/bin/env node
/**
 * Checkpoint generator — token-free progress tracking.
 *
 * Single source of truth: ../checkpoint.json
 * Renders: ../CHECKPOINT.md  (phases sidebar + progress bars + last-done banner)
 *
 * USAGE (do NOT hand-edit CHECKPOINT.md — always run this):
 *   node scripts/checkpoint.js
 *       -> just regenerate CHECKPOINT.md from checkpoint.json
 *
 *   node scripts/checkpoint.js done <id> "<what was done>"
 *       -> set item <id> status=done, record last-done summary, bump date, regenerate
 *       e.g. node scripts/checkpoint.js done P3 "Seeded 20 dept-head logins"
 *
 *   node scripts/checkpoint.js set <id> <status> "<what was done>"
 *       -> set any status: done|partial|proposed|todo|reserved
 *       e.g. node scripts/checkpoint.js set P1 partial "Built store_indents table only"
 *
 * <id> matches a phase number (1..14) or a P#/F#/M# id.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STATE = path.join(ROOT, 'checkpoint.json');
const OUT = path.join(ROOT, 'CHECKPOINT.md');

const ICON = { done: '✅', partial: '🟡', proposed: '🔵', todo: '⬜', reserved: '➖' };
const today = () => new Date().toISOString().slice(0, 10);

function load() { return JSON.parse(fs.readFileSync(STATE, 'utf8')); }
function save(s) { fs.writeFileSync(STATE, JSON.stringify(s, null, 2) + '\n'); }

function findItem(s, id) {
  const key = String(id);
  for (const grp of ['phases', 'proposed', 'forms', 'migrations', 'deploy'])
    for (const it of (s[grp] || [])) if (String(it.id) === key) return it;
  return null;
}

function bar(done, total, width = 20) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const fill = total ? Math.round((done / total) * width) : 0;
  return `[${'#'.repeat(fill)}${'.'.repeat(width - fill)}] ${done}/${total} (${pct}%)`;
}

function countDone(arr) {
  // 'reserved' excluded from totals
  const real = arr.filter(x => x.status !== 'reserved');
  const done = real.filter(x => x.status === 'done').length;
  return { done, total: real.length };
}

function render(s) {
  s.deploy = s.deploy || [];
  const ph = countDone(s.phases);
  const pr = countDone(s.proposed);
  const fo = countDone(s.forms);
  const mi = countDone(s.migrations);
  const dp = countDone(s.deploy);

  // overall = all sections combined
  const all = [s.phases, s.proposed, s.forms, s.migrations, s.deploy].flat().filter(x => x.status !== 'reserved');
  const allDone = all.filter(x => x.status === 'done').length;

  const L = [];
  L.push('# MK Paper Mill ERP — CHECKPOINT');
  L.push('');
  L.push('> AUTO-GENERATED from `checkpoint.json` by `scripts/checkpoint.js`. Do NOT hand-edit.');
  L.push('');

  // ---- TOP BANNER: last done + overall progress (cheap to read) ----
  L.push('## ⏱ Last Done');
  L.push(`**${s.lastDone.date}** — ${s.lastDone.summary}`);
  L.push('');
  L.push('## 📊 Progress');
  L.push('```');
  L.push(`OVERALL    ${bar(allDone, all.length)}`);
  L.push(`Deploy     ${bar(dp.done, dp.total)}`);
  L.push(`Phases     ${bar(ph.done, ph.total)}`);
  L.push(`Proposed   ${bar(pr.done, pr.total)}`);
  L.push(`PaperForms ${bar(fo.done, fo.total)}`);
  L.push(`Migrations ${bar(mi.done, mi.total)}`);
  L.push('```');
  L.push('');

  // ---- DEPLOY TRACK ----
  if (s.deploy.length) {
    L.push('## 🚀 Deploy Track');
    L.push('```');
    for (const d of s.deploy) L.push(`${ICON[d.status] || '?'} ${d.id}  ${d.name}`);
    L.push('```');
    L.push('');
  }

  // ---- PHASES SIDEBAR (compact vertical rail) ----
  L.push('## ▍Phases Sidebar');
  L.push('```');
  for (const p of s.phases) {
    const ic = ICON[p.status] || '?';
    const num = String(p.id).padStart(2, ' ');
    L.push(`${ic} ${num}  ${p.name}`);
  }
  L.push('```');
  L.push('');

  // ---- Phase detail table ----
  L.push('## Phases (detail)');
  L.push('| # | Module | Route | Doc | Status |');
  L.push('|---|--------|-------|-----|:------:|');
  for (const p of s.phases)
    L.push(`| ${p.id} | ${p.name} | \`${p.route}\` | ${p.doc} | ${ICON[p.status]} |`);
  L.push('');

  // ---- Proposed ----
  L.push('## Proposed (designed, not coded)');
  L.push('| ID | Feature | Doc | Status |');
  L.push('|----|---------|-----|:------:|');
  for (const p of s.proposed)
    L.push(`| ${p.id} | ${p.name} | ${p.doc} | ${ICON[p.status]} |`);
  L.push('');

  // ---- Paper forms ----
  L.push('## Paper Forms -> ERP (from Paper Mill.pdf)');
  L.push('| ID | Form | Source | New table | Status |');
  L.push('|----|------|--------|-----------|:------:|');
  for (const f of s.forms)
    L.push(`| ${f.id} | ${f.name} | ${f.src} | \`${f.table}\` | ${ICON[f.status]} |`);
  L.push('');

  // ---- Migrations ----
  L.push('## DB Migrations');
  L.push('| ID | File | Status |');
  L.push('|----|------|:------:|');
  for (const m of s.migrations)
    L.push(`| ${m.id} | ${m.name} | ${ICON[m.status]} |`);
  L.push('');

  L.push('---');
  L.push(`Legend: ${ICON.done} done · ${ICON.partial} partial · ${ICON.proposed} proposed · ${ICON.todo} todo · ${ICON.reserved} reserved`);
  L.push('');
  L.push('Update: `node scripts/checkpoint.js done <id> "<summary>"`');
  L.push('');
  return L.join('\n');
}

// ---- main ----
const [, , cmd, id, a3, a4] = process.argv;
const s = load();

if (cmd === 'done' || cmd === 'set') {
  const it = findItem(s, id);
  if (!it) { console.error(`No item with id "${id}"`); process.exit(1); }
  const status = cmd === 'done' ? 'done' : a3;
  const summary = cmd === 'done' ? a3 : a4;
  if (!ICON[status]) { console.error(`Bad status "${status}"`); process.exit(1); }
  it.status = status;
  s.updated = today();
  if (summary) s.lastDone = { date: today(), summary: `[${it.id} ${it.name}] ${summary}` };
  save(s);
  console.log(`Updated ${it.id} -> ${status}`);
}

fs.writeFileSync(OUT, render(s));
console.log(`Wrote ${path.relative(ROOT, OUT)}`);
