import React, { type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, Check, Code2, History, ShieldCheck } from 'lucide-react';
import './landing.css';

type Props = { header: ReactNode; brand: ReactNode; go: (path: string) => void; authenticated: boolean };

export function LandingPage({ header, brand, go, authenticated }: Props) {
  return <div className="ms-site">
    {header}
    <main>
      <section className="ms-hero">
        <div className="ms-hero-copy">
          <span className="ms-kicker"><i/> MONEY IN MOTION</span>
          <h1>Money moves<br/><em>with you.</em></h1>
          <p>One clear place to send, receive and keep track. Built for people and the businesses moving Africa forward.</p>
          <div className="ms-hero-actions"><button className="ms-button" onClick={() => go('/personal/login')}>Get started <ArrowRight size={18}/></button><button className="ms-link" onClick={() => go('/business')}>For business <ArrowUpRight size={18}/></button></div>
          <span className="ms-disclosure"><ShieldCheck size={16}/> Sandbox preview · Funds and providers are simulated</span>
        </div>
        <div className="ms-hero-visual"><img src="/images/payment-cafe.webp" alt="Customer using her phone at a café counter" fetchPriority="high"/><div className="ms-hero-photo-shade"/><div className="ms-payment-note" aria-label="Illustrative sandbox transfer"><span className="ms-payment-note-icon"><Check size={19}/></span><span><b>Transfer posted</b><small>Example · Simulated</small></span><strong>₦12,500</strong></div><span className="ms-image-index">01 / EVERYDAY PAYMENTS</span></div>
      </section>

      <section className="ms-proof-strip" aria-label="Microsendr products"><span>ONE CONNECTED EXPERIENCE</span><span>PERSONAL <i/></span><span>BUSINESS <i/></span><span>DEVELOPER SANDBOX</span></section>

      <section className="ms-personal" id="platform"><div className="ms-personal-copy"><span className="ms-kicker"><i/> PERSONAL</span><h2>Your money.<br/><em>Your move.</em></h2><p>Send to another account, see what came in, and know where things stand.</p><button className="ms-text-action" onClick={() => go('/personal/login')}>Explore Personal <ArrowUpRight size={19}/></button></div><div className="ms-personal-stage"><div className="ms-stage-orbit ms-stage-orbit-one"/><div className="ms-stage-orbit ms-stage-orbit-two"/><div className="ms-account-card"><div className="ms-account-head"><span>{brand}</span><small>Personal · Sandbox</small></div><small>AVAILABLE · SIMULATED NGN</small><strong>₦100,000.00</strong><div className="ms-account-actions"><span><ArrowUpRight size={18}/> Send</span><span><History size={18}/> Activity</span></div><div className="ms-account-activity"><span><ArrowUpRight size={17}/></span><div><b>Transfer sent</b><small>Example activity</small></div><strong>− ₦12,500</strong></div></div></div></section>

      <section className="ms-steps" id="how-it-works"><div className="ms-section-intro"><span className="ms-kicker"><i/> HOW IT WORKS</span><h2>Every move, in view.</h2><p>A simple way to send and follow your money.</p></div><div className="ms-steps-grid"><article><span>01 / ENTER</span><h3>Choose a recipient</h3><p>Enter another Personal account’s email and an amount.</p></article><article><span>02 / SEND</span><h3>Know the cost</h3><p>See the sandbox fee before sending.</p></article><article><span>03 / FOLLOW</span><h3>Track every move</h3><p>Find the completed transfer in your activity.</p></article></div><small>Current Personal sandbox supports simulated NGN transfers between eligible accounts.</small></section>

      <section className="ms-business"><div className="ms-business-image"><img src="/images/business-payments.webp" alt="Business operators reviewing payment activity together" loading="lazy"/><span className="ms-image-index">02 / BUSINESS OPERATIONS</span></div><div className="ms-business-copy"><span className="ms-kicker"><i/> BUSINESS</span><h2>Payments built<br/>around your business.</h2><p>Tell us what you’re building. We’ll help you find the right way to work with Microsendr.</p><button className="ms-button" onClick={() => go('/business')}>Book a call <ArrowRight size={18}/></button><span className="ms-business-secondary">Already working with us? <button onClick={() => go('/business/login')}>Sign in <ArrowUpRight size={15}/></button></span></div></section>

      <section className="ms-capabilities"><div><span className="ms-kicker"><i/> ONE PLATFORM</span><h2>Made to keep you moving.</h2></div><div className="ms-capability-grid"><article><span>01</span><h3>Personal account</h3><p>See simulated NGN and send between Personal accounts.</p></article><article><span>02</span><h3>Business workspace</h3><p>Explore balances, settlement flows and team tools in the sandbox.</p></article><article><span>03</span><h3>Developer access</h3><p>Build with documented APIs and inspect each simulated step.</p></article></div></section>

      <section className="ms-network" id="developers"><div className="ms-network-copy"><span className="ms-kicker"><i/> FOR DEVELOPERS</span><h2>Build the next<br/>money move.</h2><p>Explore settlement flows with an API and an isolated sandbox.</p><button className="ms-button ms-button-light" onClick={() => go('/docs')}>Read the docs <ArrowRight size={18}/></button></div><div className="ms-network-visual"><div className="ms-flow-line"/><div className="ms-flow-node ms-flow-source"><span>01</span><b>Create intent</b><small>POST /v1/intents</small></div><div className="ms-flow-node ms-flow-route"><span>02</span><b>Inspect route</b><small>Simulated providers</small></div><div className="ms-flow-node ms-flow-end"><span>03</span><b>Track result</b><small>One clear status</small></div><button className="ms-sandbox-link" onClick={() => go(authenticated ? '/app/overview' : '/connect')}><Code2 size={19}/> Open developer sandbox <ArrowUpRight size={17}/></button></div></section>

      <section className="ms-final"><span className="ms-kicker"><i/> START HERE</span><h2>Ready for your next move?</h2><div><button className="ms-button" onClick={() => go('/personal/login')}>Explore Personal <ArrowRight size={18}/></button><button className="ms-link" onClick={() => go('/business')}>Talk to us about Business <ArrowUpRight size={18}/></button></div><small>Sandbox only · No live funds or providers</small></section>
    </main>
    <footer className="ms-footer"><div>{brand}<span>Move with confidence.</span></div><nav><button onClick={() => go('/personal/login')}>Personal</button><button onClick={() => go('/business')}>Business</button><button onClick={() => go('/docs')}>Developers</button></nav><small>© {new Date().getFullYear()} Microsendr · Sandbox</small></footer>
  </div>;
}
