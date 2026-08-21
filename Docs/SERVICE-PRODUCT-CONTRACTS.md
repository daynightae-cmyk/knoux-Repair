# KNOUX Service Product Contracts

## Data contract

Every product screen receives only one of three evidence states. A **snapshot** is a structured read-only bridge response. A **plan** is the result of an approved `analyze` or `preview` run. An **outcome** is a completed bridge job whose terminal status is `success`, `error`, or `cancelled`. The user interface must never construct values that look like a device measurement when no snapshot, plan, or outcome is present.

## Job lifecycle

| User-visible state | Source of truth | Required user actions |
| --- | --- | --- |
| Ready | Service snapshot has not started a job | Refresh, select a safe action. |
| Preparing | Bridge accepted the approved job | Cancel. |
| Working | Job status is `running` | Cancel, keep working elsewhere. |
| Review ready | `preview` or `analyze` completes successfully | Inspect result, choose supported action, return. |
| Completed | `run` completes successfully | View outcome, refresh service, export support evidence where relevant. |
| Needs attention | Job status is `error` | Read plain-language reason, retry safe step, open support evidence. |
| Stopped | Job status is `cancelled` | Retry or close. |

## Service action safety

A product action is available only when the matching manifest tool is present in the category and its declared capabilities allow the requested execution mode. Interfaces must show `Review` for preview/analyse tools rather than a destructive action. A destructive run remains behind the existing confirmation dialog and, if declared, must show backup or rollback information from the manifest.

## First implementation mapping

| Product screen | Live data endpoint | Primary product action type |
| --- | --- | --- |
| Device Health | `/api/system` | Read-only health check and approved maintenance review. |
| Cleanup Analyzer | `/api/cleanup/preview` | Category review and approved cleanup preview/run. |
| Performance Center | `/api/performance/optimization-preview` | Explain derived signals and route to approved optimisation review. |
| Storage Explorer | `/api/system` plus cleanup/duplicate previews where a user selects a folder | Read-only capacity view; no direct delete. |
| Driver Center | `/api/drivers/preview` | Inventory review and approved export/backup only until an update route is available. |
| Network Diagnostics | `/api/network/preview` | Stage diagnosis and approved repair preview/run. |
| Protection Center | `/api/system` | Protection finding review and approved security actions. |
| Device Checkup | `/api/diagnostics/preview` | Report viewing and approved diagnostic run. |
| Protect & Recover | `/api/backup-recovery/preview` | Safe restore-point and recovery actions with confirmation. |
