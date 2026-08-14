# Offline-lite implementation grill

Type: grilling
Status: open
Blocked by: 02, 03

## Question

Settle offline-lite mechanics on top of the research findings: outbox approach (TanStack-native vs hand-rolled vs library), replay order + retry policy, dedup/idempotency details, clock handling for backdated offline entries, "pending sync" indicator UX, and SW update behavior/prompt UX on iOS. Output: implementation-ready notes appended to `docs/tech-stack.md` (and ADR-0002 amendments if the approach shifts).
