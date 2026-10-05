import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import {
  Button,
  Checkbox,
  Drawer,
  EmptyState,
  Field,
  Pane,
  Segmented,
  StatusDot,
  ThemeToggle,
} from './index.ts';
import { AppHeader, AppShell, Section, ViewHeader } from '../shell/index.ts';

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
  it('defaults to a ghost type="button" and fills only the primary, in ink rather than the accent', () => {
    render(
      <>
        <Button>Cancel</Button>
        <Button variant="primary">Save</Button>
      </>,
    );
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel).toHaveAttribute('type', 'button');
    expect(cancel.className).not.toContain('bg-ink');
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save.className).toContain('bg-ink');
    expect(save.className).not.toContain('brand');
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

describe('Segmented', () => {
  it('marks the selected option and reports the new choice', async () => {
    const user = userEvent.setup();
    const choices: string[] = [];
    render(
      <Segmented
        label="Filter by platform"
        options={[
          { value: 'all', label: 'All', count: 3 },
          { value: 'web', label: 'Web', count: 1 },
        ]}
        value="all"
        onChange={(value) => choices.push(value)}
      />,
    );
    expect(screen.getByRole('group', { name: 'Filter by platform' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All 3' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Web 1' }));
    expect(choices).toEqual(['web']);
  });
});

describe('Checkbox', () => {
  it('is a real checkbox that its label controls', async () => {
    const user = userEvent.setup();
    render(
      <label>
        <Checkbox /> Done
      </label>,
    );
    const box = screen.getByRole('checkbox', { name: 'Done' });
    await user.click(screen.getByText('Done'));
    expect(box).toBeChecked();
  });
});

describe('Section', () => {
  it('is a landmark named by its title, with its index and label in the rail', () => {
    render(
      <Section id="list" index="01" label="Checklist" title="Every switch">
        <p>content</p>
      </Section>,
    );
    const region = screen.getByRole('region', { name: 'Every switch' });
    expect(region).toHaveAttribute('id', 'list');
    expect(region).toHaveTextContent('01');
    expect(region).toHaveTextContent('Checklist');
  });

  it('falls back to the rail label as its name when it has no title', () => {
    render(
      <Section id="list" index="01" label="Checklist">
        <p>content</p>
      </Section>,
    );
    expect(screen.getByRole('region', { name: 'Checklist' })).toBeInTheDocument();
  });
});

describe('AppShell', () => {
  it('puts the view right under the bar, with the current screen marked in the nav', () => {
    render(
      <AppShell
        header={
          <AppHeader
            nav={[
              { href: '/', label: 'board' },
              { href: '/new', label: 'new' },
            ]}
            current="/"
          />
        }
      >
        <ViewHeader title="Board" meta="3 projects" />
      </AppShell>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Board' })).toBeInTheDocument();
    // Desktop tabs and the phone row render the same nav; CSS shows one of them.
    const current = screen.getAllByRole('link', { name: 'board' });
    expect(current[0]).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link', { name: 'new' })[0]).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('main')).toHaveTextContent('3 projects');
  });
});

describe('Pane', () => {
  it('is a region named by its label', () => {
    render(
      <Pane label="Recent" aside="4">
        <p>rows</p>
      </Pane>,
    );
    expect(screen.getByRole('region', { name: 'Recent' })).toHaveTextContent('rows');
  });
});

describe('StatusDot', () => {
  it('says its status in words', () => {
    render(<StatusDot tone="success" label="Up" />);
    expect(screen.getByRole('img', { name: 'Up' })).toBeInTheDocument();
  });
});

describe('Drawer', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open</Button>
        <Drawer open={open} onClose={() => setOpen(false)} title="New idea">
          <p>form</p>
        </Drawer>
      </>
    );
  }

  it('opens as a named dialog, takes focus, and closes on Escape with focus restored', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'New idea' });
    expect(dialog).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('closes from its close button', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
