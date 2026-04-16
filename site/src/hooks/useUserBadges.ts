import { useQuery } from '@apollo/client';
import { toast } from 'react-toastify';
import { UserBadge } from 'types/chore';
import { GET_USER_BADGES } from 'graphql/queries';

interface UseUserBadgesResult {
  badges: UserBadge[];
  loading: boolean;
}

export const useUserBadges = (userId: number): UseUserBadgesResult => {
  const { data, loading } = useQuery<{ userBadges: UserBadge[] }>(GET_USER_BADGES, {
    variables: { userId },
    onError: () => toast.error('Error loading badges'),
  });

  return {
    badges: data?.userBadges ?? [],
    loading,
  };
};
