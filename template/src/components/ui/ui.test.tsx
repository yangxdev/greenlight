import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Button, EmptyState, Field, ThemeToggle } from './index.ts';

afterEach(() => {
  localStorage.clear();
  document.documentElement.dataset.theme = 'light';
});

describe('ThemeToggle', () => {
  it('switches theme, remembers it, and labels the action it will take', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('starts from the stored choice', () => {
    localStorage.setItem('theme', 'dark');
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });
});

describe('Button', () => {
  it('defaults to a ghost type="button" and uses the brand fill only for primary', () => {
    render(
      <>
        <Button>Cancel</Button>
        <Button variant="primary">Save</Button>
      </>,
    );
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel).toHaveAttribute('type', 'button');
    expect(cancel.className).not.toContain('bg-brand');
    expect(screen.getByRole('button', { name: 'Save' }).className).toContain('bg-brand');
  });
});

describe('Field', () => {
  it('wires the label, and marks errors for assistive tech', () => {
    render(<Field label="Email" hint="We never share it" error="Required" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
    expect(screen.queryByText('We never share it')).not.toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders title, body and one action', () => {
    render(
      <EmptyState
        title="No invoices yet"
        body="Add one to start."
        action={<Button>Add invoice</Button>}
      />,
    );
    expect(screen.getByText('No invoices yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add invoice' })).toBeInTheDocument();
  });
});
