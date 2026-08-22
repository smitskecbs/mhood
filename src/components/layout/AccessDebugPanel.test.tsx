import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccessDebugPanel } from './AccessDebugPanel';

vi.mock('../../config/wallets', async () => {
  const actual = await vi.importActual<typeof import('../../config/wallets')>('../../config/wallets');
  return {
    ...actual,
    isGateDebugEnabled: () => false,
  };
});

describe('AccessDebugPanel', () => {
  it('does not render when the debug flag is off', () => {
    const { container } = render(
      <AccessDebugPanel
        wallet={null}
        status="disconnected"
        mint={null}
        balance={null}
        error={null}
        checking={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/DEV gate/i)).not.toBeInTheDocument();
  });
});
