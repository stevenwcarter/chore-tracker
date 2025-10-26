import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import CreateUserForm from './CreateUserForm';

const meta = {
  title: 'Components/CreateUserForm',
  component: CreateUserForm,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
  args: {
    onSubmit: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof CreateUserForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const Interactive: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    // This story demonstrates the form in use
    const canvas = canvasElement;
    const nameInput = canvas.querySelector('#user-name') as HTMLInputElement;
    if (nameInput) {
      nameInput.focus();
    }
  },
};