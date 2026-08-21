# KNOUX Service App Motion System

## Motion principles

Motion in KNOUX is operational feedback, not decoration. It must make an event easier to perceive: a service becomes active, live information is refreshing, a user has selected an action, an operation is running, or a safe outcome was completed. Small responses remain fast and use transform and opacity; persistent motion is limited to live or waiting states.

## Interaction map

| Moment | Motion response | Purpose |
| --- | --- | --- |
| Changing service | Shell crossfade with a short vertical settle; hero and action rail stagger in | Keeps orientation while making each selected service feel opened. |
| Refreshing live data | Accent halo rotates and refresh control subtly turns | Shows that the device is being queried without blocking the screen. |
| Offline preparation | Service motif pulses gently and its orbit lines drift | Communicates readiness without pretending that live data exists. |
| Action rail hover/focus | Card elevates, accent dot expands, action arrow translates | Makes the next safe step unmistakable. |
| Action selected | Confirmation surface springs in and the chosen row gains an active glow | Connects a decision to the confirmation step. |
| Tool running | Action row shows a scanning sweep and progress pulse | Clearly identifies the active operation. |
| Successful completion | Green completion ripple and checkmark scale-in | Gives immediate positive closure. |
| Needs attention or fails | Warm alert pulse, restrained rather than alarming | Directs attention without creating anxiety. |

## Service-specific signatures

| Application family | Signature effect |
| --- | --- |
| Health | Slow heartbeat on the score ring and a drift across the vitality grid. |
| Cleaning / storage | Capacity bar fills, cleaning orbit spins, and bucket cards lift in sequence. |
| Performance / monitoring | Low-amplitude scanline, gauge sweep, and process-card signal pulse. |
| Connection | Data pulse travels from device to internet node. |
| Security / privacy | Shield halo breathes; protected states receive a short confirmation sweep. |
| Diagnostics / recovery | Report cards rise in sequence; recovery timeline nodes illuminate progressively. |
| Library / setup | Catalogue items cascade in; selected setup tiles lock into place. |
| Project / developer | Board tiles reveal in a stagger and priority beacon cycles. |

## Accessibility and performance

All non-essential animation stops under `prefers-reduced-motion: reduce`. The implementation must retain legibility with animation disabled, avoid continuous layout-changing animation, and keep infinite effects limited to opacity, transform, or background-position. Each effect is scoped to the active service so inactive views do not consume rendering work.

## Visual verification

The Arabic RTL interface was checked after enabling the motion layer. The service shell remained structurally stable when switching from Software Library to Connection Helper, and the distinct service colour, motif, navigation state, and action surface rendered correctly. The animated effects are scoped to the currently mounted service and do not alter the service data or execution contracts.

## Runtime check

A browser runtime check confirmed that the page direction is RTL and that both the service shell and the active offline scene resolve to their intended animation names (`service-shell-enter` and `scene-lift`). The browser did not currently advertise reduced-motion preference. The shipped stylesheet includes a `prefers-reduced-motion: reduce` override that collapses all animation and transition durations and removes non-essential scene sheen.
