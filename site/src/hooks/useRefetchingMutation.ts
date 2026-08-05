import type { DocumentNode, OperationVariables } from '@apollo/client';
import { useMutation, type MutationHookOptions } from '@apollo/client/react';

// TData defaults to `any` to mirror Apollo's untyped `useMutation` ergonomics —
// most callers in this codebase rely on `response.data?.fieldName` without
// declaring a schema type, and tightening that would force a large rewrite.

/**
 * Wraps Apollo's `useMutation` so that `refetch` is invoked on every successful completion,
 * before the caller's own `options.onCompleted` runs.
 *
 * The refetch is asynchronous, so callers must not read component state that it will
 * overwrite once the mutation resolves - snapshot anything you need to compare against
 * before awaiting the mutation (see `useAdminChoreManagement`'s pre-mutation assignment
 * snapshot).
 */
export function useRefetchingMutation<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
>(mutation: DocumentNode, refetch: () => void, options?: MutationHookOptions<TData, TVariables>) {
  return useMutation<TData, TVariables>(mutation, {
    ...options,
    onCompleted: (data) => {
      refetch();
      options?.onCompleted?.(data);
    },
  });
}
