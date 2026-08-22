import { useQuery } from '@apollo/client/react';
import { UserBadge } from 'types/chore';
import { GET_USER_BADGES } from 'graphql/queries';
import { useErrorToast } from './useErrorToast';

interface UseUserBadgesResult {
  badges: UserBadge[];
  loading: boolean;
}

export const useUserBadges = (userId: number): UseUserBadgesResult => {
  const { data, loading, error } = useQuery<{ userBadges: UserBadge[] }>(GET_USER_BADGES, {
    variables: { userId },
  });

  useErrorToast(error, 'Error loading badges');

  return {
    badges: data?.userBadges ?? [],
    loading,
  };
};
