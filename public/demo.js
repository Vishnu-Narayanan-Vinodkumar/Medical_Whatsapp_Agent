(() => {
  const byId = id => document.getElementById(id);
  const icons = () => window.lucide && window.lucide.createIcons();

  const AGENTS = [
    { key: 'intake', label: 'Patient Intake', icon: 'message-circle', desc: 'Receives the incoming patient message and session context.' },
    { key: 'classifier', label: 'Classifier Agent', icon: 'split', desc: 'Detects intent (report status, centre info, pricing, appointment, escalation) with a confidence score. Low-confidence requests are routed to escalation.' },
    { key: 'assistant', label: 'Assistant Agent', icon: 'bot', desc: 'Drafts a natural-language reply and selects an app action (reports, centres, pricing, booking, support), grounded only in catalogue data.' },
    { key: 'action', label: 'Action Handler', icon: 'workflow', desc: 'Executes the deterministic operation behind the chosen action: report lookup, centre/pricing lookup, booking flow, or support ticket creation.' },
    { key: 'guardrail', label: 'Safety Guardrail', icon: 'shield-check', desc: 'Redacts identifiers, blocks clinical interpretation or diagnosis, and enforces confirmation before any booking or payment action.' },
    { key: 'delivery', label: 'Reply Delivery', icon: 'send', desc: 'Returns the final, guardrailed message and any related app controls to the patient conversation.' },
  ];

  const SCENARIOS = [
    {
      title: 'Is my blood test report ready yet?',
      reply: 'Your Complete Blood Count report is ready (reported on 21 Sep). You can open it from the Reports card below. I can’t interpret results, so please discuss findings with your doctor.',
      steps: [
        { agent: 'intake', title: 'Message received', desc: 'Patient message enters the pipeline with session and account context attached.' },
        { agent: 'classifier', title: 'Intent classified', desc: 'Classifier agent scores the message against known intents.', payload: `{"intent":"report_status","confidence":0.97}` },
        { agent: 'assistant', title: 'Reply drafted', desc: 'Assistant agent drafts a response and selects the "reports" action, using only catalogue and report metadata (never interpreting results).', payload: `{"action":"reports","message":"Let me check your latest report status."}` },
        { agent: 'action', title: 'Report status retrieved', desc: 'Action handler queries the report status store for this patient only.', payload: `{"name":"Complete Blood Count","status":"ready","report_date":"2026-09-21"}` },
        { agent: 'guardrail', title: 'Guardrail check', desc: 'No clinical interpretation is added; only readiness and status facts pass through.' },
        { agent: 'delivery', title: 'Delivered to patient', desc: 'Final message and a report card action are returned to the chat UI.' },
      ],
    },
    {
      title: 'I need to book a full body checkup in Bengaluru next week.',
      reply: 'Here are open slots for a Full Body Checkup in Bengaluru at ₹2,499. Please confirm the centre, date and time in the booking form to reserve it.',
      steps: [
        { agent: 'intake', title: 'Message received', desc: 'Patient message enters the pipeline.' },
        { agent: 'classifier', title: 'Intent classified', desc: 'Classifier agent detects a booking intent.', payload: `{"intent":"appointment","confidence":0.95}` },
        { agent: 'assistant', title: 'Reply drafted', desc: 'Assistant agent opens the booking controls rather than booking anything itself; it never confirms a slot on its own.', payload: `{"action":"book","message":"I’ll open the booking form so you can pick a centre, date and time."}` },
        { agent: 'action', title: 'Booking options loaded', desc: 'Action handler loads live catalogue data: centres, packages and price for the selected city.', payload: `{"city":"Bengaluru","product":"Full Body Checkup","price":2499,"slots":["09:00","10:30","14:00"]}` },
        { agent: 'guardrail', title: 'Guardrail check', desc: 'Patient must explicitly confirm centre, test, date and price before anything is reserved; the agent cannot auto-confirm.' },
        { agent: 'delivery', title: 'Delivered to patient', desc: 'Booking form is opened in-chat for the patient to confirm.' },
      ],
    },
    {
      title: 'My glucose result looks high, what does that mean for me?',
      reply: 'I’ve created support request T-10432 and a member of our team will follow up shortly. For urgent symptoms, please contact your doctor or local emergency services.',
      steps: [
        { agent: 'intake', title: 'Message received', desc: 'Patient message enters the pipeline.' },
        { agent: 'classifier', title: 'Intent classified as escalation', desc: 'Requests for clinical interpretation are always routed to escalation, regardless of confidence.', payload: `{"intent":"escalation","confidence":0.99,"reason":"clinical_interpretation"}` },
        { agent: 'assistant', title: 'Reply drafted', desc: 'Assistant agent declines to interpret results and offers a human handoff instead.', payload: `{"action":"support","message":"I can’t interpret test results. I can connect you with a support operator or you can contact your doctor."}` },
        { agent: 'action', title: 'Support ticket created', desc: 'Action handler creates a support ticket only after explicit patient consent.', payload: `{"ticket_id":"T-10432","status":"waiting","queue_position":2}` },
        { agent: 'guardrail', title: 'Guardrail check', desc: 'No diagnosis, treatment or medication advice is ever generated; the message is redirected to a qualified human.' },
        { agent: 'delivery', title: 'Delivered to patient', desc: 'Ticket status and next steps are shown to the patient in the support panel.' },
      ],
    },
  ];

  let running = false;
  let runToken = 0;

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  function renderPipelineShell() {
    const pipeline = byId('demo-pipeline');
    pipeline.replaceChildren();
    AGENTS.forEach((agent, i) => {
      const node = el('div', undefined, 'demo-agent-node');
      node.dataset.agent = agent.key;
      const iconWrap = el('div', undefined, 'demo-agent-icon');
      const iconEl = document.createElement('i');
      iconEl.dataset.lucide = agent.icon;
      iconWrap.append(iconEl);
      node.append(iconWrap, el('span', agent.label, 'demo-agent-label'));
      pipeline.append(node);
      if (i < AGENTS.length - 1) {
        const arrow = el('div', undefined, 'demo-agent-arrow');
        const arrowIcon = document.createElement('i');
        arrowIcon.dataset.lucide = 'chevron-right';
        arrow.append(arrowIcon);
        pipeline.append(arrow);
      }
    });
    icons();
  }

  function renderScenarioButtons() {
    const picker = byId('demo-scenario-picker');
    picker.replaceChildren();
    SCENARIOS.forEach((scenario, i) => {
      const button = el('button', scenario.title, 'demo-scenario-btn');
      button.type = 'button';
      button.disabled = running;
      button.addEventListener('click', () => runScenario(i));
      picker.append(button);
    });
  }

  function setSampleButtonsDisabled(disabled) {
    document.querySelectorAll('.demo-scenario-btn').forEach(button => { button.disabled = disabled; });
  }

  function appendBubble(role, text) {
    const messages = byId('demo-messages');
    const bubble = el('div', undefined, `demo-bubble ${role}`);
    bubble.append(el('div', text, 'demo-bubble-text'));
    messages.append(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }

  function setAgentState(agentKey, state) {
    const node = document.querySelector(`.demo-agent-node[data-agent="${agentKey}"]`);
    if (!node) return;
    node.classList.remove('active', 'done');
    if (state) node.classList.add(state);
  }

  function resetPipeline() {
    document.querySelectorAll('.demo-agent-node').forEach(node => node.classList.remove('active', 'done'));
  }

  function clearStepList() {
    byId('demo-step-list').replaceChildren();
  }

  function appendStepRow(step, index) {
    const agent = AGENTS.find(a => a.key === step.agent);
    const list = byId('demo-step-list');
    const row = el('div', undefined, 'demo-step-row enter');
    const header = el('div', undefined, 'demo-step-row-header');
    header.append(el('span', String(index + 1).padStart(2, '0'), 'demo-step-index'), el('span', agent.label, 'demo-step-agent'), el('span', step.title, 'demo-step-title-inline'));
    row.append(header, el('p', step.desc, 'muted'));
    if (step.payload) row.append(el('pre', step.payload, 'demo-payload'));
    list.append(row);
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function setTyping(on) {
    let node = document.getElementById('demo-typing-bubble');
    if (on) {
      if (node) return;
      node = el('div', undefined, 'demo-bubble bot');
      node.id = 'demo-typing-bubble';
      const dots = el('div', undefined, 'demo-typing-dots');
      dots.append(el('span'), el('span'), el('span'));
      node.append(dots);
      byId('demo-messages').append(node);
      byId('demo-messages').scrollTop = byId('demo-messages').scrollHeight;
    } else if (node) node.remove();
  }

  async function runScenario(index) {
    if (running) return;
    running = true;
    const token = ++runToken;
    const alive = () => token === runToken;

    setSampleButtonsDisabled(true);
    resetPipeline();
    clearStepList();
    byId('demo-messages').replaceChildren();

    const scenario = SCENARIOS[index];
    appendBubble('patient', scenario.title);

    const statusBar = byId('demo-crew-status');
    const statusText = byId('demo-crew-status-text');

    await sleep(500);
    if (!alive()) return;
    statusBar.hidden = false;
    statusText.textContent = 'Your CrewAI crew is spinning up…';
    await sleep(900);

    for (let i = 0; i < scenario.steps.length; i++) {
      if (!alive()) return;
      const step = scenario.steps[i];
      const agent = AGENTS.find(a => a.key === step.agent);

      statusText.textContent = `${agent.label} is working…`;
      setAgentState(step.agent, 'active');
      await sleep(950 + Math.round(Math.random() * 400));
      if (!alive()) return;

      appendStepRow(step, i);
      setAgentState(step.agent, 'done');
      statusText.textContent = `${agent.label} handed off…`;
      await sleep(450);
    }

    if (!alive()) return;
    statusText.textContent = 'Preparing final response…';
    await sleep(500);
    if (!alive()) return;
    statusBar.hidden = true;

    setTyping(true);
    await sleep(1100);
    if (!alive()) return;
    setTyping(false);
    appendBubble('bot', scenario.reply);

    running = false;
    setSampleButtonsDisabled(false);
  }

  function openDemo() {
    byId('demo-overlay').hidden = false;
    document.body.style.overflow = 'hidden';
    running = false;
    runToken++;
    renderPipelineShell();
    renderScenarioButtons();
    byId('demo-messages').replaceChildren();
    byId('demo-crew-status').hidden = true;
    clearStepList();
    icons();
  }

  function closeDemo() {
    runToken++;
    running = false;
    byId('demo-overlay').hidden = true;
    document.body.style.overflow = '';
  }

  byId('watch-demo').addEventListener('click', openDemo);
  byId('demo-close').addEventListener('click', closeDemo);
  byId('demo-overlay').addEventListener('click', event => { if (event.target.id === 'demo-overlay') closeDemo(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !byId('demo-overlay').hidden) closeDemo(); });
})();
