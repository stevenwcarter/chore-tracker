import React, { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_ALL_WEEKLY_COMPLETIONS } from 'graphql/queries';
import { User, ChoreCompletion } from 'types/chore';
import { getWeekDateRange, formatDateForGraphQL, formatDateForDisplay } from 'utils/dateUtils';
import LoadingSpinner from './LoadingSpinner';
import Modal from './Modal';
import ChoreCompletionDetail from './ChoreCompletionDetail';
import WeekNavigator from './WeekNavigator';
import DayNavigator from './DayNavigator';
import ChoreGrid from './ChoreGrid';
import ChoreCardList from './ChoreCardList';
import BadgeChips from './BadgeChips';
import { useUserChores } from 'hooks/useUserChores';
import { useUserBadges } from 'hooks/useUserBadges';
import { useIsMobile } from 'hooks/useIsMobile';
import { useCompletionLookup } from 'hooks/useCompletionLookup';
import UserImage from './UserImage';
import BonusChoreSection from './BonusChoreSection';

interface WeeklyChoreViewProps {
  user: User;
  isAdmin?: boolean;
  adminId?: number;
  onBack?: () => void;
}

export const WeeklyChoreView: React.FC<WeeklyChoreViewProps> = ({
  user,
  isAdmin = false,
  adminId,
  onBack,
}) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekDateRange().start);
  const [selectedCompletion, setSelectedCompletion] = useState<ChoreCompletion | null>(null);
  const isMobile = useIsMobile();

  const weekRange = useMemo(() => getWeekDateRange(currentWeekStart), [currentWeekStart]);

  const [selectedDate, setSelectedDate] = useState(() => {
    return weekRange.dates.length > 0 ? weekRange.dates[0] : new Date();
  });

  // On mobile the view is pinned to the first day of the current week; on desktop the
  // user navigates freely through the week and `selectedDate` wins.
  const currentDate = useMemo(() => {
    if (isMobile && weekRange.dates.length > 0) {
      return weekRange.dates[0];
    }
    return selectedDate;
  }, [isMobile, weekRange.dates, selectedDate]);

  // Use custom hook for user chores
  const {
    weeklyChoreData,
    loading: choresLoading,
    error: choresError,
    refetch,
    completeChore,
  } = useUserChores({
    userId: user.id,
    weekStartDate: weekRange.start,
  });

  const { badges } = useUserBadges(user.id);

  // Query to get all completions for the week (to check if chores are completed by anyone)
  // Same options as the other weekly consumers (useWeeklyCompletions,
  // useUserChores): without them the "completed by someone else" ticks went
  // stale while its partner query refreshed every 30s.
  const { data: allCompletionsData, refetch: refetchAllCompletions } = useQuery<{
    getAllWeeklyCompletions: ChoreCompletion[];
  }>(GET_ALL_WEEKLY_COMPLETIONS, {
    fetchPolicy: 'cache-and-network',
    variables: {
      weekStartDate: formatDateForGraphQL(weekRange.start),
    },
    pollInterval: 30_000,
  });

  const { isChoreCompletedByAnyone, isChoreCompletedByUser } =
    useCompletionLookup(allCompletionsData);

  const handleCompleteChore = async (choreId: number, completionDate: Date) => {
    // `completeChore` already toasts via withErrorToast; letting the rejection
    // propagate is load-bearing - ChoreRow catches it to suppress the confetti.
    await completeChore(choreId, completionDate);
    refetchAllCompletions();
  };

  const handleCompletionUpdate = () => {
    refetch();
    refetchAllCompletions();
    setSelectedCompletion(null);
  };

  const handleWeekChange = (newWeekStart: Date) => {
    setCurrentWeekStart(newWeekStart);
    if (isMobile) {
      const newWeekRange = getWeekDateRange(newWeekStart);
      setSelectedDate(newWeekRange.dates[0]);
    }
  };

  if (choresLoading) return <LoadingSpinner />;
  if (choresError)
    return <div className="text-red-500">Error loading weekly chores: {choresError.message}</div>;

  return (
    <div className="p-6 bg-gray-800 text-white rounded-lg shadow-lg">
      {/* Header with user info and week navigation */}
      <div className={`flex ${isMobile ? 'flex-col' : 'justify-between items-center'} mb-6`}>
        <div className="flex items-center gap-4 mb-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-4 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors border"
              aria-label="Go back"
            >
              ← Back
            </button>
          )}
          <UserImage user={user} />
          <div className="min-w-0">
            <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-white`}>
              {user.name}'s Chores
            </h2>
            {!isMobile && (
              <p className="text-gray-300">
                Week of {formatDateForDisplay(weekRange.start)} -{' '}
                {formatDateForDisplay(weekRange.end)}
              </p>
            )}
            {!isMobile && <BadgeChips badges={badges} />}
          </div>
        </div>

        {isMobile && <BadgeChips badges={badges} wrap />}

        <WeekNavigator
          currentWeekStart={currentWeekStart}
          onWeekChange={handleWeekChange}
          weekRange={weekRange}
          isMobile={isMobile}
        />
      </div>

      {/* Mobile day navigator */}
      {isMobile && (
        <DayNavigator
          currentDate={currentDate}
          weekDates={weekRange.dates}
          onDateChange={setSelectedDate}
        />
      )}

      {/* Chore display */}
      {isMobile ? (
        <ChoreCardList
          weeklyChoreData={weeklyChoreData}
          currentDate={currentDate}
          onCompleteChore={handleCompleteChore}
          onSelectCompletion={setSelectedCompletion}
          isChoreCompletedByAnyone={isChoreCompletedByAnyone}
        />
      ) : (
        <ChoreGrid
          weeklyChoreData={weeklyChoreData}
          dates={weekRange.dates}
          onCompleteChore={handleCompleteChore}
          onSelectCompletion={setSelectedCompletion}
          isChoreCompletedByAnyone={isChoreCompletedByAnyone}
        />
      )}

      {/* Bonus chores */}
      <BonusChoreSection
        userId={user.id}
        today={formatDateForGraphQL(currentDate)}
        onClaimChore={handleCompleteChore}
        isChoreCompletedByAnyone={isChoreCompletedByAnyone}
        isChoreCompletedByUser={isChoreCompletedByUser}
      />

      {/* Completion detail modal */}
      <Modal
        isOpen={!!selectedCompletion}
        onClose={() => setSelectedCompletion(null)}
        title="Chore Completion Details"
        maxWidth="md"
      >
        {selectedCompletion && (
          <ChoreCompletionDetail
            completion={selectedCompletion}
            isAdmin={isAdmin}
            adminId={adminId}
            userId={user.id}
            onClose={() => setSelectedCompletion(null)}
            onUpdate={handleCompletionUpdate}
          />
        )}
      </Modal>
    </div>
  );
};

export default WeeklyChoreView;
