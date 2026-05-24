import { useMutation, MutationHookOptions, DocumentNode, OperationVariables } from '@apollo/client';

// TData defaults to `any` to mirror Apollo's untyped `useMutation` ergonomics —
// most callers in this codebase rely on `response.data?.fieldName` without
// declaring a schema type, and tightening that would force a large rewrite.

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
