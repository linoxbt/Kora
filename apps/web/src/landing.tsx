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
                <span className="site-kicker-dot" /> PAYMENT INFRASTRUCTURE, MADE VISIBLE
              </div>
              <h1 id="site-hero-title">
                One payment flow.
                <br />
                <em>Complete visibility.</em>
              </h1>
              <p>
                Create, route and reconcile payments through one API. Follow the journey from first
                quote to final ledger entry, with every decision in view.
              </p>
              <div className="site-hero-actions">
                <button className="site-button site-button-primary" onClick={start}>
                  Explore the sandbox <ArrowUpRight size={17} />
                </button>
                <button className="site-button site-button-text" onClick={() => go('/docs')}>
                  Read the docs <ArrowRight size={17} />
                </button>
              </div>
              <div className="site-hero-footnote">
                <ShieldCheck size={16} /> Simulated funds and providers. No live payments.
              </div>
            </div>
            <div className="site-hero-stage" aria-label="Illustrative Kora sandbox route monitor">
              <div className="site-stage-grid" aria-hidden="true" />
              <div className="site-stage-halo" aria-hidden="true" />
              <div className="site-preview-card">
                <div className="site-preview-top">
                  <span>
                    <span className="site-preview-mark">K</span> Kora workspace
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
              Start with a working Nigerian sandbox corridor <ArrowRight size={15} />
            </button>
          </div>
        </section>

        <div className="site-capability-strip" aria-label="Kora sandbox capabilities">
          <div>
            <span>01 / ROUTE</span>
            <b>Measured local options</b>
          </div>
          <div>
            <span>02 / RECOVER</span>
            <b>Evidence before finality</b>
          </div>
          <div>
            <span>03 / RECONCILE</span>
            <b>Every unit accounted for</b>
          </div>
        </div>

        <section className="site-section site-platform" id="platform">
          <div className="site-section-heading">
            <div>
              <span className="site-section-kicker">THE PLATFORM</span>
              <h2>
                One system for the
                <br />
                <em>whole payment journey.</em>
              </h2>
            </div>
            <p>
              From a customer request to a confirmed outcome, Kora keeps the moving parts connected.
              Build the flow in the sandbox, then inspect what happened.
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
            Nigeria/NGN local routing is simulated. Stellar Testnet staging is available separately;
            a second-country corridor and live payments are not enabled.
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
              Start with a simulated Nigerian payment, inspect the route, and follow its evidence
              through to the ledger. Every surface says what is running today.
            </p>
          </div>
          <div className="site-now-grid">
            <article className="site-now-card site-now-card-primary">
              <span className="site-now-state"><i /> AVAILABLE NOW</span>
              <h3>Nigeria local sandbox</h3>
              <p>Try NGN local routing with simulated funds and providers in a prefunded workspace.</p>
              <div className="site-now-path" aria-label="Sandbox payment journey">
                <span>Intent</span><ArrowRight size={14} /><span>Route</span><ArrowRight size={14} />
                <span>Receipt</span><ArrowRight size={14} /><span>Ledger</span>
              </div>
              <button className="site-now-link" onClick={start}>
                Open a workspace <ArrowUpRight size={16} />
              </button>
            </article>
            <article className="site-now-card">
              <span className="site-now-state">SEPARATE TESTNET FLOW</span>
              <h3>Stellar Testnet staging</h3>
              <p>Explore a testnet staging path for USDC. It does not send live funds or enable a cross-border corridor.</p>
              <button className="site-now-link" onClick={() => go('/docs')}>
                Read the integration guide <ArrowUpRight size={16} />
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
              <p>Create intents and quotes, inspect local routing, test uncertain outcomes, and reconcile receipts and ledger entries. Stellar Testnet staging is available separately.</p>
            </details>
            <details>
              <summary>Does Kora support cross-border settlement?</summary>
              <p>Not yet. The current working route is Nigeria to Nigeria in sandbox mode; a second-country corridor is not enabled.</p>
            </details>
            <details>
              <summary>Where do I begin integrating?</summary>
              <p>Open a sandbox workspace to explore the flow, then use the API reference and typed SDK to build against it.</p>
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
              Open a prefunded sandbox workspace, make a test transfer, and follow it all the way to
              the receipt.
            </p>
          </div>
          <button className="site-button site-button-light" onClick={start}>
            Open the sandbox <ArrowUpRight size={17} />
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
            <button onClick={() => go('/login')}>Sign in</button>
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
