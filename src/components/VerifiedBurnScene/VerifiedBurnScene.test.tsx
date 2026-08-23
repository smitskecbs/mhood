import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { COPY } from '../../config/constants';
import { VerifiedBurnScene } from './VerifiedBurnScene';
import type { VerifiedBurnSuccess } from '../../utils/verifiedBurnScene';

const success: VerifiedBurnSuccess = {
  signature: '3zHkVerifiedBurnSignatureForTestsEzsH',
  amountUi: '2',
  wallet: 'DemoWallet11111111111111111111111111',
};

describe('VerifiedBurnScene', () => {
  it('shows the verified amount, shortened signature, and Solscan link', () => {
    const onBackToForest = vi.fn();
    render(<VerifiedBurnScene success={success} burnRank={4} onBackToForest={onBackToForest} />);

    expect(screen.getByTestId('verified-burn-scene')).toBeInTheDocument();
    expect(screen.getByText(COPY.verifiedBurn)).toBeInTheDocument();
    expect(screen.getByText('2 MHOOD')).toBeInTheDocument();
    expect(screen.getByText(COPY.burnedWord)).toBeInTheDocument();
    expect(screen.getByText('3zHk...EzsH')).toBeInTheDocument();
    expect(screen.getByText(COPY.confirmedOnChain)).toBeInTheDocument();
    expect(screen.getByText('Burn Rank #4')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: COPY.viewTransaction })).toHaveAttribute(
      'href',
      `https://solscan.io/tx/${success.signature}`,
    );
    expect(screen.getByRole('link', { name: COPY.viewTransaction })).toHaveAttribute('target', '_blank');

    fireEvent.click(screen.getByRole('button', { name: COPY.backToForest }));
    expect(onBackToForest).toHaveBeenCalledTimes(1);
  });

  it('hides burn rank when it is not reliably available', () => {
    render(<VerifiedBurnScene success={success} burnRank={null} onBackToForest={() => undefined} />);
    expect(screen.queryByText(/Burn Rank/)).not.toBeInTheDocument();
  });

  it('does not render embers when reduced motion is preferred', () => {
    const { container } = render(
      <VerifiedBurnScene success={success} burnRank={null} reducedMotion onBackToForest={() => undefined} />,
    );
    expect(container.querySelector('.burn-success__embers')).toBeNull();
    expect(container.querySelector('.burn-success__pulse')).toBeNull();
    expect(container.querySelector('.burn-success')?.classList.contains('is-reduced')).toBe(true);
    expect(screen.getByText('2 MHOOD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: COPY.backToForest })).toBeInTheDocument();
  });
});
