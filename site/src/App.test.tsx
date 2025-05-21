import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import '@testing-library/jest-dom';

describe('ChoreTracker', () => {
  it('renders without errors', async () => {
    render(<App />);

    await waitFor(async () => {
      const h1 = screen.getByText('Chore Tracker');

      expect(h1).toBeInTheDocument();
    });
  });
});
