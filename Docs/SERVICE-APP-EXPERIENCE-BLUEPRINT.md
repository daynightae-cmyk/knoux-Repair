# KNOUX — Service App Experience Blueprint

## Product intent

Each KNOUX service will be treated as a small standalone product, rather than a differently coloured version of the same dashboard. A person should understand the purpose of a screen through its visual hierarchy and interaction model before reading the service title. Shared platform elements remain limited to navigation, safety confirmation, and the completion surface.

## Experience families

| Service | Product metaphor | Hero visual | Core interaction | Structured data available |
| --- | --- | --- | --- | --- |
| Device Health | Health scorecard | System-health ring and repair timeline | Check, review findings, repair | System and diagnostic snapshots |
| Space Cleaner | Cleaning plan | Reclaimable-space meter and cleanup buckets | Select safe cleanup categories | Cleanup preview |
| Connection Helper | Connection map | Network route / signal card | Diagnose, select repair | Network preview |
| App Center | Application library | App catalog and startup health | Review, organise, repair | Software preview |
| Duplicate Organizer | File review desk | Duplicate groups and safe keeper choices | Scan folder, compare, recover | Duplicate preview |
| Storage Space | Storage explorer | Drive bars and large-file composition | Explore, reclaim | System-drive and disk data |
| Device Activity | Live operations room | Resource stream and responsive-process cards | Inspect, intervene safely | Operations preview |
| Speed Up | Performance cockpit | CPU, memory, startup, and power gauges | Diagnose, apply recommendation | Performance and optimisation previews |
| Protection | Security center | Protection shield and posture checks | Verify, fix, confirm | System snapshot and security tools |
| Device Checkup | Diagnostic report | Device-score timeline and finding cards | Check, understand, export | Diagnostics preview |
| Protect & Recover | Recovery vault | Restore-point timeline and backup vault | Create, verify, recover | Backup-recovery preview |
| Development Environments | Workspace launchpad | Toolchain / project readiness cards | Inspect setup, manage workspace | Advanced software and sonar previews |
| Privacy | Privacy control room | Privacy choices and local activity controls | Review, choose, confirm | Privacy preview |
| Drivers & Devices | Device garage | Device and driver health list | Inspect, protect, export | Driver preview |
| Device Monitor | Live resource dashboard | Resource charts and recent alerts | Capture and review snapshot | Operations/performance previews |
| Software Library | Software shelf | Installed-app cards and update shelf | Browse, maintain, remove safely | Software and advanced software previews |
| New Device Setup | Setup checklist | Installation readiness and curated catalogue | Choose essentials, confirm install | Post-install preview |
| Project Center | Project command board | Repository health and priority map | Pick project, review priorities, export | Project Sonar preview |

## UX rules

The service must place an immediate, tangible answer at the top of the page: available storage, connection quality, protection readiness, current memory pressure, number of recovery points, or another plain-language measure. It must then offer one recommended next action and use secondary details only to support a decision.

Every service receives a distinct arrangement, including different visual motifs, surfaces, data treatments, and journey patterns. A storage service may use proportional bars; a duplicate-file service needs review cards; a recovery service needs a timeline; and a project service needs a priority board. Reusing the same title card, action card, and three-step box across services is specifically avoided.

## Safety and technical boundaries

The local execution engine, tool identifiers, script names, raw logs, and implementation language remain invisible by default. The user sees what will happen, whether a device change is expected, any choice they must make, and the completed outcome. A downloadable support report remains optional and is not part of the core flow.

## Visual scene system

| Scene family | Services | Signature UI |
| --- | --- | --- |
| Vitality | Device Health, Speed Up, Device Monitor | Large circular or arc gauges, resource pulse lines, priority recommendations, and a device-status timeline. |
| Recovery | Space Cleaner, Storage Space, Duplicate Organizer, Protect & Recover | Capacity visuals, protected selections, recovery vaults, review queues, and before/after summaries. |
| Assurance | Connection Helper, Protection, Privacy, Drivers & Devices | Status maps, shield checks, connection/device cards, clearly separated states, and choice controls. |
| Library | App Center, Software Library, New Device Setup | App shelves, selections, setup checklists, catalogue cards, and staged installations. |
| Workbench | Development Environments, Project Center | Workspace maps, readiness indicators, priority boards, and export/hand-off surfaces. |
| Investigation | Device Checkup, Device Activity | Finding streams, event narratives, device scorecards, and report journeys. |

Every scene contains a deliberately chosen combination of a hero object, a live-data surface, an action queue, and a decision aid. These blocks vary by service instead of repeating the same panel arrangement. Animations will remain restrained and will communicate live state, progress, or selection rather than acting as decoration.

## Visual verification — service-app shell

The Workspaces entry point remains intact after the specialised application layer was added. The Arabic RTL workspace interface renders correctly and continues to offer direct access to individual repair stations. The next verification step is opening each station to inspect its dedicated service scene.

## Visual verification — distinct service scenes

The Arabic RTL Device Health and Space Cleaner experiences were checked in the running application while the local bridge was offline. Both display their own branded service header, accent, hero language, iconographic scene, and safety surface rather than the former repeated service dashboard. The health scene uses an orbital vitality motif, while cleanup uses a structured reclaimable-space motif. Real system data will replace these non-numeric preparation scenes automatically when the local bridge becomes available.

The Performance and Storage scenes were also visually verified in Arabic RTL. They use separate accent systems and motifs: the performance application uses a tilted gauge cockpit, while storage uses a capacity-oriented explorer scene. This completes visual verification of the first implementation group in the local offline state.

The Connection Helper and Protection applications were visually checked in Arabic RTL. Each presents an intentionally different service identity and scene: a connection-map treatment for network work and an assurance/shield treatment for security. Both remain useful and non-technical while waiting for the local data bridge.

The Device Checkup and Protect & Recover applications were visually checked in Arabic RTL. The diagnostic service has an investigation/report identity, while recovery uses a vault-oriented identity, with separate titles, iconography, scene composition, and service-specific preparation copy.

The App Center and Privacy screens were visually checked in Arabic RTL. App Center uses a warm library identity, while Privacy uses a distinct pink control-room identity. Both are rendered as focused user applications rather than command surfaces and preserve the no-data, no-fabrication behavior while the bridge is offline.

The Development Environments and Project Center applications were visually verified in Arabic RTL. Development uses a workspace-bench identity and Project Center uses a clear project-command-board composition with focused selection, priority-map, and hand-off cards. Project Center remains fully meaningful without live bridge data because its work begins with selecting a project.
