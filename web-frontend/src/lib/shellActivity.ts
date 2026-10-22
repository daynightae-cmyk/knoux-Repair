/**
 * KNOuX Repair — Shell Activity
 *
 * The execution dock is the one place where work is visible. A tool run
 * is one kind of work; a guided investigation that reads several bridge
 * endpoints (AI Scan) is another. Both are described by the same small
 * contract so the dock never needs a second implementation.
 *
 * Every stage and every line here is produced by real work. Nothing is
 * simulated, and a stage that has not run stays idle.
 */

export type ShellActivityStatus = 'running' | 'success' | 'error' | 'inconclusive';

export type ShellActivityStageState = 'idle' | 'active' | 'done' | 'failed';

export interface ShellActivityStage {
  id: string;
  label: string;
  state: ShellActivityStageState;
}

export interface ShellActivityLine {
  id: number;
  text: string;
  type: 'info' | 'error';
  timestamp: string;
}

export interface ShellActivity {
  /** Stable identity of the activity, used to replace a previous one. */
  id: string;
  title: string;
  status: ShellActivityStatus;
  stages: ShellActivityStage[];
  lines: ShellActivityLine[];
  startedAt: number;
}

let lineCounter = 0;

export function activityLine(text: string, type: 'info' | 'error' = 'info'): ShellActivityLine {
  lineCounter += 1;
  return {
    id: lineCounter,
    text,
    type,
    timestamp: new Date().toLocaleTimeString(),
  };
}

export function emptyActivity(id: string, title: string, stages: ShellActivityStage[]): ShellActivity {
  return {
    id,
    title,
    status: 'running',
    stages,
    lines: [],
    startedAt: Date.now(),
  };
}
