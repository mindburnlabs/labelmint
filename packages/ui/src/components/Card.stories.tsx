import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './Card';

const meta = {
  title: 'Components/Card',
  component: Card,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A flexible card container with header, content, and footer sections.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'elevated', 'outlined', 'filled', 'ghost'],
      description: 'The visual style variant of the card',
    },
    padding: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg', 'xl'],
      description: 'The padding size of the card',
    },
    interactive: {
      control: 'boolean',
      description: 'Whether the card is interactive (clickable)',
    },
    onClick: {
      action: 'clicked',
      description: 'Called when card is clicked (if interactive)',
    },
  },
  args: {
    children: 'Card content goes here',
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default story
export const Default: Story = {
  args: {
    children: 'This is a default card with medium padding.',
  },
};

// All variants
export const Variants: Story = {
  render: () => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
      <Card variant="default">
        <div className="text-sm font-medium">Default</div>
        <p className="text-muted-foreground text-xs mt-1">Standard card style</p>
      </Card>
      <Card variant="elevated">
        <div className="text-sm font-medium">Elevated</div>
        <p className="text-muted-foreground text-xs mt-1">Has shadow effect</p>
      </Card>
      <Card variant="outlined">
        <div className="text-sm font-medium">Outlined</div>
        <p className="text-muted-foreground text-xs mt-1">Thick border</p>
      </Card>
      <Card variant="filled">
        <div className="text-sm font-medium">Filled</div>
        <p className="text-muted-foreground text-xs mt-1">Background color</p>
      </Card>
      <Card variant="ghost">
        <div className="text-sm font-medium">Ghost</div>
        <p className="text-muted-foreground text-xs mt-1">No border or background</p>
      </Card>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All available card variants.',
      },
    },
  },
};

// Interactive card
export const Interactive: Story = {
  args: {
    variant: 'elevated',
    interactive: true,
    children: (
      <div className="p-4">
        <h3 className="font-semibold mb-2">Click Me!</h3>
        <p className="text-muted-foreground">This card is interactive and responds to hover and focus states.</p>
      </div>
    ),
  },
};

// Card with sections
export const WithSections: Story = {
  render: () => (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>
          This is the card description that provides additional context.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">
          This is the main content area of the card. You can put any content here including text, images, or other components.
        </p>
      </CardContent>
      <CardFooter>
        <div className="flex justify-between w-full">
          <button className="text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button className="text-sm bg-primary text-white px-3 py-1 rounded-md">
            Save
          </button>
        </div>
      </CardFooter>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Card with all sections (header, content, footer).',
      },
    },
  },
};

// Card sizes
export const Sizes: Story = {
  render: () => (
    <div className="space-y-4 w-80">
      <Card padding="sm">Small padding card</Card>
      <Card padding="md">Medium padding card</Card>
      <Card padding="lg">Large padding card</Card>
      <Card padding="xl">Extra large padding card</Card>
      <Card padding="none">No padding card</Card>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Cards with different padding sizes.',
      },
    },
  },
};

// Card examples
export const Examples: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {/* User Card */}
      <Card variant="elevated" interactive>
        <div className="flex items-center space-x-4 p-4">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
            JD
          </div>
          <div>
            <h3 className="font-semibold">John Doe</h3>
            <p className="text-sm text-muted-foreground">john.doe@example.com</p>
          </div>
        </div>
      </Card>

      {/* Stats Card */}
      <Card variant="filled" className="bg-primary text-primary-foreground">
        <div className="p-4">
          <div className="text-3xl font-bold">$2,458</div>
          <div className="text-sm opacity-90">Total Revenue</div>
          <div className="text-xs opacity-75 mt-1">+12% from last month</div>
        </div>
      </Card>

      {/* Feature Card */}
      <Card variant="outlined" interactive>
        <div className="p-4">
          <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-success" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="font-semibold mb-1">Feature Complete</h3>
          <p className="text-sm text-muted-foreground">
            All systems operational and running smoothly.
          </p>
        </div>
      </Card>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Practical examples of cards in real-world scenarios.',
      },
    },
  },
};

// Accessibility story
export const Accessibility: Story = {
  args: {
    role: 'article',
    'aria-label': 'Article card about accessibility',
    children: (
      <div>
        <h2 className="font-semibold mb-2">Accessible Card</h2>
        <p className="text-sm text-muted-foreground">
          This card has proper ARIA attributes for screen readers. It includes a role and label for better accessibility.
        </p>
        <button className="mt-3 text-sm text-primary">
          Learn more →
        </button>
      </div>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Card with proper ARIA attributes for accessibility.',
      },
    },
  },
};