import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { DayNavigator } from 'components/DayNavigator';

// Create a mock week of dates
const createWeekDates = (startDate: Date): Date[] => {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date);
  }
  return dates;
};

const today = new Date();
const thisWeek = createWeekDates(
  new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay()),
);

const meta = {
  title: 'Components/DayNavigator',
  component: DayNavigator,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
  args: {
    onDateChange: fn(),
  },
} satisfies Meta<typeof DayNavigator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstDay: Story = {
  args: {
    currentDate: thisWeek[0],
    weekDates: thisWeek,
  },
};

export const MiddleDay: Story = {
  args: {
    currentDate: thisWeek[3],
    weekDates: thisWeek,
  },
};

export const LastDay: Story = {
  args: {
    currentDate: thisWeek[6],
    weekDates: thisWeek,
  },
};

export const Today: Story = {
  args: {
    currentDate: new Date(),
    weekDates: thisWeek,
  },
};

export const CustomWeek: Story = {
  args: {
    currentDate: new Date('2023-12-25'),
    weekDates: createWeekDates(new Date('2023-12-24')),
  },
};
