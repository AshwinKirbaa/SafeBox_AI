import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Icon, Emblem, CipherReveal, Magnetic, Filaments, ThreeDTextReveal } from './Effects';
import { Features17, Bento31, Showcase6, HowItWorks8, Comparison2, Footer8 } from './Narrative';
import AeroShards from './AeroShards';
import GhostFibers from './GhostFibers';
import { recommendModels, REFERENCE_MODELS } from './product-state';

function FilmModal({ onClose }) {
  const reduced = useReducedMotion();
  const [pause, setPause] = useState(!!reduced);
  const [chapter, setChapter] = useState(0);

  useEffect(() => {
    if (pause) return;
    const t = setInterval(() => setChapter(v => (v + 1) % 4), 3800);
    return () => clearInterval(t);
  }, [pause]);

  useEffect(() => {
    const key = e => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);

  const titles = [
    'DEFINE THE BOUNDARY.',
    'QUESTION THE RESPONSE.',
    'EXAMINE THE CONTEXT.',
    'FOLLOW THE EVIDENCE.'
  ];

  return (
    <motion.div
      className="film-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="SafeBox cinematic sequence"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="film-top">
        <span className="eyebrow">SAFEBOX AI / REAL-TIME CINEMATIC</span>
        <button autoFocus onClick={onClose} aria-label="Close cinematic">
          <Icon name="close" />
        </button>
      </div>

      <div className="film-object">
        <div className="ambient-shards">
          <AeroShards paused={pause} />
        </div>
        <GhostFibers
          glowColor="#8b5cf6"
          secondaryColor="#0c0b4f"
          brightness={0.75}
          glow={0.22}
          particles={0.2}
          dpr={1.5}
          paused={pause}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          className="film-type"
          key={chapter}
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -25 }}
          transition={{ duration: 0.7 }}
        >
          <small className="eyebrow">0{chapter + 1} / 04</small>
          <h2>{titles[chapter]}</h2>
        </motion.div>
      </AnimatePresence>

      <div className="film-bottom">
        <button onClick={() => setPause(!pause)} aria-pressed={pause}>
          {pause ? 'PLAY' : 'PAUSE'} SEQUENCE
        </button>
        <div>
          {[0, 1, 2, 3].map(i => (
            <button
              key={i}
              aria-label={`Cinematic chapter ${i + 1}`}
              aria-pressed={chapter === i}
              className={chapter === i ? 'active' : ''}
              onClick={() => setChapter(i)}
            />
          ))}
        </div>
        <span>PROCEDURAL ANIMATION / NO EVALUATION RUNNING</span>
      </div>
    </motion.div>
  );
}

