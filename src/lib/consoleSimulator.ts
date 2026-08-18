import { useCallback, useRef } from 'react';

export type ConsoleEntryType = 'info' | 'success' | 'error' | 'warning' | 'system' | 'data';

export interface ConsoleEntry {
  id: number;
  text: string;
  type: ConsoleEntryType;
  timestamp: string;
}

export interface ConsoleLineDef {
  text: string;
  type: ConsoleEntryType;
  delay: number;
}

export function buildToolSimulation(
  tool: { Id: string; Name: string; Risk: string; RequiresAdmin: boolean },
  addEntry: (text: string, type: ConsoleEntryType) => void,
  onDone: (finalStatus: 'success' | 'error') => void,
  onLineCount: (count: number) => void,
): ConsoleLineDef[] {
  const id = tool.Id;
  const name = tool.Name;
  const risk = tool.Risk;
  const isDestructive = risk === 'DESTRUCTIVE';
  const isReadOnly = risk === 'READ_ONLY';
  const lines: ConsoleLineDef[] = [];

  const push = (text: string, type: ConsoleEntryType = 'info', delay = 0) => {
    lines.push({ text, type, delay });
  };

  const sys = (msg: string) => push(`[SYS] ${msg}`, 'system', 80);
  const ok = (msg: string) => push(`[  OK] ${msg}`, 'success', 60);
  const warn = (msg: string) => push(`[WARN] ${msg}`, 'warning', 120);
  const err = (msg: string) => push(`[ERR!] ${msg}`, 'error', 200);
  const info = (msg: string) => push(msg, 'info', 70);
  const data = (msg: string) => push(msg, 'data', 50);

  sys(`NEXUS CORE // MODULE INIT: ${id}`);
  sys(`Target: ${name}`);
  sys(`Risk classification: ${risk.replace(/_/g, ' ')}`);
  sys(`Admin elevation: ${tool.RequiresAdmin ? 'REQUIRED' : 'NOT REQUIRED'}`);
  push('', 'system', 100);
  info(`Loading module manifest for ${id}...`);
  data(`  File: Scripts/${id.substring(0, 2).toLowerCase()}/${tool.Id}-${name.replace(/\s+/g, '')}.ps1`);
  data(`  Hash: SHA256:${generateHash(16)}`);
  data(`  Signed: YES // Verified: TRUE`);
  push('', 'info', 60);

  info(`Capturing pre-execution system snapshot...`);
  data(`  OS: Windows NT 10.0.${19045 + Math.floor(Math.random() * 50)}`);
  data(`  Uptime: ${Math.floor(Math.random() * 72)}h ${Math.floor(Math.random() * 59)}m`);
  data(`  Free Memory: ${(Math.random() * 8 + 2).toFixed(1)} GB / 16.0 GB`);
  data(`  Disk C:\\ Free: ${(Math.random() * 200 + 50).toFixed(0)} GB`);
  push('', 'info', 80);

  info(`Initializing telemetry capture...`);
  ok(`Telemetry channel established`);
  info(`Scanning system state...`);
  data(`  Services: ${Math.floor(Math.random() * 50 + 200)} running, ${Math.floor(Math.random() * 10 + 5)} paused`);
  data(`  Processes: ${Math.floor(Math.random() * 100 + 300)} active`);
  data(`  Network: ${Math.floor(Math.random() * 5 + 1)} adapters online`);

  if (isDestructive) {
    push('', 'warning', 150);
    warn(`═══════════════════════════════════════════════`);
    warn(`  DESTRUCTIVE OPERATION DETECTED`);
    warn(`  Module: ${id} // Risk: ${risk}`);
    warn(`  Changes will modify system state permanently`);
    warn(`═══════════════════════════════════════════════`);
    push('', 'warning', 200);
  }

  info(`Reading configuration parameters...`);
  data(`  Timeout: 300s`);
  data(`  Retry policy: exponential backoff`);
  data(`  Log level: VERBOSE`);

  if (tool.RequiresAdmin) {
    info(`Verifying administrator privileges...`);
    ok(`Admin token confirmed — elevation valid`);
  }

  push('', 'info', 100);
  info(`Executing diagnostic sequence...`);
  push(`  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`, 'info', 40);

  if (isReadOnly) {
    data(`  Phase 1/3: Collecting system data...`);
    data(`  ${Math.floor(Math.random() * 500 + 200)} items scanned`);
    data(`  Phase 2/3: Analyzing results...`);
    data(`  ${Math.floor(Math.random() * 50 + 10)} findings recorded`);
    data(`  Phase 3/3: Generating summary...`);
    ok(`Read-only analysis complete — no system changes made`);
  } else {
    data(`  Phase 1/4: Pre-flight validation...`);
    ok(`Pre-flight checks passed`);
    data(`  Phase 2/4: Creating restore point...`);
    ok(`Restore point: RP-${Date.now().toString(36).toUpperCase()}`);
    data(`  Phase 3/4: Applying changes...`);

    const itemCount = Math.floor(Math.random() * 30 + 5);
    for (let j = 1; j <= itemCount; j++) {
      data(`    [${j}/${itemCount}] Processing item ${generateHash(6)}...`);
    }

    data(`  Phase 4/4: Post-execution validation...`);
    ok(`Post-validation passed`);
  }

  push(`  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`, 'info', 40);
  push('', 'info', 60);

  info(`Generating result manifest...`);
  data(`  Duration: ${(Math.random() * 8 + 1).toFixed(1)}s`);
  data(`  Items processed: ${Math.floor(Math.random() * 500 + 100)}`);
  data(`  Errors: 0`);

  push('', 'info', 100);
  sys(`MODULE ${id} // STATUS: COMPLETE`);
  const finalType = Math.random() > 0.05 ? 'success' : 'error';
  if (finalType === 'success') {
    ok(`Module ${id} finished successfully`);
  } else {
    err(`Module ${id} encountered a non-critical error — partial results available`);
  }

  return lines;
}

function generateHash(len: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export function useTypewriterRunner() {
  const timersRef = useRef<number[]>([]);

  const cancel = useCallback(() => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
  }, []);

  const run = useCallback((
    lines: ConsoleLineDef[],
    addEntry: (text: string, type: ConsoleEntryType) => void,
    onDone: (finalStatus: 'success' | 'error') => void,
  ) => {
    cancel();
    let cumulativeDelay = 0;
    const isFinalError = lines[lines.length - 1]?.type === 'error';

    lines.forEach((line, i) => {
      cumulativeDelay += line.delay;
      const tid = window.setTimeout(() => {
        addEntry(line.text, line.type);
        if (i === lines.length - 1) {
          onDone(isFinalError ? 'error' : 'success');
        }
      }, cumulativeDelay);
      timersRef.current.push(tid);
    });
  }, [cancel]);

  return { run, cancel };
}
