import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { Modal } from './Modal';

const meta = {
  title: 'Components/Modal',
  component: Modal,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    maxWidth: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl', '2xl', '4xl'],
    },
    showCloseButton: {
      control: 'boolean',
    },
    isOpen: {
      control: 'boolean',
    },
  },
  args: {
    onClose: fn(),
  },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isOpen: true,
    title: 'Default Modal',
    children: (
      <div>
        <p>This is the modal content. You can put any React content here.</p>
        <p>It supports multiple paragraphs and complex layouts.</p>
      </div>
    ),
  },
};

export const Small: Story = {
  args: {
    isOpen: true,
    title: 'Small Modal',
    maxWidth: 'sm',
    children: <p>This is a small modal with limited width.</p>,
  },
};

export const Large: Story = {
  args: {
    isOpen: true,
    title: 'Large Modal',
    maxWidth: '2xl',
    children: (
      <div className="space-y-4">
        <p>This is a large modal with more space for content.</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-700 p-4 rounded">Column 1</div>
          <div className="bg-gray-700 p-4 rounded">Column 2</div>
        </div>
      </div>
    ),
  },
};

export const NoCloseButton: Story = {
  args: {
    isOpen: true,
    title: 'Modal Without Close Button',
    showCloseButton: false,
    children: <p>This modal doesn't have a close button in the header.</p>,
  },
};

export const WithForm: Story = {
  args: {
    isOpen: true,
    title: 'Form Modal',
    children: (
      <form className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
            Name
          </label>
          <input
            type="text"
            id="name"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            placeholder="Enter your name"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            placeholder="Enter your email"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            Submit
          </button>
        </div>
      </form>
    ),
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
    title: 'This modal is closed',
    children: <p>You won't see this content because the modal is closed.</p>,
  },
};
