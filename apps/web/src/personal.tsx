import React, { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2, History, Home, LogOut, Menu, Send, ShieldCheck, UserRound, Wallet } from 'lucide-react';
import './personal.css';

type Session = { authenticated: boolean; csrf_token?: string; email?: string; kyc_state?: string; residence_country?: string | null; display_currency?: string };
type HomeData = { email: string; kyc_state: string; sandbox_funded: boolean; balance: { available_minor: string; pending_minor: string; held_minor: string; simulated: true } };
type Transfer = { id: string; amount_minor: string; direction: 'sent' | 'received'; counterparty: string; created_at: string; status: string };
const money = (minor: string) => {
  const amount = BigInt(minor), sign = amount < 0n ? '-' : '', absolute = amount < 0n ? -amount : amount;
  return `${sign}₦${new Intl.NumberFormat('en-NG').format(absolute / 100n)}.${(absolute % 100n).toString().padStart(2, '0')}`;
};

async function request<T>(path: string, method = 'GET', body?: object, csrf?: string, key?: string): Promise<T> {
  const response = await fetch(path, { method, credentials: 'include', headers: {
    ...(body ? { 'content-type': 'application/json' } : {}),
    ...(csrf ? { 'x-kora-csrf': csrf } : {}),
    ...(key ? { 'idempotency-key': key } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? 'Request failed');
  return result as T;
}

export function PersonalPage({ go, path, brand, themeToggle }: { go: (path: string) => void; path: string; brand: React.ReactNode; themeToggle: React.ReactNode }) {
  const [session, setSession] = useState<Session>();
  const [home, setHome] = useState<HomeData>();
  const [activity, setActivity] = useState<Transfer[]>([]);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [menu, setMenu] = useState(false);
  const tab = path.split('/')[2] || 'home';
  const refresh = async () => {
    const s = await request<Session>('/personal/api/session');
    setSession(s);
    if (s.authenticated) {
      const [h, a] = await Promise.all([request<HomeData>('/personal/api/home'), request<{ data: Transfer[] }>('/personal/api/activity')]);
      setHome(h); setActivity(a.data);
    }
  };
  useEffect(() => { void refresh().catch((e) => setError(e.message)); void request<{ enabled: boolean }>('/personal/api/auth/config').then((c) => setEnabled(c.enabled)).catch(() => setEnabled(false)); }, []);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
    finally { setBusy(false); }
  };
  const start = (e: FormEvent) => { e.preventDefault(); void run(async () => {
    const result = await request<{ challenge_id: string }>('/personal/api/auth/start', 'POST', { email });
    setChallenge(result.challenge_id); setNotice('Check your email for a six-digit code.');
  }); };
  const verify = (e: FormEvent) => { e.preventDefault(); void run(async () => {
    const next = await request<Session>('/personal/api/auth/verify', 'POST', { challenge_id: challenge, code });
    setSession(next); await refresh(); go('/personal/home');
  }); };
  const verifySandbox = () => void run(async () => {
    await request('/personal/api/sandbox/verify', 'POST', { residence_country: 'NG', acknowledge_simulation: true }, session?.csrf_token);
    await refresh(); setNotice('Sandbox verification fixture enabled. This does not verify your real identity.');
  });
  const fund = () => void run(async () => {
    await request('/personal/api/sandbox/fund', 'POST', {}, session?.csrf_token);
    await refresh(); setNotice('₦100,000.00 in simulated funds added.');
  });
  const send = (e: FormEvent) => { e.preventDefault(); void run(async () => {
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) throw new Error('Enter a valid NGN amount');
    const [whole, fraction = ''] = amount.split('.');
    const amount_minor = (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))).toString();
    if (amount_minor === '0') throw new Error('Enter an amount greater than zero');
    await request('/personal/api/transfers', 'POST', { recipient_email: recipient, amount_minor }, session?.csrf_token, crypto.randomUUID());
    setAmount(''); setRecipient(''); await refresh(); go('/personal/activity'); setNotice('Transfer completed in the Kora sandbox.');
  }); };
  const logout = () => void run(async () => { await request('/personal/api/logout', 'POST', {}, session?.csrf_token); setSession({ authenticated: false }); setHome(undefined); go('/personal/login'); });
  const nav = [ ['home', 'Home', Home], ['send', 'Send', Send], ['activity', 'Activity', History], ['profile', 'Profile', UserRound] ] as const;
  if (!session) return <div className="personal-loading">{brand}<p>Opening Personal…</p></div>;
  if (!session.authenticated) return <div className="personal-auth">
    <header><button onClick={() => go('/')}>{brand}</button>{themeToggle}</header>
    <main className="personal-auth-main"><div className="personal-auth-story"><span className="personal-eyebrow">KORA PERSONAL</span><h1>Money moves better when it feels simple.</h1><p>Your financial account for sending value across the Kora network. Start with a simulated NGN balance while Personal is in sandbox.</p><div className="personal-auth-proof"><ShieldCheck size={19}/> No real funds or providers are connected to this Personal preview.</div></div>
      <section className="personal-card personal-auth-card"><span className="personal-eyebrow">PERSONAL SIGN-IN</span><h2>{challenge ? 'Enter your code' : 'Welcome to Kora'}</h2><p>Personal and Business have separate sign-ins.</p>
        {error && <p className="personal-error" role="alert">{error}</p>}{notice && <p className="personal-success" role="status">{notice}</p>}
        {challenge ? <form onSubmit={verify}><label>Six-digit code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required /></label><button className="personal-primary" disabled={busy || code.length !== 6}>Sign in <ArrowRight size={17}/></button><button type="button" className="personal-text" onClick={() => { setChallenge(''); setCode(''); }}>Use another email</button></form> : <form onSubmit={start}><label>Email address<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></label><button className="personal-primary" disabled={busy || !enabled}>Send sign-in code <ArrowRight size={17}/></button>{!enabled && <p className="personal-muted">Email sign-in will open when Kora's SMTP service is configured.</p>}</form>}
        <button className="personal-text" onClick={() => go('/business/login')}>Looking for Kora Business? <ArrowUpRight size={15}/></button>
      </section></main></div>;
  return <div className="personal-shell"><aside className={`personal-sidebar ${menu ? 'open' : ''}`}><button className="personal-brand" onClick={() => go('/personal/home')}>{brand}</button><div className="personal-sidebar-caption">PERSONAL ACCOUNT <span>Sandbox</span></div><nav>{nav.map(([id,label,Icon]) => <button key={id} className={tab===id?'active':''} onClick={() => {go('/personal/'+id);setMenu(false);}}><Icon size={19}/>{label}</button>)}</nav><div className="personal-sidebar-bottom"><div className="personal-sandbox-note"><ShieldCheck size={18}/><span>Simulated NGN only<br/><small>No live money movement</small></span></div><button onClick={logout}><LogOut size={18}/> Sign out</button></div></aside>
    {menu && <button className="personal-scrim" aria-label="Close menu" onClick={() => setMenu(false)}/>}
    <div className="personal-main"><header className="personal-topbar"><button className="personal-mobile-menu" aria-label="Open menu" onClick={() => setMenu(true)}><Menu size={22}/></button><span>Personal <b>/ {nav.find(([id])=>id===tab)?.[1] ?? 'Home'}</b></span><div>{themeToggle}<span className="personal-avatar">{session.email?.slice(0,1).toUpperCase()}</span></div></header><main className="personal-content">
      {error && <p className="personal-error" role="alert">{error}</p>}{notice && <p className="personal-success" role="status">{notice}</p>}
      {tab==='home' && <><div className="personal-heading"><span className="personal-eyebrow">YOUR ACCOUNT</span><h1>Good to see you.</h1><p>One place to see and move your Kora balance.</p></div><div className="personal-balance"><div><span>AVAILABLE · SIMULATED NGN</span><strong>{money(home?.balance.available_minor ?? '0')}</strong><small>NGN is the underlying position. Display currency is a viewing preference.</small></div><Wallet size={38}/></div><div className="personal-actions"><button onClick={() => go('/personal/send')}><Send size={20}/> Send <ArrowRight size={17}/></button><button onClick={() => go('/personal/activity')}><History size={20}/> Activity <ArrowRight size={17}/></button></div><section className="personal-card"><h2>Getting started</h2>{home?.kyc_state !== 'sandbox_approved' ? <><p>Complete the explicit sandbox verification fixture before simulated transfers. Real money movement will require actual KYC.</p><button className="personal-primary" onClick={verifySandbox} disabled={busy}>Enable sandbox verification <ArrowRight size={17}/></button></> : home.sandbox_funded ? <><p>Your simulated NGN balance is ready. Send to another eligible Kora Personal account.</p><button className="personal-primary" onClick={() => go('/personal/send')}>Send simulated NGN <ArrowRight size={17}/></button></> : <><p>Your Personal account is eligible for simulated NGN transfers.</p><button className="personal-primary" onClick={fund} disabled={busy}>Add ₦100,000 test funds <ArrowRight size={17}/></button><small>One-time sandbox fixture. No bank deposit occurs.</small></>}</section></>}
      {tab==='send' && <><div className="personal-heading"><span className="personal-eyebrow">SEND</span><h1>Who are you paying?</h1><p>Enter another eligible Kora Personal email. Internal transfers complete on Kora's ledger.</p></div><section className="personal-card personal-form-card"><form onSubmit={send}><label>Recipient email<input type="email" value={recipient} onChange={(e)=>setRecipient(e.target.value)} placeholder="friend@example.com" required/></label><label>Amount in NGN<input inputMode="decimal" value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="0.00" required/></label><div className="personal-form-summary"><span>Fee</span><b>₦0.00 · Sandbox</b></div><button className="personal-primary" disabled={busy || home?.kyc_state!=='sandbox_approved'}>Send simulated NGN <ArrowRight size={17}/></button>{home?.kyc_state!=='sandbox_approved' && <p className="personal-muted">Enable sandbox verification on Home first.</p>}</form></section></>}
      {tab==='activity' && <><div className="personal-heading"><span className="personal-eyebrow">ACTIVITY</span><h1>Your money, in motion.</h1><p>Every simulated transfer has a permanent ledger record.</p></div><section className="personal-card personal-activity"><h2>Recent activity</h2>{activity.length ? activity.map((item)=><div key={item.id} className="personal-activity-row"><span className="personal-activity-icon">{item.direction==='sent'?<ArrowUpRight size={20}/>:<ArrowLeft size={20}/>}</span><span><b>{item.direction==='sent'?'Sent to':'Received from'} {item.counterparty}</b><small>{new Date(item.created_at).toLocaleString()} · Simulated · Completed</small></span><strong>{item.direction==='sent'?'-':'+'}{money(item.amount_minor)}</strong></div>) : <p className="personal-muted">No transfers yet. Your first simulated payment will appear here.</p>}</section></>}
      {tab==='profile' && <><div className="personal-heading"><span className="personal-eyebrow">PROFILE</span><h1>Account details.</h1><p>Identity, access, and account preferences.</p></div><section className="personal-card personal-profile"><div><span>Email</span><b>{session.email}</b></div><div><span>Residence</span><b>{session.residence_country==='NG'?'Nigeria':'Not set'}</b></div><div><span>Display currency</span><b>{session.display_currency ?? 'NGN'}</b></div><div><span>Verification</span><b>{session.kyc_state==='sandbox_approved'?'Sandbox fixture approved':'Not started'}</b></div><p>Real transfers will require identity verification and a supported regulated partner. Sandbox approval does not grant real-money access.</p></section></>}
    </main></div></div>;
}
