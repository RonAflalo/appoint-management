import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';

// Mock the API module
vi.mock('../api/auth', () => ({
  getMe: vi.fn(),
}));

import { getMe } from '../api/auth';

function TestConsumer() {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  if (!user) return <div>no user</div>;
  return <div>user:{user.email}</div>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', async () => {
    // Never resolves during render
    getMe.mockReturnValue(new Promise(() => {}));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByText('loading')).toBeInTheDocument();
  });

  it('sets user when getMe resolves successfully', async () => {
    getMe.mockResolvedValue({ user: { id: 1, email: 'test@example.com', role: 'admin' } });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('user:test@example.com')).toBeInTheDocument();
    });
  });

  it('sets null user when getMe rejects', async () => {
    getMe.mockRejectedValue(new Error('Unauthorized'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('no user')).toBeInTheDocument();
    });
  });

  it('exposes setUser to allow manual updates', async () => {
    getMe.mockResolvedValue({ user: { id: 1, email: 'initial@example.com', role: 'user' } });

    function SetUserConsumer() {
      const { user, setUser, loading } = useAuth();
      if (loading) return <div>loading</div>;
      return (
        <div>
          <span>{user ? user.email : 'no user'}</span>
          <button onClick={() => setUser({ id: 2, email: 'updated@example.com', role: 'admin' })}>
            Update
          </button>
        </div>
      );
    }

    const { getByText } = render(
      <AuthProvider>
        <SetUserConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(getByText('initial@example.com')).toBeInTheDocument());

    getByText('Update').click();

    await waitFor(() => expect(getByText('updated@example.com')).toBeInTheDocument());
  });
});
