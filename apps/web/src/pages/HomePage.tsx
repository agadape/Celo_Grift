import {Link} from "react-router-dom";

export function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Celo Proof of Ship</p>
          <h1>SawerLink</h1>
          <p className="lede">
            One creator tipping link. Supporters pay from any LI.FI-supported
            chain. Creators receive stablecoins on Celo MiniPay.
          </p>
          <div className="cta-row">
            <Link to="/create" className="btn-primary">
              Create your link
            </Link>
            <Link to="/s/sawerlink" className="btn-secondary">
              Try a demo tip
            </Link>
          </div>
        </div>

        <div className="creator-panel" aria-label="How it works">
          <span className="label">How it works</span>
          <ol className="numbered">
            <li>
              <strong>Create.</strong> Connect MiniPay and reserve your handle on Celo.
            </li>
            <li>
              <strong>Share.</strong> Get a link like{" "}
              <code>sawerlink.app/s/yourname</code>.
            </li>
            <li>
              <strong>Receive.</strong> Supporters tip in stablecoins. Receipts land on-chain.
            </li>
          </ol>
        </div>
      </section>

      <section className="workflow" aria-label="Why SawerLink">
        <article>
          <span>1</span>
          <h2>No platform cut</h2>
          <p>Saweria charges 5–6%. SawerLink charges sub-cent gas only.</p>
        </article>
        <article>
          <span>2</span>
          <h2>Cross-chain</h2>
          <p>Supporters pay from any LI.FI-supported chain. Routed to Celo automatically.</p>
        </article>
        <article>
          <span>3</span>
          <h2>Non-custodial</h2>
          <p>Funds go straight to your MiniPay wallet. No withdrawal queue, no banking hours.</p>
        </article>
      </section>
    </main>
  );
}
