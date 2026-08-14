# Schema & API review grill

Type: grilling
Status: open
Blocked by: 01, 05

## Question

Walk the data model + REST API in `docs/spec.md` before the first migration, folding in stack-validation findings and any features the re-scope grill pulled in. Settle: Drizzle column types + indexes, cascade rules, pagination shape for `GET /trackers/:id/entries`, the variantless-entries edge case, `/bootstrap` payload shape, and validation rules per endpoint. Output: updated spec section, ready to write as the first Drizzle schema.
