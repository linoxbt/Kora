import React, { useEffect, useRef, useState } from 'react';
import { Captcha, PrivyProvider, useLoginWithEmail, usePrivy } from '@privy-io/react-auth';
import { ArrowRight, ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import type { EmailLoginProps } from './login.js';

function EmailForm({ session, saveWorkspace, inviteToken, onSession }: EmailLoginProps) {
  const { ready, authenticated, getAccessToken, logout } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const [email, setEmail] = useState(''),
    [code, setCode] = useState('');
  const [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(''),
    [cooldown, setCooldown] = useState(0);
  const submitting = useRef(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function exchange() {
    const access_token = await getAccessToken();
    if (!access_token) throw new Error('Please sign in again to verify your account.');
    const r = await fetch('/console/auth/privy', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        ...(session.csrf_token ? { 'x-kora-csrf': session.csrf_token } : {}),
      },
      body: JSON.stringify({
        access_token,
        link_current: saveWorkspace,
        ...(inviteToken ? { invite_token: inviteToken } : {}),
      }),
    });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error?.message ?? 'Unable to open your workspace');
    // Kora uses its own HttpOnly session; finish the temporary provider login.
    // A cleanup failure must not turn a successful workspace login into a retry.
    await logout().catch(() => undefined);
    setCode('');
    setEmail('');
    onSession(result);
  }
  async function action(run: () => Promise<void>) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await run();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in. Try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  const send = () =>
    action(async () => {
      await sendCode({ email: email.trim() });
      setSent(true);
      setCooldown(30);
    });
  return (
    <>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {authenticated ? (
        <>
          <p className="muted">
            Your email is verified. Continue to {saveWorkspace ? 'save' : 'open'} your workspace.
          </p>
          <button
            className="button primary full"
            disabled={busy || !ready}
            onClick={() => void action(exchange)}
          >
            {busy ? 'Opening workspace…' : 'Continue to workspace'}
            <ArrowRight size={16} />
          </button>
          <button className="text-button" disabled={busy} onClick={() => void action(logout)}>
            Use a different account
          </button>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!sent) void send();
            else
              void action(async () => {
                await loginWithCode({ code });
                await exchange();
              });
          }}
        >
          {sent ? (
            <>
              <div className="login-code-heading">
                <span>
                  <Mail size={20} />
                </span>
                <p>
                  We sent a code to <b>{email}</b>
                </p>
              </div>
              <label>
                Verification code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  disabled={busy}
                  autoFocus
                />
              </label>
            </>
          ) : (
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                disabled={busy}
              />
            </label>
          )}
          <button
            className="button primary full"
            disabled={busy || !ready || (sent ? code.length !== 6 : !email.trim())}
          >
            {busy ? 'Please wait…' : sent ? 'Verify & sign in' : 'Continue with email'}
            <ArrowRight size={16} />
          </button>
          {sent && (
            <div className="login-code-actions">
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setSent(false);
                  setCode('');
                  setError('');
                }}
              >
                <ArrowLeft size={14} />
                Change email
              </button>
              <button
                type="button"
                className="text-button"
                disabled={busy || cooldown > 0}
                onClick={() => void send()}
              >
                {cooldown ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          )}
          <Captcha />
        </form>
      )}
      <p className="login-security">
        <ShieldCheck size={15} />
        Secure email verification by Privy. No password needed.
      </p>
    </>
  );
}
export default function PrivyEmailLogin(props: EmailLoginProps) {
  return (
    <PrivyProvider
      appId={props.config.app_id!}
      clientId={props.config.client_id ?? undefined}
      config={{
        loginMethods: ['email'],
        embeddedWallets: { ethereum: { createOnLogin: 'off' }, solana: { createOnLogin: 'off' } },
        appearance: { theme: 'light', accentColor: '#204b38' },
      }}
    >
      <EmailForm {...props} />
    </PrivyProvider>
  );
}
