import React, { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { GET_ALL_WEEKLY_COMPLETIONS } from '../graphql/queries';
import { User, ChoreCompletion } from '../types/chore';
import {
  getWeekDateRange,
  formatDateForGraphQL,
  formatDateForDisplay,
  isSameDayAsString,
} from '../utils/dateUtils';
import LoadingSpinner from './LoadingSpinner';
import Modal from './Modal';
import ChoreCompletionDetail from './ChoreCompletionDetail';
import WeekNavigator from './WeekNavigator';
import DayNavigator from './DayNavigator';
import ChoreGridHeader from './ChoreGridHeader';
import ChoreRow from './ChoreRow';
import { useUserChores } from '../hooks/useUserChores';

interface WeeklyChoreViewProps {
  user: User;
  isAdmin?: boolean;
  adminId?: number;
}

export const WeeklyChoreView: React.FC<WeeklyChoreViewProps> = ({
  user,
  isAdmin = false,
  adminId,
}) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekDateRange().start);
  const [selectedCompletion, setSelectedCompletion] = useState<ChoreCompletion | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isMobile, setIsMobile] = useState(false);

  // Check for mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 600);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Helper function to get user image URL
  const getUserImageUrl = (userObj: User): string | null => {
    if (userObj.id) {
      return `/images/user/${userObj.id}`;
    }
    return null;
  };

  const weekRange = getWeekDateRange(currentWeekStart);

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

  // Query to get all completions for the week (to check if chores are completed by anyone)
  const { data: allCompletionsData, refetch: refetchAllCompletions } = useQuery(
    GET_ALL_WEEKLY_COMPLETIONS,
    {
      variables: {
        weekStartDate: formatDateForGraphQL(weekRange.start),
      },
    },
  );

  // Set initial current date to first day of week on mobile
  useEffect(() => {
    if (isMobile && weekRange.dates.length > 0) {
      setCurrentDate(weekRange.dates[0]);
    }
  }, [weekRange, isMobile]);

  const handleCompleteChore = async (
    choreId: number,
    amountCents: number,
    completionDate: Date,
  ) => {
    try {
      await completeChore(choreId, amountCents, completionDate);
      refetchAllCompletions();
    } catch (err) {
      console.error('Error completing chore:', err);
    }
  };

  const handleCompletionUpdate = () => {
    refetch();
    refetchAllCompletions();
    setSelectedCompletion(null);
  };

  // Helper function to check if a chore is completed by anyone on a given date
  const isChoreCompletedByAnyone = (choreId: number, date: Date): boolean => {
    if (!allCompletionsData?.getAllWeeklyCompletions) return false;

    return allCompletionsData.getAllWeeklyCompletions.some((completion: any) => {
      const completionChoreId = completion.choreId;
      const completionDate = completion.completedDate || completion.createdAt;
      const isSameChore = completionChoreId === choreId;
      const isSameDate = isSameDayAsString(date, completionDate);
      return isSameChore && isSameDate;
    });
  };

  const handleWeekChange = (newWeekStart: Date) => {
    setCurrentWeekStart(newWeekStart);
    if (isMobile) {
      const newWeekRange = getWeekDateRange(newWeekStart);
      setCurrentDate(newWeekRange.dates[0]);
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
          <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
            {getUserImageUrl(user) ? (
              <img
                src={getUserImageUrl(user)!}
                alt={user.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white text-lg font-bold">
                {user.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-white`}>
              {user.name}'s Chores
            </h2>
            {!isMobile && (
              <p className="text-gray-300">
                Week of {formatDateForDisplay(weekRange.start)} -{' '}
                {formatDateForDisplay(weekRange.end)}
              </p>
            )}
          </div>
        </div>

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
          onDateChange={setCurrentDate}
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
