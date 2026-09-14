import React, { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_ALL_WEEKLY_COMPLETIONS } from 'graphql/queries';
import { User, ChoreCompletion } from 'types/chore';
import {
  getWeekDateRange,
  formatDateForGraphQL,
  formatDateForDisplay,
  getDefaultDateForWeek,
} from 'utils/dateUtils';
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

  // The day being shown: seeded with today when the current week is on screen, and
  // thereafter owned by whatever the user picks.
  //
  // This must stay plain state. It used to be re-derived per render as
  // `isMobile ? weekRange.dates[0] : selectedDate`, which silently discarded every
  // choice the mobile day navigator made -- the buttons updated state and the view
  // still rendered the Sunday, so they read as dead controls. A default belongs in
  // an initialiser, not in a derivation that outlives it.
  const [currentDate, setCurrentDate] = useState(() => getDefaultDateForWeek(weekRange.dates));

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
    // propagate is load-bearing - celebrateOnSuccess (via ChoreCell) is the
    // swallow point that suppresses the confetti on failure.
    await completeChore(choreId, completionDate);
    refetchAllCompletions();
  };

  const handleCompletionUpdate = () => {
    refetch();
    refetchAllCompletions();
    setSelectedCompletion(null);
  };

  // Changing week re-seeds the shown day, so it always stays inside the week on
  // screen: DayNavigator locates it by index, and a date left behind in the
  // previous week would disable both of its buttons.
  const handleWeekChange = (newWeekStart: Date) => {
    setCurrentWeekStart(newWeekStart);
    setCurrentDate(getDefaultDateForWeek(getWeekDateRange(newWeekStart).dates));
  };

  if (choresLoading) return <LoadingSpinner />;
  if (choresError)
    return <div className="text-red-500">Error loading weekly chores: {choresError.message}</div>;

  return (
    <div className="p-6 bg-gray-800 text-white rounded-lg shadow-lg">
      {/*
        Header with user info and week navigation.

        On desktop this is a wrapping row. `flex-wrap` is what drops the week
        navigator onto its own line the moment the user's name and badges stop
        leaving room for it beside them - without it the navigator simply
        overflowed and was clipped off the right edge of a kiosk screen. The
        navigator keeps `ml-auto` so it stays in the same top-right corner
        whether it sits beside the badges or on the line below them.
      */}
      <div
        className={`flex ${isMobile ? 'flex-col' : 'flex-wrap justify-between items-center'} mb-6`}
      >
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

        {isMobile && <BadgeChips badges={badges} />}

        <div className={isMobile ? undefined : 'ml-auto mb-4'}>
          <WeekNavigator
            currentWeekStart={currentWeekStart}
            onWeekChange={handleWeekChange}
            weekRange={weekRange}
            isMobile={isMobile}
          />
        </div>
      </div>

      {/* Mobile day navigator */}
      {isMobile && (
        <DayNavigator
          currentDate={currentDate}
          weekDates={weekRange.dates}
          onDateChange={setCurrentDate}
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
