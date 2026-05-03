#!/usr/bin/env node
/**
 * Round 5 taskboard CLI — reads docs/plans/round5-taskboard.yaml and the
 * per-task claim files under docs/plans/round5-claims/*.yaml, then exposes:
 *
 *   list-ready                    — task IDs with status:todo and all deps done
 *   claim     <task-id> <owner>   — atomic file create (non-zero if exists)
 *   complete  <task-id> <ev[,ev]> — mark claim done, append evidence paths
 *   status                        — summary counts + blocked list
 *
 * Usage:
 *   npx tsx scripts/round5-taskboard.ts list-ready
 *   npx tsx scripts/round5-taskboard.ts claim A-1 header-surgeon
 *   npx tsx scripts/round5-taskboard.ts complete A-1 docs/plans/round5-evidence/A-home-row.png
 *   npx tsx scripts/round5-taskboard.ts status
 *
 * Dependencies: Node stdlib only. No js-yaml. A tiny hand-rolled YAML
 * parser + serializer covers the constrained schema used by the board
 * and claim files. This keeps the critical-path tooling free of external
 * deps so Agent 9's lock primitive cannot be broken by npm flakiness.
 */

import {
  closeSync,
  constants as fsConstants,
  existsSync,
  openSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- Paths ----------

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const BOARD_YAML = join(REPO_ROOT, 'docs/plans/round5-taskboard.yaml');
const CLAIMS_DIR = join(REPO_ROOT, 'docs/plans/round5-claims');
const TEMPLATE_BASENAME = '_template.yaml';
const README_BASENAME = 'README.md';

// ---------- Types ----------

type Status = 'todo' | 'claimed' | 'in-progress' | 'blocked' | 'done';

interface BoardTask {
  id: string;
  title: string;
  team: string;
  depends_on: string[];
  status: Status;
  acceptance_anchor: string;
  notes: string;
}

interface Claim {
  task_id: string;
  owner: string;
  status: Status;
  claimed_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  blocker: string | null;
  notes: string;
  evidence: string[];
  commits: string[];
}

// ---------- Minimal YAML helpers ----------
// We support the narrow shape of round5-taskboard.yaml + claim files:
//   - top-level scalars, lists, nested maps (2-space indent)
//   - flow-style inline lists: [a, b, c]
//   - block-style lists:   - item
//   - quoted + unquoted scalars, `null`, numbers, booleans
// This is NOT a general YAML parser — it is just enough for this repo.

type YamlValue = string | number | boolean | null | YamlValue[] | { [k: string]: YamlValue };

function stripComment(raw: string): string {
  // Preserve `#` inside quoted strings; strip anything after an unquoted `#`.
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === '#' && !inSingle && !inDouble) return raw.slice(0, i).trimEnd();
  }
  return raw.trimEnd();
}

function parseScalar(raw: string): YamlValue {
  const s = raw.trim();
  if (s === '' || s === '~' || s === 'null' || s === 'Null' || s === 'NULL') return null;
  if (s === 'true' || s === 'True' || s === 'TRUE') return true;
  if (s === 'false' || s === 'False' || s === 'FALSE') return false;
  if (/^-?\d+$/.test(s)) return Number.parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return Number.parseFloat(s);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  // Flow-style inline list: [a, b, c]
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (inner === '') return [];
    return splitFlowItems(inner).map((item) => parseScalar(item));
  }
  return s;
}

function splitFlowItems(inner: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  let inSingle = false;
  let inDouble = false;
  for (const ch of inner) {
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    if (!inSingle && !inDouble) {
      if (ch === '[' || ch === '{') depth += 1;
      else if (ch === ']' || ch === '}') depth -= 1;
      else if (ch === ',' && depth === 0) {
        out.push(buf.trim());
        buf = '';
        continue;
      }
    }
    buf += ch;
  }
  if (buf.trim() !== '') out.push(buf.trim());
  return out;
}

interface Line {
  indent: number;
  text: string;
  rawIndex: number;
}

function tokenizeYaml(src: string): Line[] {
  const out: Line[] = [];
  const lines = src.split(/\r?\n/);
  lines.forEach((raw, idx) => {
    const stripped = stripComment(raw);
    if (stripped.trim() === '') return;
    const indent = stripped.length - stripped.trimStart().length;
    out.push({ indent, text: stripped.slice(indent), rawIndex: idx });
  });
  return out;
}

function parseYaml(src: string): YamlValue {
  const lines = tokenizeYaml(src);
  const [value] = parseBlock(lines, 0, 0);
  return value;
}

