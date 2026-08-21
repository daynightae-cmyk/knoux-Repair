# KNOUX Service Product Execution Audit

## Current evidence

The local bridge already runs only manifest-approved scripts and exposes structured data through read-only preview routes. It also maintains real job state, including `running`, `success`, `error`, and `cancelled`, along with cancellation and timeout handling. This is a solid execution foundation: the required transformation is primarily to expose structured service results, action plans, and user-centred status in the UI rather than to create a separate command runner.

| Product experience | Verified live contract | Verified real action capability | Current product gap |
| --- | --- | --- | --- |
| Device Health | System snapshot with CPU, memory, drives, Defender, firewall, and process count | Existing manifest tools can run health-related checks | Aggregate health report, finding drill-down, and report history are missing. |
| Cleanup Analyzer | Category-level sizes, paths, files, exclusions, reclaimable space, and quarantine inventory | Allowed cleanup tools use the registered execution flow | Review-selection, meaningful completion summary, and cleanup history need to be surfaced. |
| Performance Center | Live CPU, memory, disk activity, top processes, and derived recommendation signals | Existing optimisation tools accept supported preview/analyse modes | Recommendation cards need explained impact, outcomes, and undo/recovery handoff. |
| Driver Center | Device and driver inventory, signing, age, device problems, review signals, and class summaries | Export capability is present; direct update workflows are not yet evidenced by the live contract | A real inventory and safety centre can be implemented now; update/rollback must remain unavailable until an approved execution route is added. |
| Network Diagnostics | Active adapters, gateway, DNS, IPv4, and safety evidence | Registered network repair tools exist | A staged diagnostic pipeline and structured failure classification need to be added. |
| Protection Center | Defender, real-time status, firewall profiles, and signature version | Approved protection and firewall repair tools exist | Findings need explanation, preview, and post-action validation in the service UI. |
| Device Checkup | Events, reliability data, device issues, SMART signal, boot data, and system data | Diagnostic tools and reports exist | Test sequence, detailed finding pages, and report export should be promoted from generic tool actions. |
| Protect & Recover | Restore points, shadow copies, local backup discovery, sources, and storage | Restore-point, backup, and missing-file recovery flows exist | Separate recovery workflows and validated result explorer need to replace the generic service screen. |
| Privacy / Apps / Setup | Structured privacy settings, installed applications, developer tools, package catalogue, and setup availability | Approved privacy and package-related scripts exist | User decisions, selection review, and clear action results need first-class product flows. |

## Non-negotiable implementation boundary

The UI must not claim a scan, update, repair, recovery, or deletion succeeded unless it is backed by an actual bridge job or a read-only preview response. Where the bridge has a verified inventory but no approved action capability, the UI must present it as information or explicitly offer the available safe actions only.

## Recommended first release slice

The first functional product slice should prioritise Cleanup Analyzer, Performance Center, Driver Center, Network Diagnostics, Protection Center, Device Checkup, and Protect & Recover. These services already have the richest structured evidence and can provide the closest match to the reference without fake results.

## Verification note

The rebuilt frontend passes type checking and production build. The browser review was performed with the local execution bridge unavailable in this Linux environment. In that state, the interface correctly keeps the dedicated service shell visible but withholds all measurements, inventory, and outcomes; it does not display mock values. The richer product workspaces activate only when their associated verified preview endpoints are reachable through the local Windows bridge.
