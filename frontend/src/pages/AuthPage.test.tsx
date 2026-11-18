import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import AuthPage from './AuthPage';

const register = vi.fn();
const login = vi.fn();

vi.mock('../lib/api', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    refreshSession: vi.fn(async () => null),
    api: { ...actual.api, register: (...a: unknown[]) => register(...a), login: (...a: unknown[]) => login(...a) },
  };
});

function renderAuth(path = '/auth') {
  return render(
    <ThemeProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={<p>dashboard</p>} />
            <Route path="/board/:id" element={<p>board page</p>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  register.mockReset();
  login.mockReset();
  window.matchMedia ??= (() => ({ matches: false })) as unknown as typeof window.matchMedia;
});

describe('AuthPage', () => {
  it('signs in and returns to the page the user was headed to', async () => {
    login.mockResolvedValue({});
    renderAuth('/auth?next=%2Fboard%2FABCD2345');
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(login).toHaveBeenCalledWith('ada@example.com', 'secret password');
    await waitFor(() => expect(screen.getByText('board page')).toBeInTheDocument());
  });

  it('shows the display name field when creating an account', async () => {
    register.mockResolvedValue({});
    renderAuth();
    await userEvent.click(screen.getByRole('tab', { name: 'Create account' }));
    await userEvent.type(screen.getByLabelText('Display name'), '  Ms. Frizzle ');
    await userEvent.type(screen.getByLabelText('Email'), 'frizzle@school.edu');
    await userEvent.type(screen.getByLabelText('Password'), 'magic school bus');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(register).toHaveBeenCalledWith('frizzle@school.edu', 'magic school bus', 'Ms. Frizzle');
  });

  it('shows server errors', async () => {
    login.mockRejectedValue(new Error('Incorrect email or password'));
    renderAuth();
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
  });
});
