import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccessDeniedScene } from './AccessDeniedScene';
import { COPY } from '../../config/constants';
import { formatDeniedBalance, formatDeniedRequired } from '../../utils/deniedCopy';

describe('AccessDeniedScene', () => {
  it('shows the cinematic denied copy, required threshold, and wallet balance', () => {
    const onTryAnotherWallet = vi.fn();
    const onDisconnect = vi.fn();
    render(
      <AccessDeniedScene
        visible
        balanceLabel="742,381"
        thresholdLabel="1,000,000"
        onTryAnotherWallet={onTryAnotherWallet}
        onDisconnect={onDisconnect}
      />,
    );

    expect(screen.getByTestId('denied-overlay')).toBeInTheDocument();
    expect(screen.getByText(COPY.insufficient)).toBeInTheDocument();
    expect(screen.getByText(COPY.insufficientSub)).toBeInTheDocument();
    expect(screen.getByText(formatDeniedRequired('1,000,000'))).toBeInTheDocument();
    expect(screen.getByText(formatDeniedBalance('742,381'))).toBeInTheDocument();
    expect(screen.queryByText('ACCESS GRANTED')).not.toBeInTheDocument();
    expect(screen.queryByText('THE FOREST KNOWS WHAT YOU CARRY.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: COPY.tryAnotherWallet }));
    expect(onTryAnotherWallet).toHaveBeenCalledTimes(1);
    expect(onDisconnect).not.toHaveBeenCalled();
  });

  it('Disconnect does not automatically re-run a holder check', () => {
    const onTryAnotherWallet = vi.fn();
    const onDisconnect = vi.fn();
    render(
      <AccessDeniedScene
        visible
        balanceLabel="12"
        thresholdLabel="1,000,000"
        onTryAnotherWallet={onTryAnotherWallet}
        onDisconnect={onDisconnect}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: COPY.disconnectWallet }));
    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(onTryAnotherWallet).not.toHaveBeenCalled();
  });
});
