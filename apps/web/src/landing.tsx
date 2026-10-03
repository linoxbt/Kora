import React, { type ReactNode } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  Code2,
  Globe2,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import './landing.css';

const example = `const quote = await kora.createQuote(
  {
    source_asset: 'NGN',
    destination_asset: 'USDC',
    amount_minor: '2500000',
  },
  'quote-001',
);`;

export function LandingPage({
  header,
  brand,
  go,
  authenticated,
}: {
  header: ReactNode;
  brand: ReactNode;
  go: (path: string) => void;
  authenticated: boolean;
}) {
  const start = () => go(authenticated ? '/app/overview' : '/connect');
  return (
    <div className="site-landing">
      {header}
      <main>
        <section className="site-hero" aria-labelledby="site-hero-title">
          <div className="site-hero-inner">
            <div className="site-hero-copy">
              <div className="site-kicker">
                <span className="site-kicker-dot" /> ONE ACCOUNT · ONE NETWORK
              </div>
              <h1 id="site-hero-title">
                Move value.
                <br />
                <em>Across every boundary.</em>
              </h1>
              <p>
                Kora brings people, businesses and financial rails together. Hold a balance, send
                to someone, or build on the network through one clear account experience.
              </p>
              <div className="site-hero-actions">
                <button className="site-button site-button-primary" onClick={() => go('/personal/login')}>
                  Explore Personal <ArrowUpRight size={17} />
                </button>
                <button className="site-button site-button-text" onClick={() => go('/business/login')}>
                  Explore Business <ArrowRight size={17} />
                </button>
              </div>
              <div className="site-hero-footnote">
                <ShieldCheck size={16} /> Currently a sandbox. Funds and providers are simulated.
              </div>
            </div>
            <div className="site-hero-stage" aria-label="Illustrative Kora sandbox route monitor">
              <div className="site-stage-grid" aria-hidden="true" />
              <div className="site-stage-halo" aria-hidden="true" />
              <div className="site-preview-card">
                <div className="site-preview-top">
                  <span>
                    <span className="site-preview-mark">K</span> Kora Network
                  </span>
                  <span className="site-preview-mode">
                    <i /> Sandbox
                  </span>
                </div>
                <div className="site-preview-body">
                  <div className="site-preview-label">
                    ROUTE MONITOR <span>EXAMPLE TRANSFER</span>
                  </div>
                  <div className="site-preview-amount">
                    ₦25,000<span>.00</span>
                  </div>
                  <div className="site-preview-subtitle">
                    Nigeria local payout <span>NGN → NGN</span>
                  </div>
                  <div className="site-preview-divider" />
                  <div className="site-preview-steps">
                    {[
                      ['01', 'Quote locked', 'Amount and route terms saved'],
                      ['02', 'Route selected', 'Available sandbox participant'],
                      ['03', 'Receipt verified', 'Provider outcome confirmed'],
                      ['04', 'Ledger settled', 'Balanced journal recorded'],
                    ].map(([number, title, detail]) => (
                      <div className="site-preview-step" key={number}>
                        <span className="site-preview-check">
                          <Check size={12} />
                        </span>
                        <span>
                          <b>{title}</b>
                          <small>{detail}</small>
                        </span>
                        <span className="site-preview-number">{number}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="site-preview-bottom">
                  <span>
                    STATUS <b>Confirmed</b>
                  </span>
                  <span>
                    MODE <b>Simulated</b>
                  </span>
                </div>
              </div>
              <div className="site-evidence-card">
                <span className="site-evidence-icon">
                  <Activity size={17} />
                </span>
                <span>
                  <b>Evidence at every step</b>
                  <small>Route · Receipt · Journal</small>
                </span>
              </div>
            </div>
          </div>
          <div className="site-hero-base">
            <span>BUILT TO MAKE THE COMPLEX CLEAR</span>
            <button type="button" onClick={start}>
              Start with the Nigerian developer sandbox <ArrowRight size={15} />
            </button>
          </div>
        </section>

        <div className="site-capability-strip" aria-label="Kora sandbox capabilities">
          <div>
            <span>01 / PERSONAL</span>
            <b>Use the network</b>
          </div>
          <div>
            <span>02 / BUSINESS</span>
            <b>Build on the network</b>
          </div>
          <div>
            <span>03 / NETWORK</span>
            <b>Move value with proof</b>
          </div>
        </div>

        <section className="site-section site-platform" id="platform">
          <div className="site-section-heading">
            <div>
              <span className="site-section-kicker">THE PLATFORM</span>
              <h2>
                One system for the
                <br />
                <em>whole value journey.</em>
              </h2>
            </div>
            <p>
              Personal and Business use the same account and settlement foundations. Kora Network
              connects the ledger, route decision, provider evidence and reconciliation.
            </p>
          </div>
          <div className="site-feature-grid">
            <article className="site-feature-card">
              <div className="site-feature-icon">
                <Code2 size={22} />
              </div>
              <span className="site-feature-index">01 / CREATE</span>
              <h3>A durable starting point.</h3>
              <p>
                Create payment intents with scoped credentials and idempotent writes. Retries return
                to the same request.
              </p>
              <button className="site-feature-example" type="button" onClick={() => go('/docs')}>
                <span>POST</span> /v1/intents <ArrowUpRight size={15} />
              </button>
            </article>
            <article className="site-feature-card">
              <div className="site-feature-icon">
                <Globe2 size={22} />
              </div>
              <span className="site-feature-index">02 / ROUTE</span>
              <h3>A decision you can inspect.</h3>
              <p>
                Quotes save the selected route. Sandbox health and capacity guide local choices
                before a transfer is sent.
              </p>
              <div className="site-feature-routes">
                <span>
                  <i /> Selected participant
                </span>
                <span>Alternate available</span>
              </div>
            </article>
            <article className="site-feature-card">
              <div className="site-feature-icon">
                <Wallet size={22} />
              </div>
              <span className="site-feature-index">03 / RECONCILE</span>
              <h3>An outcome you can explain.</h3>
              <p>
                Receipts, balances, journals and signed webhooks give your team a clear record of
                each result.
              </p>
              <div className="site-feature-journal">
                <span>Provider receipt</span>
                <Check size={15} />
                <span>Balanced journal</span>
              </div>
            </article>
          </div>
        </section>

        <section className="site-workflow" id="how-it-works">
          <div className="site-workflow-copy">
            <span className="site-section-kicker">BUILT FOR REAL-WORLD UNCERTAINTY</span>
            <h2>
              Know what happened.
              <br />
              <em>Know what comes next.</em>
            </h2>
            <p>
              A timeout is not a success or a failure. Kora keeps uncertain transfers in review
              until a provider receipt gives the engine enough evidence to settle or release the
              hold.
            </p>
            <button className="site-button site-button-outline" onClick={start}>
              See the route explorer <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="site-workflow-visual">
            <div className="site-workflow-top">
              <span>NG–NG SANDBOX ROUTE</span>
              <span>ILLUSTRATIVE FLOW</span>
            </div>
            <div className="site-workflow-line">
              <div>
                <span className="site-workflow-node">01</span>
                <b>Reserve</b>
                <small>Funds held safely</small>
              </div>
              <div>
                <span className="site-workflow-node">02</span>
                <b>Send</b>
                <small>One instruction</small>
              </div>
              <div>
                <span className="site-workflow-node">03</span>
                <b>Verify</b>
                <small>Receipt checked</small>
              </div>
              <div>
                <span className="site-workflow-node">04</span>
                <b>Settle</b>
                <small>Ledger updated</small>
              </div>
            </div>
            <div className="site-workflow-note">
              <ShieldCheck size={16} /> Unknown outcomes stay reserved for recovery. They never
              trigger a blind resend.
            </div>
          </div>
          <p className="site-workflow-scope">
            Nigeria/NGN activity is simulated. A second-country corridor and live payments are not enabled.
          </p>
        </section>

        <section className="site-section site-now" id="sandbox" aria-labelledby="site-now-title">
          <div className="site-section-heading">
            <div>
              <span className="site-section-kicker">WHERE KORA STANDS TODAY</span>
              <h2 id="site-now-title">
                A sandbox you can use.
                <br />
                <em>A scope you can trust.</em>
              </h2>
            </div>
            <p>
              Personal and Business have separate sandbox accounts. Developer tools show how a
              simulated Nigerian payment travels from instruction to ledger.
            </p>
          </div>
          <div className="site-now-grid">
            <article className="site-now-card site-now-card-primary">
              <span className="site-now-state"><i /> AVAILABLE NOW</span>
              <h3>Kora Personal sandbox</h3>
              <p>Enable the sandbox verification fixture, add simulated NGN and send to another eligible Kora Personal account.</p>
              <div className="site-now-path" aria-label="Sandbox payment journey">
                <span>Identity</span><ArrowRight size={14} /><span>Balance</span><ArrowRight size={14} />
                <span>Send</span><ArrowRight size={14} /><span>Activity</span>
              </div>
              <button className="site-now-link" onClick={() => go('/personal/login')}>
                Explore Personal <ArrowUpRight size={16} />
              </button>
            </article>
            <article className="site-now-card">
              <span className="site-now-state">SIMULATED BUSINESS</span>
              <h3>Kora Business sandbox</h3>
              <p>Use a separate Business account with a sandbox KYB fixture. Inspect settlement activity and developer tools.</p>
              <button className="site-now-link" onClick={() => go('/business/login')}>
                Explore Business <ArrowUpRight size={16} />
              </button>
            </article>
            <article className="site-now-card">
              <span className="site-now-state">NOT ENABLED</span>
              <h3>Live cross-border payments</h3>
              <p>A second-country corridor and live provider settlement are outside the current sandbox.</p>
              <div className="site-now-caption">Clear boundaries are part of the product.</div>
            </article>
          </div>
        </section>

        <section className="site-section site-developers" id="developers">
          <div className="site-developer-copy">
            <span className="site-section-kicker">FOR DEVELOPERS</span>
            <h2>
              Build on an API that
              <br />
              <em>shows its work.</em>
            </h2>
            <p>
              Use a typed SDK or the OpenAPI contract. Inspect events, recover uncertain outcomes,
              and connect your system with signed webhooks.
            </p>
            <div className="site-developer-tags">
              <span>Typed SDK</span>
              <span>Idempotent writes</span>
              <span>Signed webhooks</span>
            </div>
            <button className="site-button site-button-primary" onClick={() => go('/docs')}>
              Explore developer docs <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="site-code-card">
            <div className="site-code-head">
              <span>
                <i />
                <i />
                <i />
              </span>
              <b>create-quote.ts</b>
              <span>TypeScript SDK</span>
            </div>
            <pre>
              <code>{example}</code>
            </pre>
            <div className="site-code-foot">
              <span>
                <Check size={15} /> Real sandbox API method
              </span>
              <span>NGN → USDC</span>
            </div>
          </div>
        </section>

        <section className="site-section site-faq" id="faq" aria-labelledby="site-faq-title">
          <div>
            <span className="site-section-kicker">GOOD TO KNOW</span>
            <h2 id="site-faq-title">A few straight answers.</h2>
            <p>Know what to expect before you start building.</p>
          </div>
          <div className="site-faq-list">
            <details>
              <summary>Can I move real money through Kora?</summary>
              <p>No. Funds and providers in the current Nigerian sandbox are simulated. Live payments are not enabled.</p>
            </details>
            <details>
              <summary>What can I test today?</summary>
              <p>Personal can send simulated NGN between eligible accounts. Business developers can create intents and quotes, inspect local routing and reconcile receipts with ledger entries.</p>
            </details>
            <details>
              <summary>Does Kora support cross-border settlement?</summary>
              <p>Not yet. The current working route is Nigeria to Nigeria in sandbox mode; a second-country corridor is not enabled.</p>
            </details>
            <details>
              <summary>Where do I begin integrating?</summary>
              <p>Open Kora Business for developer tools, then use the API reference and typed SDK to build against the sandbox.</p>
            </details>
          </div>
        </section>

        <section className="site-final-cta">
          <div>
            <span className="site-section-kicker">START BUILDING</span>
            <h2>
              See the full journey
              <br />
              <em>for yourself.</em>
            </h2>
            <p>
              Explore Kora Business and follow a simulated transfer from instruction to receipt.
            </p>
          </div>
          <button className="site-button site-button-light" onClick={() => go('/business/login')}>
            Explore Business <ArrowUpRight size={17} />
          </button>
        </section>
      </main>
      <footer className="site-footer">
        <div>
          {brand}
          <p>
            Payment infrastructure for a more connected Africa.
            <br />
            Currently a sandbox with simulated funds and providers.
          </p>
        </div>
        <div className="site-footer-links">
          <div>
            <b>Explore</b>
            <a href="#platform">Platform</a>
            <a href="#how-it-works">How it works</a>
            <a href="#sandbox">Today's sandbox</a>
            <a href="#faq">FAQ</a>
            <button onClick={start}>Sandbox</button>
          </div>
          <div>
            <b>Build</b>
            <button onClick={() => go('/docs')}>Documentation</button>
            <button onClick={() => go('/business/login')}>Business sign in</button>
          </div>
        </div>
        <div className="site-footer-bottom">
          <span>© {new Date().getFullYear()} Kora</span>
          <span>Designed for clarity. Built for accountability.</span>
        </div>
      </footer>
    </div>
  );
}
