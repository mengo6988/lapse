/**
 * The single write interface for a mutation whose result belongs in the
 * cached bootstrap payload (docs/spec.md § API "Bootstrap payload"): send
 * the request, then land the response on the cache. A caller declares a
 * spec — the route (fixed, or derived from the mutation's input, since a
 * Variant write's route embeds its Tracker id), the HTTP method, and what a
 * successful write does to the cache — and gets back the same
 * `@tanstack/react-query` mutation result `useMutation` would, with nothing
 * left to implement.
 *
 * A write's success is one of two kinds:
 *  - `graft`: call one of src/client/query/bootstrapCache.ts's functions
 *    with the server's response — and, for a write whose response can't
 *    carry everything the graft needs (a soft-deleted Variant's response is
 *    empty), the original input too — to produce the next cached payload.
 *  - `invalidate`: mark a query stale so it refetches, for a write where the
 *    response isn't enough to update the cache by hand.
 *
 * A write may additionally touch a query that isn't the bootstrap payload —
 * `alsoUpdate` names that query and how the write changes it. Only the
 * paginated entry history needs this today: editing or deleting an Entry
 * updates the already-loaded pages in place (so a deep scroll survives) while
 * marking bootstrap stale, because `latestEntry` is server-authoritative.
 *
 * Error handling is untouched: `mutationFetch`
 * (src/client/tracker/mutationClient.ts) already turns a rejected write into
 * per-field messages or the single "couldn't save" failure; this hook does
 * not add a second opinion on what a failure looks like.
 */
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import type { BootstrapPayload } from '../api'
import { jsonRequest, mutationFetch } from '../tracker/mutationClient'
import { bootstrapQueryKey } from './useBootstrap'

export type WriteMethod = 'POST' | 'PATCH' | 'DELETE'

/** the request path; a function when it embeds part of the mutation's input (e.g. a Tracker id). */
export type WriteRoute<TInput> = string | ((input: TInput) => string)

export type WriteSuccess<TInput, TResponse> =
  | {
      readonly kind: 'graft'
      /** produces the next cached bootstrap payload from the current one, the server's response and the original input. */
      readonly graft: (payload: BootstrapPayload, response: TResponse, input: TInput) => BootstrapPayload
    }
  | {
      readonly kind: 'invalidate'
      readonly queryKey: QueryKey
    }

/** a query outside the bootstrap payload that this write also changes, updated in place rather than refetched. */
export interface WriteAlsoUpdate<TInput, TResponse, TData> {
  readonly queryKey: (input: TInput) => QueryKey
  readonly update: (old: TData | undefined, response: TResponse, input: TInput) => TData | undefined
}

export interface WriteSpec<TInput, TResponse, TData = unknown> {
  readonly route: WriteRoute<TInput>
  readonly method: WriteMethod
  /** the JSON request body, derived from the input. Omit for a write with no body (a DELETE with nothing to say) or one that sends its input as-is. */
  readonly body?: (input: TInput) => unknown
  readonly onSuccess: WriteSuccess<TInput, TResponse>
  readonly alsoUpdate?: WriteAlsoUpdate<TInput, TResponse, TData>
}

function resolveRoute<TInput>(route: WriteRoute<TInput>, input: TInput): string {
  return typeof route === 'function' ? route(input) : route
}

function buildInit<TInput>(method: WriteMethod, input: TInput, body?: (input: TInput) => unknown): RequestInit {
  if (body) return jsonRequest(method, body(input))
  if (method === 'DELETE') return { method }
  return jsonRequest(method, input)
}

export function useBootstrapWrite<TInput, TResponse, TData = unknown>(spec: WriteSpec<TInput, TResponse, TData>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: TInput) =>
      mutationFetch(resolveRoute(spec.route, input), buildInit(spec.method, input, spec.body)) as Promise<TResponse>,
    onSuccess: (response, input) => {
      if (spec.alsoUpdate) {
        const { queryKey, update } = spec.alsoUpdate
        queryClient.setQueryData<TData>(queryKey(input), (old) => update(old, response, input))
      }

      if (spec.onSuccess.kind === 'invalidate') {
        void queryClient.invalidateQueries({ queryKey: spec.onSuccess.queryKey })
        return
      }

      const { graft } = spec.onSuccess
      queryClient.setQueryData<BootstrapPayload>(bootstrapQueryKey, (old) => (old ? graft(old, response, input) : old))
    },
  })
}
