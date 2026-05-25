import React from 'react';
import './About1.css';


const FlowBox = ({ type, label, name }) => (
  <div className={`flow-box ${type}`}>
    <div className="fb-label">{label}</div>
    <div className="fb-name">{name}</div>
  </div>
);

const StatItem = ({ num, suffix, label }) => (
  <div className="stat">
    <div className="num">{num}{suffix && <span>{suffix}</span>}</div>
    <div className="label">{label}</div>
  </div>
);

const FeatureCard = ({ icon, title, desc, variant }) => (
  <div className={`feature-card ${variant || ''}`}>
    <span className="feature-icon">{icon}</span>
    <h3>{title}</h3>
    <p>{desc}</p>
  </div>
);

const Step = ({ num, tag, title, desc }) => (
  <div className="step">
    <div className="step-num">{num}</div>
    <div className="step-tag">{tag}</div>
    <h3>{title}</h3>
    <p>{desc}</p>
  </div>
);

const CodeDots = () => (
  <div className="code-dots">
    <div className="dot r" />
    <div className="dot y" />
    <div className="dot g" />
  </div>
);

export default function About1() {
  return (
    <>
    <div className="page">
      <div className="noise" />
      <div className="fw-scroll-container">
      <div className="content">

        {/* HERO */}
        <div className="hero">
          <div className="hero-eyebrow">// ODI → Databricks Migration Platform</div>
          <h1>
            Migrate <span className="highlight">Smarter.</span><br />
            Run <span className="highlight">Faster.</span>
          </h1>
          <p className="hero-sub">
            Transform your Oracle Data Integrator mappings into production-ready SparkSQL on Databricks — automated, accurate, and AI-assisted.
          </p>
          <div className="hero-visual">
            <div className="flow-diagram">
              <FlowBox type="src" label="Source" name="Oracle ODI" />
              <div className="flow-arrow">↓</div>
              <FlowBox type="engine" label="Flytics MCP Engine" name="AI Orchestration + Auto-Conversion" />
              <div className="flow-arrow">↓</div>
              <FlowBox type="dst" label="Target" name="Databricks" />
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="stats">
          <StatItem num="90" suffix="%" label="Mapping Auto-Conversion Rate" />
          <StatItem num="25" suffix="×" label="Faster Than Manual Migration" />
          <StatItem num="200" suffix="+" label="Mappings Per Engagement" />
          <StatItem num="0" label="Vendor Lock-in" />
        </div>

        {/* FEATURES */}
        <div className="section">
          <div className="section-title">// Core Capabilities</div>
          <div className="features-grid">
            <FeatureCard    
              icon="🔍"
              title="ODI Repository Parser"
              desc="Reads and parses ODI XML exports, resolving mappings, transformations, and lineage automatically."
            />
            <FeatureCard
              icon="⚡"
              title="AI-Powered Code Gen"
              desc="Claude-driven MCP orchestration converts Oracle SQL & ODI logic into idiomatic SparkSQL notebooks."
              variant="teal"
            />
            <FeatureCard
              icon="🚀"
              title="Databricks Push"
              desc="Directly publishes converted notebooks & pipelines to your Databricks Unity Catalog workspace."
              variant="amber"
            />
            <FeatureCard
              icon="🧠"
              title="Agentic Review Loop"
              desc="Automated validation, diff review, and quality scoring for each migrated mapping before deployment."
              variant="teal"
            />
            <FeatureCard
              icon="📊"
              title="Migration Dashboard"
              desc="React-based UI tracks conversion progress, error logs, and mapping status across the entire project."
            />
            <FeatureCard
              icon="🔒"
              title="Enterprise Ready"
              desc="Runs on-premise or in your cloud. No data leaves your environment. SOC2-aligned architecture."
              variant="amber"
            />
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div className="section-no-border">
          <div className="section-title">// How It Works — 4 Phases</div>
        </div>
        <div className="steps">
          <Step
            num="01"
            tag="Ingest"
            title="Load ODI Exports"
            desc="Upload ODI XML repository exports. The parser extracts all mappings, interfaces, and transformations."
          />
          <Step
            num="02"
            tag="Analyze"
            title="AI Understanding"
            desc="MCP server feeds each mapping to Claude. The agent understands data flow, joins, filters & business logic."
          />
          <Step
            num="03"
            tag="Convert"
            title="SparkSQL Generation"
            desc="Claude outputs production-grade SparkSQL code with proper schema handling, catalog references, and comments."
          />
          <Step
            num="04"
            tag="Deploy"
            title="Publish to Databricks"
            desc="Validated notebooks are pushed directly to Databricks Unity Catalog. Ready to run on day one."
          />
        </div>

        {/* CODE PREVIEW */}
        <div className="code-section">
          <div>
            <div className="code-label">Before — ODI Mapping (SQL)</div>
            <div className="code-block">
              <div className="code-header">
                <CodeDots />
                <div className="lang odi">ODI SQL Expression</div>
              </div>
              <pre>
                <span className="cm">{'-- IKM Oracle Insert/Update'}</span>{'\n'}
                <span className="kw">{'SELECT'}</span>{'\n'}
                {'  C.CUSTOMER_ID,\n  C.CUSTOMER_NAME,\n  '}
                <span className="fn">{'NVL'}</span>
                {'(O.ORDER_AMT, '}
                <span className="num">{'0'}</span>
                {') '}
                <span className="kw">{'AS'}</span>
                {' TOTAL_AMT,\n  '}
                <span className="fn">{'TRUNC'}</span>
                {'(SYSDATE) '}
                <span className="kw">{'AS'}</span>
                {' LOAD_DT\n'}
                <span className="kw">{'FROM'}</span>
                {' CUST_DIM C\n'}
                <span className="kw">{'LEFT JOIN'}</span>
                {' ORD_FACT O\n  '}
                <span className="kw">{'ON'}</span>
                {' C.ID = O.CUST_ID\n'}
                <span className="kw">{'WHERE'}</span>
                {' C.STATUS = '}
                <span className="str">{"'ACTIVE'"}</span>
              </pre>
            </div>
          </div>

          <div>
            <div className="code-label after">After — Databricks PySpark</div>
            <div className="code-block">
              <div className="code-header">
                <CodeDots />
                <div className="lang py">PySpark · Unity Catalog</div>
              </div>
              <pre>
                <span className="kw">{'from'}</span>
                {' pyspark.sql '}
                <span className="kw">{'import'}</span>
                {' functions '}
                <span className="kw">{'as'}</span>
                {' F\n'}
                <span className="kw">{'from'}</span>
                {' datetime '}
                <span className="kw">{'import'}</span>
                {' date\n\n'}
                {'cust_df = spark.table('}
                <span className="str">{'"catalog.dim.cust_dim"'}</span>
                {')\nord_df  = spark.table('}
                <span className="str">{'"catalog.fact.ord_fact"'}</span>
                {')\n\nresult = (\n  cust_df.filter(F.col('}
                <span className="str">{'"status"'}</span>
                {') == '}
                <span className="str">{'"ACTIVE"'}</span>
                {')\n  .join(ord_df, cust_df.id == ord_df.cust_id,\n        '}
                <span className="str">{'"left"'}</span>
                {')\n  .select(\n    '}
                <span className="str">{'"customer_id"'}</span>
                {', '}
                <span className="str">{'"customer_name"'}</span>
                {',\n    F.coalesce('}
                <span className="str">{'"order_amt"'}</span>
                {', F.lit('}
                <span className="num">{'0'}</span>
                {'))\n     .alias('}
                <span className="str">{'"total_amt"'}</span>
                {'),\n    F.lit(date.today()).alias('}
                <span className="str">{'"load_dt"'}</span>
                {')\n  )\n)'}
              </pre>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="footer">
          <div className="footer-cta">
            <h3>Ready to accelerate your migration?</h3>
            <p>
              Contact us at <a href="mailto:hello@flytics.in">hello@flytics.in</a> · <a href="#">flytics.in</a>
            </p>
          </div>
          <div className="footer-right">
            <div className="gov-badge">
              <strong>DPIIT Recognized</strong>
              Govt. of India Startup
            </div>
            <button className="cta-btn">Book a Demo →</button>
          </div>
        </div>

      </div>
    </div>
    </div>
    </>
  );
}