function parseBlock(lines: Line[], startIdx: number, indent: number): [YamlValue, number] {
  if (startIdx >= lines.length) return [null, startIdx];
  const first = lines[startIdx];
  if (first.indent < indent) return [null, startIdx];
  if (first.text.startsWith('- ') || first.text === '-') {
    return parseList(lines, startIdx, indent);
  }
  return parseMap(lines, startIdx, indent);
}

function parseMap(
  lines: Line[],
  startIdx: number,
  indent: number,
): [Record<string, YamlValue>, number] {
  const map: Record<string, YamlValue> = {};
  let i = startIdx;
  while (i < lines.length) {
    const line = lines[i];
    if (line.indent < indent) break;
    if (line.indent > indent) {
      // unexpected — let caller handle
      break;
    }
    const colonIdx = findUnquotedColon(line.text);
    if (colonIdx < 0) break;
    const key = line.text.slice(0, colonIdx).trim();
    const rest = line.text.slice(colonIdx + 1).trim();
    if (rest === '') {
      // nested block starts on next line
      const next = lines[i + 1];
      if (!next || next.indent <= indent) {
        map[key] = null;
        i += 1;
        continue;
      }
      const [childVal, nextI] = parseBlock(lines, i + 1, next.indent);
      map[key] = childVal;
      i = nextI;
    } else {
      map[key] = parseScalar(rest);
      i += 1;
    }
  }
  return [map, i];
}

function parseList(lines: Line[], startIdx: number, indent: number): [YamlValue[], number] {
  const list: YamlValue[] = [];
  let i = startIdx;
  while (i < lines.length) {
    const line = lines[i];
    if (line.indent < indent) break;
    if (line.indent > indent) break;
    if (!line.text.startsWith('-')) break;
    const after = line.text.slice(1).trimStart();
    if (after === '') {
      // block child on next line
      const next = lines[i + 1];
      if (!next || next.indent <= indent) {
        list.push(null);
        i += 1;
        continue;
      }
      const [child, nextI] = parseBlock(lines, i + 1, next.indent);
      list.push(child);
      i = nextI;
    } else if (findUnquotedColon(after) >= 0) {
      // inline first key of a map entry
      // Synthesize a fake line list: first line at deeper indent, rest follow.
      const pseudoIndent = indent + 2;
      const synthetic: Line[] = [{ indent: pseudoIndent, text: after, rawIndex: line.rawIndex }];
      let j = i + 1;
      while (j < lines.length && lines[j].indent >= pseudoIndent) {
        synthetic.push(lines[j]);
        j += 1;
      }
      const [child] = parseMap(synthetic, 0, pseudoIndent);
      list.push(child);
      i = j;
    } else {
      list.push(parseScalar(after));
      i += 1;
    }
  }
  return [list, i];
}

function findUnquotedColon(text: string): number {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === ':' && !inSingle && !inDouble) {
      const nxt = text[i + 1];
      if (nxt === undefined || nxt === ' ' || nxt === '\t') return i;
    }
  }
  return -1;
}

// ---------- YAML emit (claim files only — tight schema) ----------

function yamlQuote(s: string): string {
  if (s === '') return '""';
  if (/^[A-Za-z0-9_\-.\/:@]+$/.test(s) && !/^(true|false|null|yes|no|on|off)$/i.test(s)) {
    return s;
  }
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function emitClaim(claim: Claim): string {
  const lines: string[] = [];
  lines.push(`task_id: ${yamlQuote(claim.task_id)}`);
  lines.push(`owner: ${yamlQuote(claim.owner)}`);
  lines.push(`status: ${claim.status}`);
  lines.push(`claimed_at: ${claim.claimed_at === null ? 'null' : yamlQuote(claim.claimed_at)}`);
  lines.push(`started_at: ${claim.started_at === null ? 'null' : yamlQuote(claim.started_at)}`);
  lines.push(
    `completed_at: ${claim.completed_at === null ? 'null' : yamlQuote(claim.completed_at)}`,
  );
  lines.push(`blocker: ${claim.blocker === null ? 'null' : yamlQuote(claim.blocker)}`);
  lines.push(`notes: ${yamlQuote(claim.notes)}`);
  if (claim.evidence.length === 0) {
    lines.push('evidence: []');
  } else {
    lines.push('evidence:');
    for (const e of claim.evidence) lines.push(`  - ${yamlQuote(e)}`);
  }
  if (claim.commits.length === 0) {
    lines.push('commits: []');
  } else {
    lines.push('commits:');
    for (const c of claim.commits) lines.push(`  - ${yamlQuote(c)}`);
  }
  return `${lines.join('\n')}\n`;
}

// ---------- Board + claim loaders ----------

function loadBoardTasks(): BoardTask[] {
  const raw = readFileSync(BOARD_YAML, 'utf8');
  const parsed = parseYaml(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('round5-taskboard.yaml: expected top-level map');
  }
  const rawTasks = (parsed as Record<string, YamlValue>).tasks;
  if (!Array.isArray(rawTasks)) {
    throw new Error('round5-taskboard.yaml: missing `tasks:` list');
  }
  return rawTasks.map((t, idx) => {
    if (!t || typeof t !== 'object' || Array.isArray(t)) {
      throw new Error(`tasks[${idx}]: expected map`);
    }
    const m = t as Record<string, YamlValue>;
    const id = asString(m.id, `tasks[${idx}].id`);
    const deps = Array.isArray(m.depends_on)
      ? (m.depends_on as YamlValue[]).map((d) => asString(d, `${id}.depends_on`))
      : [];
    return {
      id,
      title: asString(m.title, `${id}.title`),
      team: asString(m.team, `${id}.team`),
      depends_on: deps,
      status: (asString(m.status ?? 'todo', `${id}.status`) as Status) || 'todo',
      acceptance_anchor: asString(m.acceptance_anchor ?? '', `${id}.acceptance_anchor`),
      notes: asString(m.notes ?? '', `${id}.notes`),
    };
  });
}

function asString(v: YamlValue, label: string): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  throw new Error(`${label}: expected string, got ${typeof v}`);
}

