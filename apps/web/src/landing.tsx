import React, { type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, ArrowDownLeft, Check, Code2, ShieldCheck } from 'lucide-react';
import './landing.css';

export function LandingPage({ header, brand, go, authenticated }: { header: ReactNode; brand: ReactNode; go: (path: string) => void; authenticated: boolean }) {
  return <div className="ms-site">
    {header}
    <main>
      <section className="ms-hero">
        <div className="ms-hero-copy"><span className="ms-kicker"><i/> A BETTER WAY TO MOVE</span><h1>Money moves<br/><em>with you.</em></h1><p>One account for people. One platform for business. Built for the way value moves today.</p>
          <div className="ms-hero-actions"><button className="ms-button" onClick={() => go('/personal/login')}>Get started <ArrowRight size={18}/></button><button className="ms-link" onClick={() => go('/business/login')}>For business <ArrowUpRight size={18}/></button></div>
          <span className="ms-disclosure"><ShieldCheck size={16}/> Sandbox preview · Funds and providers are simulated</span>
        </div>
        <div className="ms-hero-visual" aria-label="Microsendr account preview">
          <div className="ms-orbit ms-orbit-one"/><div className="ms-orbit ms-orbit-two"/>
          <div className="ms-preview"><div className="ms-preview-top"><span>{brand}</span><span className="ms-preview-dot">● Sandbox</span></div><div className="ms-preview-main"><small>AVAILABLE BALANCE</small><strong>₦100,000<span>.00</span></strong><div className="ms-preview-actions"><span><ArrowUpRight size={20}/> Send</span><span><ArrowDownLeft size={20}/> Receive</span></div></div><div className="ms-preview-row"><span className="ms-preview-icon"><ArrowUpRight size={18}/></span><span><b>Transfer sent</b><small>Today · Completed</small></span><strong>− ₦12,500</strong></div><div className="ms-preview-row"><span className="ms-preview-icon"><ArrowDownLeft size={18}/></span><span><b>Money received</b><small>Yesterday · Completed</small></span><strong>+ ₦45,000</strong></div></div>
        </div>
      </section>
      <section className="ms-modes" id="platform"><div className="ms-section-head"><span className="ms-kicker">ONE NETWORK · TWO WAYS IN</span><h2>Made for your next move.</h2></div><div className="ms-mode-grid">
        <button className="ms-mode-card" onClick={() => go('/personal/login')}><span className="ms-mode-icon">01</span><h3>Personal</h3><p>Send, receive and see your money in one simple account.</p><span className="ms-card-link">Explore Personal <ArrowUpRight size={18}/></span></button>
        <button className="ms-mode-card" onClick={() => go('/business/login')}><span className="ms-mode-icon">02</span><h3>Business</h3><p>Manage balances, settlements and your team from one workspace.</p><span className="ms-card-link">Explore Business <ArrowUpRight size={18}/></span></button>
      </div></section>
      <section className="ms-network" id="how-it-works"><div><span className="ms-kicker">BUILT FOR BUILDERS</span><h2>One integration.<br/>More possibility.</h2><p>Create settlement intents, inspect transactions and work with a typed API.</p><button className="ms-button ms-button-light" onClick={() => go('/docs')}>Read the docs <ArrowRight size={18}/></button></div><div className="ms-network-card"><div><Code2 size={22}/><span>API SANDBOX</span><Check size={18}/></div><code>POST /v1/intents</code><p>Build and test with simulated funds.</p><button onClick={() => go(authenticated ? '/app/overview' : '/connect')}>Open developer sandbox <ArrowUpRight size={17}/></button></div></section>
    </main>
    <footer className="ms-footer"><div>{brand}<span>Move with confidence.</span></div><nav><button onClick={() => go('/personal/login')}>Personal</button><button onClick={() => go('/business/login')}>Business</button><button onClick={() => go('/docs')}>Developers</button></nav><small>© {new Date().getFullYear()} Microsendr · Sandbox</small></footer>
  </div>;
}
