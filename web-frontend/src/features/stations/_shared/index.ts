/**
 * KNOUX Repair — station foundation barrel (Phase 00).
 * Future stations compose these primitives with their OWN domain UI.
 */
export * from './contracts';
export {
  outcomeFromEnvelope,
  outcomeFromRunEnvelope,
  normalizeEnvelopeStatus,
  readEnvelopeField,
  readEnvelopeNumber,
  readEnvelopeBoolean,
  readEnvelopeText,
  buildStationHistoryRow,
} from './executionSemantics';
export type {
  EnvelopeOutcome,
  ResultEnvelopeLike,
  StationHistoryRow,
  BuildHistoryRowInput,
} from './executionSemantics';
export { snapshotFromTools, loadRegistrySnapshot, loadCategoryTools, loadToolMetadata, isRegistryUnavailable } from './StationToolRegistry';
export {
  UNVERIFIED_TOOL_IDS,
  isRuntimeVerified,
  isMutatingRisk,
  classifyExposure,
  canExposeAction,
  exposureBlockReason,
  exposeTools,
  partitionForExposure,
} from './capabilityGate';
export type { ExposureClass } from './capabilityGate';
export type { RegistrySnapshot } from './StationToolRegistry';
export { decideExecution, startExecution, pollExecution, pollUntilTerminal, requestConfirmedCancel, normalizeExecutionMode, outcomeLabelForRun, historyMessageForRun, cancelExecution, runStatusToState, rememberRun, recallRun, forgetRun } from './StationExecutionController';
export type { ExecutionRequestInput, ExecutionDecision, ConfirmedCancelOptions, RememberedRun } from './StationExecutionController';
export { probeBridge, waitForBridgeReady, copyTechnicalDetails } from './bridgeLifecycle';
export type { BridgeLifecycleState, ProbeResult } from './bridgeLifecycle';
export { default as StationOfflineState } from './StationOfflineState';
export { default as StationErrorBoundary } from './StationErrorBoundary';
export { default as StationRunProgress } from './StationRunProgress';
export { default as StationActiveRunBanner } from './StationActiveRunBanner';
export type { RunBannerAccent } from './StationActiveRunBanner';
export { default as StationResultRenderer } from './StationResultRenderer';
export { default as StationEvidenceViewer } from './StationEvidenceViewer';
export { default as StationHistory } from './StationHistory';
export type { HistoryEntry } from './StationHistory';
export { default as StationPermissionGate } from './StationPermissionGate';
export { StationDeepLink } from './StationDeepLink';
