import React, { useState } from 'react';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import type { Session } from './session.js';
import { MicrosendrAuth } from './auth-shell.js';
import './personal.css';

export function BusinessLogin({ brand, go, onSession, themeToggle, session, saveWorkspace = false }: { brand: React.ReactNode; go: (path: string) => void; onSession: (session: Session) => void; themeToggle: React.ReactNode; session?: Session; saveWorkspace?: boolean }) {
  const [inviteToken] = useState(() => new URLSearchParams(location.hash.slice(1)).get('invite') ?? undefined);
  return <div className="personal-auth ms-login-page"><header><button onClick={() => go('/')}>{brand}</button>{themeToggle}</header>
    <main className="personal-auth-main"><div className="personal-auth-story"><span className="personal-eyebrow">MICROSENDR BUSINESS</span><h1>Move business forward.</h1><p>Payments, balances and developer tools in one workspace.</p><div className="personal-auth-proof"><ShieldCheck size={19}/> Sandbox access. Business verification is required before simulated activity.</div></div>
      <section className="personal-card personal-auth-card"><span className="personal-eyebrow">BUSINESS</span><h2>{inviteToken ? 'Join your team' : saveWorkspace ? 'Save your workspace' : 'Welcome back'}</h2><MicrosendrAuth mode="business" csrf={session?.csrf_token} inviteToken={inviteToken} saveWorkspace={saveWorkspace} onComplete={result => { onSession(result); go('/app/overview'); }}/><button className="personal-text" onClick={() => go('/personal/login')}>Personal account <ArrowUpRight size={15}/></button></section>
    </main></div>;
}
