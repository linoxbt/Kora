import React, { useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import './business.css';

export function BusinessPage({ header, brand, go }: { header: ReactNode; brand: ReactNode; go: (path: string) => void }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setState('sending'); setError('');
    try {
      const body = new URLSearchParams();
      for (const [key, value] of new FormData(form)) body.append(key, String(value));
      const response = await fetch('/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: body.toString() });
      if (!response.ok) throw new Error('Your request could not be sent. Please try again.');
      setState('sent'); form.reset();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your request could not be sent.'); setState('idle'); }
  };
  return <div className="ms-business-page ms-site">{header}<main>
    <section className="ms-business-hero"><div><span className="ms-kicker"><i/> MICROSENDR BUSINESS</span><h1>Let’s move<br/>business forward.</h1><p>Tell us where you want to go. We’ll discuss the right account, integration and next steps with you.</p><a className="ms-button" href="#book-call">Request a call <ArrowRight size={18}/></a><span className="ms-business-hero-note"><ShieldCheck size={16}/> Business access is reviewed before onboarding.</span></div><img src="/images/business-payments.webp" alt="Business team reviewing reports around a laptop"/></section>
    <section className="ms-business-offer"><span className="ms-kicker"><i/> WHAT WE CAN DISCUSS</span><h2>One conversation. A clearer path.</h2><div><article><span>01</span><h3>Move value</h3><p>Explore settlement flows and eligible payout destinations.</p></article><article><span>02</span><h3>Build on the API</h3><p>Review your integration and sandbox needs.</p></article><article><span>03</span><h3>Operate with clarity</h3><p>Discuss balances, reporting and team access.</p></article></div><small>Current products are sandbox only. Real-money capabilities require partner and regulatory approval.</small></section>
    <section className="ms-business-book" id="book-call"><div><span className="ms-kicker"><i/> GET IN TOUCH</span><h2>Tell us about your business.</h2><p>Share a few details. We’ll use them to start the right conversation.</p><span>Existing Business customer? <button onClick={() => go('/business/login')}>Sign in <ArrowUpRight size={15}/></button></span></div><div className="ms-business-form-wrap">{state === 'sent' ? <div className="ms-business-sent" role="status"><CheckCircle2 size={35}/><h3>Request received.</h3><p>We’ll follow up using the email you provided.</p><button onClick={() => setState('idle')}>Send another request <ArrowRight size={15}/></button></div> : <form name="business-call" onSubmit={event => void submit(event)}><input type="hidden" name="form-name" value="business-call"/><div className="ms-honeypot" aria-hidden="true"><label>Leave this blank<input name="bot-field" tabIndex={-1} autoComplete="off"/></label></div><label>Your name<input name="name" autoComplete="name" required maxLength={100} placeholder="Full name"/></label><label>Work email<input name="email" type="email" autoComplete="email" required maxLength={160} placeholder="you@company.com"/></label><label>Company<input name="company" autoComplete="organization" required maxLength={120} placeholder="Company name"/></label><label>What would you like to discuss?<select name="interest" required defaultValue=""><option value="" disabled>Choose a topic</option><option value="payments">Payments and settlement</option><option value="api">API integration</option><option value="treasury">Balances and treasury</option><option value="other">Something else</option></select></label><label>Tell us a little more<textarea name="message" rows={3} maxLength={1000} placeholder="Your use case, country or questions"/></label>{error && <p className="ms-form-error" role="alert">{error}</p>}<button className="ms-button" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Request a call'} <ArrowRight size={18}/></button><small>We’ll use these details to respond to your request.</small></form>}</div></section>
  </main><footer className="ms-footer"><div>{brand}<span>Move with confidence.</span></div><nav><button onClick={() => go('/')}>Home</button><button onClick={() => go('/personal/login')}>Personal</button><button onClick={() => go('/docs')}>Developers</button></nav><small>© {new Date().getFullYear()} Microsendr · Sandbox</small></footer></div>;
}
