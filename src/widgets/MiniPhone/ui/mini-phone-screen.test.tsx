import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewSwitcher } from './mini-phone-screen';
import type { MiniPhoneView } from '@/shared/hooks/useMiniPhoneController';

describe('ViewSwitcher', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders both buttons', () => {
    render(<ViewSwitcher activeView="dialer" onChange={mockOnChange} />);

    expect(screen.getByText('📞 Звонки')).toBeInTheDocument();
    expect(screen.getByText('🤝 Общий экран')).toBeInTheDocument();
  });

  it('highlights active view correctly', () => {
    const { rerender } = render(
      <ViewSwitcher activeView="dialer" onChange={mockOnChange} />
    );

    const dialerButton = screen.getByText('📞 Звонки');
    const generalButton = screen.getByText('🤝 Общий экран');

    expect(dialerButton).toHaveClass('bg-blue-600', 'text-white');
    expect(generalButton).toHaveClass('text-gray-600');

    rerender(<ViewSwitcher activeView="general" onChange={mockOnChange} />);

    expect(dialerButton).toHaveClass('text-gray-600');
    expect(generalButton).toHaveClass('bg-blue-600', 'text-white');
  });

  it('calls onChange when dialer button is clicked', async () => {
    const user = userEvent.setup();
    render(<ViewSwitcher activeView="general" onChange={mockOnChange} />);

    const dialerButton = screen.getByText('📞 Звонки');
    await user.click(dialerButton);

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith('dialer');
  });

  it('calls onChange when general button is clicked', async () => {
    const user = userEvent.setup();
    render(<ViewSwitcher activeView="dialer" onChange={mockOnChange} />);

    const generalButton = screen.getByText('🤝 Общий экран');
    await user.click(generalButton);

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith('general');
  });
});

