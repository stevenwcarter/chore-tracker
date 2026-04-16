import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { toast } from 'react-toastify';
import { GET_ALL_WEEKLY_COMPLETIONS } from 'graphql/queries';
import { User, ChoreCompletion, BADGE_DISPLAY } from 'types/chore';
import { getWeekDateRange, formatDateForGraphQL, formatDateForDisplay } from 'utils/dateUtils';
import LoadingSpinner from './LoadingSpinner';
import Modal from './Modal';
import ChoreCompletionDetail from './ChoreCompletionDetail';
import WeekNavigator from './WeekNavigator';
import DayNavigator from './DayNavigator';
import ChoreGridHeader from './ChoreGridHeader';
import ChoreRow from './ChoreRow';
import { useUserChores } from 'hooks/useUserChores';
import { useUserBadges } from 'hooks/useUserBadges';
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
  const [isMobile, setIsMobile] = useState(false);

  const weekRange = useMemo(() => getWeekDateRange(currentWeekStart), [currentWeekStart]);

  // For mobile, always use the first day of the current week
  // For desktop, allow free navigation through the week
  const [selectedDate, setSelectedDate] = useState(() => {
    return weekRange.dates.length > 0 ? weekRange.dates[0] : new Date();
  });

  // Derive the current date based on mobile state
  const currentDate = useMemo(() => {
    if (isMobile && weekRange.dates.length > 0) {
      return weekRange.dates[0];
    }
    return selectedDate;
  }, [isMobile, weekRange.dates, selectedDate]);

  // Check for mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 600);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
  const { data: allCompletionsData, refetch: refetchAllCompletions } = useQuery(
    GET_ALL_WEEKLY_COMPLETIONS,
    {
      variables: {
        weekStartDate: formatDateForGraphQL(weekRange.start),
      },
    },
  );

  const handleCompleteChore = async (choreId: number, completionDate: Date) => {
    try {
      await completeChore(choreId, completionDate);
      refetchAllCompletions();
    } catch (err) {
      toast.error('Error completing chore');
    }
  };

  const handleCompletionUpdate = () => {
    refetch();
    refetchAllCompletions();
    setSelectedCompletion(null);
  };

  // Build a Set keyed by "choreId-YYYY-MM-DD" for O(1) per-cell lookup
  const completionLookup = useMemo(() => {
    const set = new Set<string>();
    allCompletionsData?.getAllWeeklyCompletions?.forEach((c: ChoreCompletion) => {
      set.add(`${c.choreId}-${c.completedDate}`);
    });
    return set;
  }, [allCompletionsData]);

  const isChoreCompletedByAnyone = (choreId: number, date: Date): boolean => {
    return completionLookup.has(`${choreId}-${formatDateForGraphQL(date)}`);
  };

  const isChoreCompletedByUser = (choreId: number, userId: number, date: Date): boolean => {
    return (
      allCompletionsData?.getAllWeeklyCompletions?.some(
        (c: ChoreCompletion) =>
          c.choreId === choreId &&
          c.userId === userId &&
          c.completedDate === formatDateForGraphQL(date),
      ) ?? false
    );
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
            {!isMobile && badges.length > 0 && (
              <div className="flex flex-row gap-2 overflow-x-auto pb-1 mt-2">
                {badges.map((badge) => {
                  const display = BADGE_DISPLAY[badge.badgeType];
                  if (!display) return null;
                  return (
                    <span
                      key={badge.id}
                      className="flex items-center gap-1 px-3 py-1 bg-purple-500/20 border border-purple-500/40 rounded-full text-sm whitespace-nowrap"
                    >
                      {display.emoji} {display.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {isMobile && badges.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {badges.map((badge) => {
              const display = BADGE_DISPLAY[badge.badgeType];
              if (!display) return null;
              return (
                <span
                  key={badge.id}
                  className="flex items-center gap-1 px-3 py-1 bg-purple-500/20 border border-purple-500/40 rounded-full text-sm"
                >
                  {display.emoji} {display.label}
                </span>
              );
            })}
          </div>
        )}

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
        // Mobile layout - cards
        <div className="space-y-4">
          {weeklyChoreData.map((choreData) => (
            <ChoreRow
              key={choreData.chore.id}
              choreData={choreData}
              dates={[currentDate]}
              onCompleteChore={handleCompleteChore}
              onSelectCompletion={setSelectedCompletion}
              isChoreCompletedByAnyone={isChoreCompletedByAnyone}
              currentDate={currentDate}
              isMobile={true}
            />
          ))}
        </div>
      ) : (
        // Desktop layout - table
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <ChoreGridHeader dates={weekRange.dates} />
            <tbody>
              {weeklyChoreData.map((choreData) => (
                <ChoreRow
                  key={choreData.chore.id}
                  choreData={choreData}
                  dates={weekRange.dates}
                  onCompleteChore={handleCompleteChore}
                  onSelectCompletion={setSelectedCompletion}
                  isChoreCompletedByAnyone={isChoreCompletedByAnyone}
                />
              ))}
            </tbody>
          </table>
        </div>
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