export function HomePage({ onNavigate, onConfigureProvider, onTestModel }) {
  const [requirements, setRequirements] = useState('');
  const [privacy, setPrivacy] = useState('Local only');
  const [budget, setBudget] = useState('Free');
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      text: 'Welcome to SafeBox AI. Describe your project requirements, privacy constraints, and budget, and I will recommend verified models tailored to your deployment criteria.'
    }
  ]);
  const [recommended, setRecommended] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [filmOpen, setFilmOpen] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);

  const quickPillQueries = [
    { label: 'Private Local Chatbot', req: 'Local confidential support assistant on-premises', priv: 'Local only', bud: 'Free' },
    { label: 'High-Reasoning Multimodal', req: 'Multimodal vision and code evaluation for production audit', priv: 'Cloud only', bud: 'Paid allowed' },
    { label: 'Free Text Assistant', req: 'Text generation and summarization without API usage costs', priv: 'Local & Cloud', bud: 'Free' }
  ];

  function handlePillClick(pill) {
    setRequirements(pill.req);
    setPrivacy(pill.priv);
    setBudget(pill.bud);
    executeRecommendation(pill.req, pill.priv, pill.bud);
  }

  function executeRecommendation(reqText = requirements, priv = privacy, bud = budget) {
    if (!reqText.trim()) return;
    setIsSearching(true);

    const userMsg = {
      sender: 'user',
      text: reqText,
      meta: `Privacy: ${priv} · Budget: ${bud}`
    };

    const results = recommendModels(reqText, REFERENCE_MODELS, { privacy: priv, budget: bud });

    const assistantMsg = {
      sender: 'assistant',
      text: results.length > 0
        ? `Found ${results.length} suitable model${results.length === 1 ? '' : 's'} matching "${reqText}". Here are the top recommended models based on your ${priv} privacy and ${bud} budget:`
        : `No matching models found under strict ${priv} and ${bud} constraints. You can relax privacy or budget filters to discover more alternatives.`
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setRecommended(results);
    setIsSearching(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    executeRecommendation();
  }

  return (
    <div className="landing-page-root">
      {/* Hero Cinematic Section */}
      <section className="studio-hero" id="top">
        <Filaments paused={motionPaused} />
        <div className="hero-meta eyebrow">
          <span>MODEL SELECTION / SECURITY EVALUATION</span>
          <span>FIELD EDITION / 001</span>
        </div>

        <div className="hero-copy">
          <span className="eyebrow hero-kicker">SECURE AND EVALUATE AI.</span>
          <h1>
            <CipherReveal text="MAKE IT" /><br />
            <span className="hero-outline"><CipherReveal text="ANSWER." /></span>
          </h1>
          <p>
            Find a model.<br />
            Test its boundaries.<br />
            <em>Inspect both verdicts.</em>
          </p>
        </div>

        <div className="hero-controls">
          <Magnetic className="studio-button primary" onClick={() => onNavigate('overview')}>
            <span>ENTER SAFEBOX AI<small>OPEN THE OVERVIEW</small></span>
            <Icon name="diagonal" />
          </Magnetic>
          <button className="watch-film" onClick={() => setFilmOpen(true)}>
            <span><Icon name="play" /></span>
            WATCH THE SEQUENCE<small>REAL-TIME / FOUR CHAPTERS</small>
          </button>
          <button
            className="motion-control"
            onClick={() => setMotionPaused(!motionPaused)}
            aria-pressed={motionPaused}
          >
            {motionPaused ? 'RESUME' : 'PAUSE'} MOTION <span>{motionPaused ? '▷' : 'Ⅱ'}</span>
          </button>
        </div>

        <div className="hero-bottomline eyebrow">
          <span>BEHAVIOR ≠ ISOLATION</span>
          <span>SCROLL TO EXAMINE <b>↓</b></span>
          <span>NOTHING VERIFIED BY APPEARANCE.</span>
        </div>
      </section>

      {/* Section 01: Model Recommendation Chatbot */}
      <section className="recommendation-chatbot-card world-section" id="recommendations">
        <div className="section-heading">
          <span className="eyebrow">01 / MODEL RECOMMENDATION ASSISTANT</span>
          <h2>Your project.<br /><em>The right starting point.</em></h2>
          <p>Describe what you want to build and the constraints it must respect.</p>
        </div>

        <div className="chatbot-header">
          <div className="chatbot-header-info">
            <span className="eyebrow">ASSISTANT / GUIDED MODEL DISCOVERY</span>
            <h3>Model Recommendation Chatbot</h3>
            <p>SafeBox matches open weights and cloud frontier models against your privacy and budget boundaries.</p>
          </div>
          <Emblem />
        </div>

        {/* Conversation stream */}
        <div className="chatbot-stream" aria-live="polite">
          {messages.map((m, idx) => (
            <div key={idx} className={`chat-bubble ${m.sender}`}>
              <div className="bubble-header">
                <span className="bubble-author">{m.sender === 'user' ? 'YOUR REQUIREMENTS' : 'SAFEBOX ADVISOR'}</span>
                {m.meta && <span className="bubble-meta">{m.meta}</span>}
              </div>
              <p className="bubble-content">{m.text}</p>
            </div>
          ))}
        </div>

        {/* Quick query pills */}
        <div className="quick-pill-strip">
          <span className="pill-label eyebrow">COMMON TEMPLATES:</span>
          {quickPillQueries.map((pill, i) => (
            <button key={i} className="quick-pill" onClick={() => handlePillClick(pill)}>
              {pill.label} <Icon name="diagonal" />
            </button>
          ))}
        </div>

        {/* Chatbot Form Controls */}
        <form className="chatbot-control-panel" onSubmit={handleSubmit}>
          <div className="requirements-field">
            <label htmlFor="project-reqs" className="field-label eyebrow">PROJECT REQUIREMENTS TEXTBOX</label>
            <input
              id="project-reqs"
              type="text"
              className="requirements-input"
              value={requirements}
              onChange={e => setRequirements(e.target.value)}
              placeholder="e.g. Confidential legal document analysis, offline text generation, image synthesis..."
              maxLength={1000}
            />
          </div>

          <div className="dropdowns-and-submit-row">
            <div className="filter-select-group">
              <label htmlFor="privacy-dropdown" className="field-label eyebrow">PRIVACY</label>
              <select
                id="privacy-dropdown"
                className="styled-dropdown"
                value={privacy}
                onChange={e => setPrivacy(e.target.value)}
              >
                <option value="Local only">Local only</option>
                <option value="Cloud only">Cloud only</option>
                <option value="Local & Cloud">Local &amp; Cloud</option>
              </select>
            </div>

            <div className="filter-select-group">
              <label htmlFor="budget-dropdown" className="field-label eyebrow">BUDGET</label>
              <select
                id="budget-dropdown"
                className="styled-dropdown"
                value={budget}
                onChange={e => setBudget(e.target.value)}
              >
                <option value="Free">Free</option>
                <option value="Paid allowed">Paid allowed</option>
              </select>
            </div>

            <button
              type="submit"
              className="studio-button primary recommend-submit-btn"
              disabled={!requirements.trim() || isSearching}
            >
              <span>{isSearching ? 'EVALUATING...' : 'RECOMMEND MODELS'}</span>
              <Icon name="diagonal" />
            </button>
          </div>
        </form>

        {/* Recommended Model Cards */}
        {recommended.length > 0 && (
          <div className="recommended-models-section">
            <div className="section-divider">
              <span className="eyebrow">RECOMMENDED MODEL CARDS ({recommended.length})</span>
            </div>
            <div className="model-cards-grid">
              {recommended.map(m => (
                <div key={m.id} className="model-recommendation-card">
                  <div className="card-top-row">
                    <div>
                      <h3 className="card-model-name">{m.name}</h3>
                      <span className="card-provider-tag eyebrow">{m.provider}</span>
                    </div>
                    <span className={`deployment-badge ${m.deployment}`}>
                      {m.deployment === 'local' ? '● Local model' : '▲ Cloud model'}
                    </span>
                  </div>

                  <p className="card-reason">
                    <strong>Reason for recommendation:</strong> {m.reason}
                  </p>

                  <div className="card-meta-list">
                    <div className="meta-item">
                      <span className="eyebrow">PRICING TIER</span>
                      <span>{m.pricingClass === 'free' ? 'Free ($0 API Cost)' : m.pricingClass === 'paid' ? 'Paid Provider API' : 'Community / Self-Hosted'}</span>
                    </div>
                    <div className="meta-item">
                      <span className="eyebrow">CAPABILITY</span>
                      <span>{m.capabilities.join(', ')}</span>
                    </div>
                  </div>

                  <div className="card-button-row">
                    <button
                      className="card-btn secondary"
                      onClick={() => onConfigureProvider(m.provider)}
                    >
                      <Icon name="compare" /> Configure Provider
                    </button>
                    <button
                      className="card-btn primary"
                      onClick={() => onTestModel(m)}
                    >
                      <Icon name="shield" /> Test Model
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="open-dashboard-cta-row">
          <Magnetic className="studio-button primary" onClick={() => onNavigate('overview')}>
            <span>OPEN DASHBOARD <small>INSPECT REAL-TIME SYSTEM STATUS</small></span>
            <Icon name="diagonal" />
          </Magnetic>
        </div>
      </section>

      {/* 3D Premise Transition */}
      <div id="premise">
        <ThreeDTextReveal paused={motionPaused} />
      </div>

      {/* Section 02: Follow the boundary / Horizon */}
      <Features17 />

      {/* Section 03: Seven boundaries / Interactive Chip Architecture */}
      <Bento31 />

      {/* Section 04: Different capabilities. One coherent workflow */}
      <Showcase6 />

      {/* Section 05: An Ordered Investigation */}
      <HowItWorks8 />

      {/* Section 06: Two planes. No shortcuts */}
      <Comparison2 />

      {/* Section 07 & Footer: Assume Nothing / Enter the Workspace */}
      <Footer8 open={() => onNavigate('overview')} />

      {/* Cinematic Film Overlay Modal */}
      <AnimatePresence>
        {filmOpen && <FilmModal onClose={() => setFilmOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