function loadClaims(): Map<string, Claim> {
  const out = new Map<string, Claim>();
  if (!existsSync(CLAIMS_DIR)) return out;
  const entries = readdirSync(CLAIMS_DIR);
  for (const name of entries) {
    if (!name.endsWith('.yaml')) continue;
    if (name === TEMPLATE_BASENAME) continue;
    const file = join(CLAIMS_DIR, name);
    const parsed = parseYaml(readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    const m = parsed as Record<string, YamlValue>;
    const taskId = asString(m.task_id ?? name.replace(/\.yaml$/, ''), `${name}.task_id`);
    const expectedBasename = `${taskId}.yaml`;
    if (name !== expectedBasename) {
      console.error(
        `[round5-taskboard] warning: ${name} declares task_id=${taskId}; expected filename ${expectedBasename}`,
      );
    }
    out.set(taskId, {
      task_id: taskId,
      owner: asString(m.owner ?? '', `${taskId}.owner`),
      status: (asString(m.status ?? 'claimed', `${taskId}.status`) as Status) || 'claimed',
      claimed_at:
        m.claimed_at === null || m.claimed_at === undefined
          ? null
          : asString(m.claimed_at, `${taskId}.claimed_at`),
      started_at:
        m.started_at === null || m.started_at === undefined
          ? null
          : asString(m.started_at, `${taskId}.started_at`),
      completed_at:
        m.completed_at === null || m.completed_at === undefined
          ? null
          : asString(m.completed_at, `${taskId}.completed_at`),
      blocker:
        m.blocker === null || m.blocker === undefined
          ? null
          : asString(m.blocker, `${taskId}.blocker`),
      notes: asString(m.notes ?? '', `${taskId}.notes`),
      evidence: Array.isArray(m.evidence)
        ? (m.evidence as YamlValue[]).map((e) => asString(e, `${taskId}.evidence`))
        : [],
      commits: Array.isArray(m.commits)
        ? (m.commits as YamlValue[]).map((c) => asString(c, `${taskId}.commits`))
        : [],
    });
  }
  return out;
}

function effectiveStatus(task: BoardTask, claims: Map<string, Claim>): Status {
  const claim = claims.get(task.id);
  if (!claim) return task.status;
  return claim.status;
}

// ---------- Commands ----------

function cmdListReady(): void {
  const tasks = loadBoardTasks();
  const claims = loadClaims();
  const ready: BoardTask[] = [];
  for (const task of tasks) {
    const status = effectiveStatus(task, claims);
    if (status !== 'todo') continue;
    const depsDone = task.depends_on.every((depId) => {
      const depTask = tasks.find((t) => t.id === depId);
      if (!depTask) return false;
      return effectiveStatus(depTask, claims) === 'done';
    });
    if (depsDone) ready.push(task);
  }
  if (ready.length === 0) {
    process.stdout.write('(no ready tasks)\n');
    return;
  }
  for (const t of ready) {
    const deps = t.depends_on.length === 0 ? '—' : t.depends_on.join(',');
    process.stdout.write(`${t.id}\t${t.team}\t[deps:${deps}]\t${t.title}\n`);
  }
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function cmdClaim(args: string[]): number {
  const [taskId, owner] = args;
  if (!taskId || !owner) {
    process.stderr.write('usage: claim <task-id> <owner>\n');
    return 2;
  }
  const tasks = loadBoardTasks();
  if (!tasks.some((t) => t.id === taskId)) {
    process.stderr.write(`error: unknown task_id ${taskId}\n`);
    return 2;
  }
  const target = join(CLAIMS_DIR, `${taskId}.yaml`);
  // O_CREAT|O_EXCL → atomic create. EEXIST on second caller.
  let fd: number;
  try {
    fd = openSync(target, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY, 0o644);
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'EEXIST') {
      process.stderr.write(
        `error: ${taskId}.yaml already exists — another agent claimed this task\n`,
      );
      return 1;
    }
    throw err;
  }
  const claim: Claim = {
    task_id: taskId,
    owner,
    status: 'claimed',
    claimed_at: nowIso(),
    started_at: null,
    completed_at: null,
    blocker: null,
    notes: '',
    evidence: [],
    commits: [],
  };
  writeSync(fd, emitClaim(claim));
  closeSync(fd);
  process.stdout.write(`claimed ${taskId} as ${owner} → ${target}\n`);
  return 0;
}

function cmdComplete(args: string[]): number {
  const [taskId, evidenceArg] = args;
  if (!taskId) {
    process.stderr.write('usage: complete <task-id> <evidence-path[,evidence-path...]>\n');
    return 2;
  }
  const target = join(CLAIMS_DIR, `${taskId}.yaml`);
  if (!existsSync(target)) {
    process.stderr.write(`error: ${taskId}.yaml does not exist — claim it first\n`);
    return 1;
  }
  const parsed = parseYaml(readFileSync(target, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    process.stderr.write(`error: ${target} is not a map\n`);
    return 1;
  }
  const m = parsed as Record<string, YamlValue>;
  const evidence = evidenceArg
    ? evidenceArg
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const existingEvidence = Array.isArray(m.evidence)
    ? (m.evidence as YamlValue[]).map((e) => asString(e, 'evidence'))
    : [];
  const existingCommits = Array.isArray(m.commits)
    ? (m.commits as YamlValue[]).map((e) => asString(e, 'commits'))
    : [];
  const merged: Claim = {
    task_id: asString(m.task_id ?? taskId, 'task_id'),
    owner: asString(m.owner ?? '', 'owner'),
    status: 'done',
    claimed_at:
      m.claimed_at === null || m.claimed_at === undefined
        ? null
        : asString(m.claimed_at, 'claimed_at'),
    started_at:
      m.started_at === null || m.started_at === undefined
        ? null
        : asString(m.started_at, 'started_at'),
    completed_at: nowIso(),
    blocker: null,
    notes: asString(m.notes ?? '', 'notes'),
    evidence: [...existingEvidence, ...evidence],
    commits: existingCommits,
  };
  writeFileSync(target, emitClaim(merged), 'utf8');
  process.stdout.write(`completed ${taskId} — ${target}\n`);
  return 0;
}

function cmdStatus(): void {
  const tasks = loadBoardTasks();
  const claims = loadClaims();
  const counts: Record<Status, number> = {
    todo: 0,
    claimed: 0,
    'in-progress': 0,
    blocked: 0,
    done: 0,
  };
  const blocked: BoardTask[] = [];
  for (const task of tasks) {
    const status = effectiveStatus(task, claims);
    counts[status] = (counts[status] ?? 0) + 1;
    if (status === 'blocked') blocked.push(task);
  }
  process.stdout.write(`total tasks: ${tasks.length}\n`);
  for (const key of ['todo', 'claimed', 'in-progress', 'blocked', 'done'] as const) {
    process.stdout.write(`  ${key.padEnd(12)} ${counts[key]}\n`);
  }
  if (blocked.length > 0) {
    process.stdout.write('\nblocked:\n');
    for (const t of blocked) {
      const c = claims.get(t.id);
      const blocker = c?.blocker ?? '?';
      process.stdout.write(`  ${t.id}\t${blocker}\t${t.title}\n`);
    }
  }
}

// ---------- Entry ----------

function main(argv: string[]): number {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'list-ready':
      cmdListReady();
      return 0;
    case 'claim':
      return cmdClaim(rest);
    case 'complete':
      return cmdComplete(rest);
    case 'status':
      cmdStatus();
      return 0;
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      process.stdout.write(
        'usage: round5-taskboard <list-ready|claim|complete|status> [args...]\n',
      );
      return cmd ? 0 : 2;
    default:
      process.stderr.write(`unknown command: ${cmd}\n`);
      return 2;
  }
}

process.exit(main(process.argv.slice(2)));
