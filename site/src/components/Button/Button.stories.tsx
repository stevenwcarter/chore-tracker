import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { MyButton } from './index';
import { ButtonTypes } from './ButtonTypes';

const meta = {
  title: 'Components/Button',
  component: MyButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: Object.values(ButtonTypes),
    },
    size: {
      control: 'select',
      options: ['sm', 'lg'],
    },
    disabled: {
      control: 'boolean',
    },
    nomargin: {
      control: 'boolean',
    },
    block: {
      control: 'boolean',
    },
  },
  args: {
    onClick: fn(),
  },
} satisfies Meta<typeof MyButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Default Button',
  },
};

export const Primary: Story = {
  args: {
    children: 'Primary Button',
    type: ButtonTypes.PRIMARY,
  },
};

export const Success: Story = {
  args: {
    children: 'Success Button',
    type: ButtonTypes.SUCCESS,
  },
};

export const Danger: Story = {
  args: {
    children: 'Danger Button',
    type: ButtonTypes.DANGER,
  },
};

export const Info: Story = {
  args: {
    children: 'Info Button',
    type: ButtonTypes.INFO,
  },
};

export const Warning: Story = {
  args: {
    children: 'Warning Button',
    type: ButtonTypes.WARN,
  },
};

export const Small: Story = {
  args: {
    children: 'Small Button',
    size: 'sm',
  },
};

export const Large: Story = {
  args: {
    children: 'Large Button',
    size: 'lg',
  },
};

export const Disabled: Story = {
  args: {
    children: 'Disabled Button',
    disabled: true,
  },
};

export const Block: Story = {
  args: {
    children: 'Block Button',
    block: true,
  },
  parameters: {
    layout: 'padded',
  },
};

export const NoMargin: Story = {
  args: {
    children: 'No Margin Button',
    nomargin: true,
  },
};
