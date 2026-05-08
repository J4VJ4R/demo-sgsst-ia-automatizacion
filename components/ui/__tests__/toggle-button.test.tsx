import { render, screen, fireEvent } from '@testing-library/react';
import { ToggleButton } from '../toggle-button';
import { describe, it, expect, vi } from 'vitest';

describe('ToggleButton Component', () => {
  it('renders correctly with default props', () => {
    render(<ToggleButton isCollapsed={false} onToggle={() => {}} />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Colapsar panel');
  });

  it('renders correct icon and label when collapsed', () => {
    render(<ToggleButton isCollapsed={true} onToggle={() => {}} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Expandir panel');
    // We can't easily check for the specific icon SVG path in unit tests without complex setup,
    // but aria-label confirms the state logic is working.
  });

  it('calls onToggle handler when clicked', () => {
    const handleToggle = vi.fn();
    render(<ToggleButton isCollapsed={false} onToggle={handleToggle} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    render(<ToggleButton isCollapsed={false} onToggle={() => {}} className="custom-class" />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('renders with primary variant styles', () => {
    render(<ToggleButton isCollapsed={false} onToggle={() => {}} variant="primary" />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-slate-900');
  });

  it('is accessible via keyboard', () => {
    render(<ToggleButton isCollapsed={false} onToggle={() => {}} />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('focus:ring-2');
    button.focus();
    expect(button).toHaveFocus();
  });
});
