'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { RepoError } from '@/admin/repository';
import { validateLogin, type LoginField } from '@/admin/validation/auth';
import { useAdmin } from '../AdminProvider';
import { ErrorSummary, TextField } from '../fields';
import { Alert } from '../ui';

type Banner = 'none' | 'wrong' | 'throttled' | 'expired' | 'unavailable';

/**
 * A-01 (FR-13, NFR-07). The form is checked in the browser for instant messages, then sent to the sign-in server
 * action, which checks it again and asks Supabase Auth. Whatever is wrong (unknown email, wrong password, an
 * account that is not an admin) the message is the same, so nobody can guess accounts. After too many failures
 * the throttling message is shown. The password is cleared after every submit and never stored or logged.
 */
export function LoginScreen({ expired = false }: { expired?: boolean }) {
  const router = useRouter();
  const { repo, controls } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<LoginField, string>>>({});
  const [banner, setBanner] = useState<Banner>(expired ? 'expired' : 'none');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (banner === 'throttled' || busy) return;
    const result = validateLogin({ email, password });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await repo.signIn(result.value.email, password);
      setPassword('');
      router.push('/admin');
      router.refresh();
    } catch (e) {
      setPassword('');
      const code = e instanceof RepoError ? e.code : 'invalid';
      setBanner(
        code === 'throttled' ? 'throttled' : code === 'load_failed' ? 'unavailable' : 'wrong',
      );
    } finally {
      setBusy(false);
    }
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
          {banner === 'unavailable' ? (
            <Alert tone="err" title="Sign-in is not available right now.">
              Please try again in a minute. If it keeps happening, tell the Createex team.
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
              disabled={throttled || busy}
              aria-disabled={throttled || busy}
            >
              Log in
            </button>
          </form>
          <p className="small muted" style={{ margin: 'var(--sp-4) 0 0', textAlign: 'center' }}>
            Staff only. The same message is shown whichever field is wrong, so nobody can guess
            accounts.
          </p>
        </div>

        {controls === null ? null : (
          <details className="card" style={{ maxWidth: '26rem', width: '100%' }}>
            <summary>Mock only: preview other login states</summary>
            <p className="small muted">
              Test mode has no real sign-in, so these buttons show the messages the real login
              shows.
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
        )}
      </div>
    </main>
  );
}
