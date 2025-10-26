import { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { AutoUpdateInput } from './AutoUpdateInput';

const meta = {
  title: 'Components/AutoUpdateInput',
  component: AutoUpdateInput,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'textarea'],
    },
    serverValue: {
      control: 'text',
    },
    placeholder: {
      control: 'text',
    },
  },
  args: {
    onChange: fn(),
  },
} satisfies Meta<typeof AutoUpdateInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextInput: Story = {
  args: {
    type: 'text',
    serverValue: 'Initial value',
    placeholder: 'Enter text here...',
  },
};

export const EmptyTextInput: Story = {
  args: {
    type: 'text',
    serverValue: '',
    placeholder: 'Type something...',
  },
};

export const TextArea: Story = {
  args: {
    type: 'textarea',
    serverValue: 'This is a longer text that might span multiple lines.',
    placeholder: 'Enter detailed description...',
  },
};

export const EmptyTextArea: Story = {
  args: {
    type: 'textarea',
    serverValue: '',
    placeholder: 'Write your thoughts here...',
  },
};

export const LongContent: Story = {
  args: {
    type: 'textarea',
    serverValue: `This is a much longer text that demonstrates how the component handles larger amounts of content. It includes multiple sentences and should give a good sense of how the textarea behaves with more substantial text input.

This text even includes multiple paragraphs to show how line breaks are handled.`,
    placeholder: 'Enter detailed description...',
  },
};

export const WithCustomClassName: Story = {
  args: {
    type: 'text',
    serverValue: 'Styled input',
    placeholder: 'Custom styled input',
    className: 'border-2 border-blue-500 rounded-lg',
  },
};
