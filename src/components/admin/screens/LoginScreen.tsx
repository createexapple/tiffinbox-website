'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { validateLogin, type LoginField } from '@/admin/validation/auth';
import { ErrorSummary, TextField } from '../fields';
import { Alert } from '../ui';

type Banner = 'none' | 'wrong' | 'throttled' | 'expired';

/**
 * A-01. MOCK AUTH (Stage 2): the form checks the input and goes to the dashboard. There is no real
 * authentication: the password is never stored, compared, sent anywhere or logged, and it is cleared after
 * submit. Stage 3 replaces `onSubmit` with the Supabase sign-in server action; generic error, throttling
 * and session-expiry messages already match the PRD (FR-13, NFR-07).
 */
export function LoginScreen({ expired = false }: { expired?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<LoginField, string>>>({});
  const [banner, setBanner] = useState<Banner>(expired ? 'expired' : 'none');

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (banner === 'throttled') return;
    const result = validateLogin({ email, password });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setPassword('');
    router.push('/admin');
  }

  const throttled = banner === 'throttled';

  return (
    <main id="main">
      <div className="login">
        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: 'var(--sp-4)' }}>
            <span
              className="logo-ph"
              role="img"
              aria-label="Logo placeholder"
              style={{ margin: '0 auto' }}
            >
              Tiffin Box
            </span>
          </div>
          <h1 style={{ fontSize: 'var(--fs-2xl)', textAlign: 'center' }}>Admin login</h1>

          {banner === 'wrong' ? (
            <Alert tone="err" title="Email or password is not correct.">
              Please check and try again.
            </Alert>
          ) : null}
          {throttled ? (
            <Alert tone="err" title="Too many attempts.">
              Please wait 10 minutes and try again. If you forgot your password, ask the owner.
            </Alert>
          ) : null}
          {banner === 'expired' ? (
            <Alert tone="info" title="You were logged out.">
              For your safety we log you out after 30 minutes of no activity. Please log in again.
            </Alert>
          ) : null}

          <form noValidate onSubmit={onSubmit} style={{ marginTop: 'var(--sp-4)' }}>
            <ErrorSummary
              errors={errors}
              labels={{
                email: { id: 'login-email', label: 'Email' },
                password: { id: 'login-password', label: 'Password' },
              }}
            />
            <TextField
              id="login-email"
              label="Email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={setEmail}
              error={errors.email}
            />
            <TextField
              id="login-password"
              label="Password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              error={errors.password}
            />
            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={throttled}
              aria-disabled={throttled}
            >
              Log in
            </button>
          </form>
          <p className="small muted" style={{ margin: 'var(--sp-4) 0 0', textAlign: 'center' }}>
            Staff only. The same message is shown whichever field is wrong, so nobody can guess
            accounts.
          </p>
        </div>

        <details className="card" style={{ maxWidth: '26rem', width: '100%' }}>
          <summary>Mock only: preview other login states</summary>
          <p className="small muted">
            Real sign-in does not exist in Stage 2, so these buttons show the messages Stage 3 will
            show.
          </p>
          <div className="cta-row">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setBanner('wrong')}
            >
              Wrong credentials
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setBanner('throttled')}
            >
              Throttled
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setBanner('expired')}
            >
              Session expired
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setBanner('none')}
            >
              Clear
            </button>
          </div>
        </details>
      </div>
    </main>
  );
}
