(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const DEFAULTS = { overpay: '0', propertyValue: '240000', target: '59.5', cash: '0' };
  const STORAGE_KEY = 'morrow-planner-settings-v2';
  const LEGACY_STORAGE_KEY = 'morrow-planner-settings-v1';
  let wizardStep = 0;
  const money = (value, digits = 0) => new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', minimumFractionDigits: digits, maximumFractionDigits: digits
  }).format(Number.isFinite(value) ? value : 0);
  const number = (id, fallback = 0) => {
    const value = Number($(id).value);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  };
  const parseDate = (value) => {
    if (!value) return null;
    const parts = value.split('-').map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const formatShortDate = (date) => new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
  }).format(date);
  const formatMonthYear = (date) => new Intl.DateTimeFormat('en-GB', {
    month: 'short', year: 'numeric', timeZone: 'UTC'
  }).format(date);

  const readForm = () => ({
    balance: $('balanceInput').value,
    rate: $('rateInput').value,
    payment: $('paymentInput').value,
    balanceDate: $('balanceDateInput').value,
    fixEnd: $('fixEndInput').value,
    overpay: $('overpaySlider').value,
    propertyValue: $('valueSlider').value,
    target: document.querySelector('#plannerApp .target-choice.active')?.dataset.target || DEFAULTS.target,
    cash: $('cashSlider').value
  });

  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(readForm())); } catch (_) { /* Storage may be disabled. */ }
  }

  function restoreSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved || typeof saved !== 'object' || !saved.balance || !saved.rate || !saved.payment || !saved.balanceDate || !saved.fixEnd || !saved.propertyValue) return false;
      const map = {
        balance: 'balanceInput', rate: 'rateInput', payment: 'paymentInput',
        balanceDate: 'balanceDateInput', fixEnd: 'fixEndInput', overpay: 'overpaySlider',
        propertyValue: 'valueSlider', cash: 'cashSlider'
      };
      Object.entries(map).forEach(([key, id]) => {
        if (saved[key] !== undefined && $(id)) $(id).value = saved[key];
      });
      const target = String(saved.target ?? DEFAULTS.target);
      document.querySelectorAll('#plannerApp .target-choice').forEach((button) => {
        const active = button.dataset.target === target;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      return true;
    } catch (_) { return false; }
  }

  function countFuturePayments(balanceDate, fixEnd) {
    if (!balanceDate || !fixEnd || fixEnd <= balanceDate) return { count: 0, firstPayment: null };
    let paymentDate = new Date(Date.UTC(balanceDate.getUTCFullYear(), balanceDate.getUTCMonth(), 1));
    if (paymentDate <= balanceDate) paymentDate = new Date(Date.UTC(paymentDate.getUTCFullYear(), paymentDate.getUTCMonth() + 1, 1));
    const firstPayment = paymentDate;
    let count = 0;
    while (paymentDate < fixEnd && count < 720) {
      count += 1;
      paymentDate = new Date(Date.UTC(paymentDate.getUTCFullYear(), paymentDate.getUTCMonth() + 1, 1));
    }
    return { count, firstPayment };
  }

  function projectBalance(startBalance, annualRate, monthlyPayment, paymentCount) {
    if (paymentCount <= 0) return Math.max(0, startBalance);
    const monthlyRate = Math.max(0, annualRate) / 100 / 12;
    if (monthlyRate === 0) return Math.max(0, startBalance - monthlyPayment * paymentCount);
    const factor = Math.pow(1 + monthlyRate, paymentCount);
    const annuity = (factor - 1) / monthlyRate;
    return Math.max(0, startBalance * factor - monthlyPayment * annuity);
  }

  function recommendedExtra(startBalance, annualRate, regularPayment, targetBalance, paymentCount) {
    if (paymentCount <= 0 || targetBalance <= 0) return null;
    const monthlyRate = Math.max(0, annualRate) / 100 / 12;
    if (monthlyRate === 0) return Math.max(0, (startBalance - targetBalance) / paymentCount - regularPayment);
    const factor = Math.pow(1 + monthlyRate, paymentCount);
    const annuity = (factor - 1) / monthlyRate;
    const noExtraBalance = Math.max(0, startBalance * factor - regularPayment * annuity);
    if (noExtraBalance <= targetBalance) return 0;
    return Math.max(0, (startBalance * factor - regularPayment * annuity - targetBalance) / annuity);
  }

  function updateRangeFill(input) {
    const min = Number(input.min), max = Number(input.max), value = Number(input.value);
    const percent = max === min ? 0 : (value - min) / (max - min) * 100;
    input.style.setProperty('--range-fill', `${percent}%`);
  }

  function announce(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(announce.timer);
    announce.timer = setTimeout(() => toast.classList.remove('visible'), 2800);
  }

  function refresh() {
    const balance = number('balanceInput', 0);
    const rate = number('rateInput', 0);
    const regular = number('paymentInput', 0);
    const overpay = number('overpaySlider', 0);
    const propertyValue = Math.max(1, number('valueSlider', 240000));
    const targetPct = Number(document.querySelector('#plannerApp .target-choice.active')?.dataset.target || DEFAULTS.target);
    const cashBudget = number('cashSlider', 0);
    const balanceDate = parseDate($('balanceDateInput').value);
    const fixEnd = parseDate($('fixEndInput').value);
    const schedule = countFuturePayments(balanceDate, fixEnd);
    const months = schedule.count;
    const targetBalance = propertyValue * targetPct / 100;
    const beforeCash = projectBalance(balance, rate, regular + overpay, months);
    const afterCash = Math.max(0, beforeCash - cashBudget);
    const ltvBefore = beforeCash / propertyValue * 100;
    const ltvAfter = afterCash / propertyValue * 100;
    const grossCashNeeded = Math.max(0, beforeCash - targetBalance);
    const remainingCashNeeded = Math.max(0, grossCashNeeded - cashBudget);
    const recommended = recommendedExtra(balance, rate, regular, targetBalance, months);
    const recommendedWhole = recommended === null ? null : Math.ceil(recommended);
    const recommendedProjected = recommendedWhole === null ? beforeCash : projectBalance(balance, rate, regular + recommendedWhole, months);

    // Snapshot and labels
    $('snapshotBalance').textContent = money(balance);
    $('snapshotRate').innerHTML = `${rate.toFixed(2)}<span class="unit">%</span>`;
    $('snapshotPayment').textContent = money(regular + overpay, 2);
    $('snapshotTarget').innerHTML = `${Number(targetPct).toFixed(targetPct % 1 ? 1 : 0)}<span class="unit">%</span>`;
    $('overpayOutput').textContent = money(overpay);
    $('valueOutput').textContent = money(propertyValue);
    $('cashOutput').textContent = money(cashBudget);
    $('resultsDate').textContent = fixEnd ? `By ${formatMonthYear(fixEnd)}` : 'Fix end not set';
    $('heroFixEnd').textContent = fixEnd ? formatShortDate(fixEnd) : 'not set';
    $('paymentCountMeta').textContent = `${months} planned payment${months === 1 ? '' : 's'} in this example`;

    $('projectedBalance').textContent = money(beforeCash);
    $('projectedLtv').textContent = `${ltvBefore.toFixed(2)}%`;
    $('outcomeTarget').textContent = `${targetPct.toFixed(targetPct % 1 ? 1 : 0)}%`;
    $('cashNeeded').textContent = money(grossCashNeeded);
    $('cashExplanation').textContent = cashBudget > 0
      ? (remainingCashNeeded <= 0 ? 'Your planned top-up is enough to meet this target in the model.' : `${money(remainingCashNeeded)} more than your planned top-up would be needed.`)
      : 'Estimated one-off repayment needed at remortgage.';
    $('postCashBalance').textContent = money(afterCash);
    $('postCashLtv').textContent = `${ltvAfter.toFixed(2)}%`;
    $('projectedTag').textContent = cashBudget > 0 ? `£${Math.round(cashBudget).toLocaleString('en-GB')} cash planned` : 'Before one-off cash';

    // The marker shows the 60% threshold on a 0–80% visual scale; the progress shows this plan's estimated LTV.
    const progress = Math.min(100, Math.max(0, ltvBefore / 80 * 100));
    $('ltvProgress').style.width = `${progress}%`;
    $('ltvMarker').style.left = '75%';
    $('ltvMarker').setAttribute('aria-label', '60% loan-to-value threshold');
    $('ltvMeterAccessible').setAttribute('aria-label', `Estimated LTV ${ltvBefore.toFixed(2)} percent; the marked line is the 60 percent threshold.`);

    if (ltvAfter <= targetPct + 0.0001) {
      $('cashOutcome').classList.add('goal-reached');
      $('recommendationStatus').textContent = 'Goal already covered';
    } else {
      $('cashOutcome').classList.remove('goal-reached');
      $('recommendationStatus').textContent = recommendedWhole === null ? 'Check dates' : recommendedWhole === 0 ? 'No extra required' : 'Calculated for your goal';
    }

    if (recommendedWhole === null) {
      $('recommendedOverpay').innerHTML = `—<span>/mo</span>`;
      $('recommendedRegular').textContent = money(regular, 2);
      $('recommendedTotal').textContent = 'Check your dates';
      $('applyRecommendation').disabled = true;
      $('applyRecommendation').style.opacity = '.55';
      $('recommended-title').textContent = 'Monthly overpayment to hit your goal';
    } else {
      $('recommendedOverpay').innerHTML = `${money(recommendedWhole)}<span>/mo</span>`;
      $('recommendedRegular').textContent = money(regular, 2);
      $('recommendedTotal').textContent = `${money(regular + recommendedWhole, 2)} / month`;
      $('applyRecommendation').disabled = false;
      $('applyRecommendation').style.opacity = '1';
      $('recommended-title').textContent = recommendedWhole === 0
        ? 'Your goal may already be in reach'
        : 'Monthly overpayment to hit your goal';
    }

    updateScenarioList(balance, rate, regular, overpay, targetPct, months, propertyValue);
    ['overpaySlider', 'valueSlider', 'cashSlider'].forEach((id) => updateRangeFill($(id)));
    saveSettings();
  }

  function updateScenarioList(balance, rate, regular, overpay, targetPct, months, propertyValue) {
    const roundThousand = (value) => Math.max(10000, Math.round(value / 1000) * 1000);
    const scenarios = [
      { value: roundThousand(propertyValue * 0.95), label: '5% lower' },
      { value: roundThousand(propertyValue), label: 'Your estimate' },
      { value: roundThousand(propertyValue * 1.05), label: '5% higher' }
    ];
    const computed = scenarios.map((item) => {
      const projected = projectBalance(balance, rate, regular + overpay, months);
      const cash = Math.max(0, projected - item.value * targetPct / 100);
      return { ...item, projected, cash, ltv: projected / item.value * 100 };
    });
    const maxCash = Math.max(1, ...computed.map((item) => item.cash));
    $('scenarioList').innerHTML = computed.map((item) => {
      const width = item.cash === 0 ? 2 : Math.max(4, item.cash / maxCash * 100);
      return `<div class="scenario-row">
        <div><strong>${money(item.value)}</strong><span>${item.label} · ${item.ltv.toFixed(1)}% LTV</span></div>
        <div class="scenario-bar-wrap"><div class="scenario-bar"><span style="width:${width.toFixed(1)}%"></span></div></div>
        <strong class="scenario-cash">${money(Math.ceil(item.cash))}</strong>
      </div>`;
    }).join('');
  }

  function resetToDefaults() {
    const fieldIds = ['balanceInput', 'rateInput', 'paymentInput', 'balanceDateInput', 'fixEndInput'];
    fieldIds.forEach((id) => { $(id).value = ''; });
    $('overpaySlider').value = '0';
    $('valueSlider').value = '240000';
    $('cashSlider').value = '0';
    document.querySelectorAll('#plannerApp .target-choice').forEach((button) => {
      const active = button.dataset.target === DEFAULTS.target;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (_) { /* Ignore unavailable storage. */ }
    ['wizardBalance','wizardRate','wizardPayment','wizardBalanceDate','wizardFixEnd','wizardPropertyValue'].forEach((id) => { $(id).value = ''; });
    $('wizardOverpay').value = '0';
    $('wizardCash').value = '0';
    document.querySelectorAll('[data-wizard-target]').forEach((button) => {
      const active = button.dataset.wizardTarget === DEFAULTS.target;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    updateWizardSliderLabels();
    wizardStep = 0;
    showOnboarding();
    announce('Your plan was cleared. Start fresh with your own figures.');
  }

  const WIZARD_STEPS = [
    { stage: 'A quick introduction', eyebrow: 'A CALMER WAY TO PLAN', title: 'Your next mortgage move,<br><em>made clearer.</em>', description: 'A few simple steps will help you explore how to reach your target loan-to-value (LTV), using monthly overpayments, a one-off cash top-up, or a mix of both.', kicker: 'START HERE', cardTitle: 'What we’ll work towards', counter: 'START', button: 'Let’s get started' },
    { stage: 'Step 1 of 4 · Your mortgage', eyebrow: 'START WITH THE BASICS', title: 'Let’s start with<br><em>your mortgage.</em>', description: 'Use the figures from your latest mortgage statement. These are the starting point for every estimate in your plan.', kicker: 'STEP 1 OF 4', cardTitle: 'Your mortgage balance and rate', counter: '01 / 04', button: 'Continue' },
    { stage: 'Step 2 of 4 · Payment and dates', eyebrow: 'SET YOUR TIMELINE', title: 'Now, your monthly<br><em>commitment.</em>', description: 'Your monthly payment and remaining time on the current deal determine how your balance might change.', kicker: 'STEP 2 OF 4', cardTitle: 'Monthly payment and dates', counter: '02 / 04', button: 'Continue' },
    { stage: 'Step 3 of 4 · Your target', eyebrow: 'CHOOSE YOUR DESTINATION', title: 'Where could your home<br><em>value land?</em>', description: 'Estimate what your property might be worth at remortgage and choose a target LTV. You can test cautious and optimistic scenarios later.', kicker: 'STEP 3 OF 4', cardTitle: 'Property value and LTV goal', counter: '03 / 04', button: 'Continue' },
    { stage: 'Step 4 of 4 · Your approach', eyebrow: 'MAKE IT FEEL ACHIEVABLE', title: 'Build a plan that<br><em>fits your life.</em>', description: 'Choose a monthly overpayment and any cash you might be comfortable putting in later. You can adjust both on the planner screen.', kicker: 'STEP 4 OF 4', cardTitle: 'Monthly extra and possible cash', counter: '04 / 04', button: 'Build my plan' }
  ];

  function renderWizard() {
    const meta = WIZARD_STEPS[wizardStep];
    document.querySelectorAll('[data-wizard-screen]').forEach((screen) => {
      const active = Number(screen.dataset.wizardScreen) === wizardStep;
      screen.hidden = !active;
      screen.classList.toggle('active', active);
    });
    $('wizardStageLabel').textContent = meta.stage;
    $('wizardEyebrow').textContent = meta.eyebrow;
    $('wizardTitle').innerHTML = meta.title;
    $('wizardDescription').textContent = meta.description;
    $('wizardCardKicker').textContent = meta.kicker;
    $('wizardCardTitle').textContent = meta.cardTitle;
    $('wizardCounter').textContent = meta.counter;
    $('wizardNextBtn').innerHTML = `${meta.button} <span aria-hidden="true">→</span>`;
    $('wizardBackBtn').hidden = wizardStep === 0;
    $('wizardProgressFill').style.width = `${wizardStep === 0 ? 0 : wizardStep / 4 * 100}%`;
    document.querySelectorAll('.wizard-error').forEach((node) => { node.hidden = true; });
  }

  function showOnboarding() {
    $('plannerApp').hidden = true;
    $('onboarding').hidden = false;
    renderWizard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showPlanner() {
    $('onboarding').hidden = true;
    $('plannerApp').hidden = false;
    refresh();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateWizardSliderLabels() {
    $('wizardOverpayOutput').textContent = money(number('wizardOverpay', 0));
    $('wizardCashOutput').textContent = money(number('wizardCash', 0));
    ['wizardOverpay', 'wizardCash'].forEach((id) => updateRangeFill($(id)));
  }

  function validateWizardStep() {
    const showError = (id) => { $(id).hidden = false; };
    if (wizardStep === 1) {
      const balance = Number($('wizardBalance').value);
      const rate = Number($('wizardRate').value);
      if (!Number.isFinite(balance) || balance <= 0 || balance > 2000000 || !Number.isFinite(rate) || rate < 0 || rate > 30 || $('wizardBalance').value === '' || $('wizardRate').value === '') {
        showError('wizardError1');
        return false;
      }
    }
    if (wizardStep === 2) {
      const payment = Number($('wizardPayment').value);
      const balanceDate = $('wizardBalanceDate').value;
      const fixEnd = $('wizardFixEnd').value;
      if (!Number.isFinite(payment) || payment <= 0 || payment > 100000 || !balanceDate || !fixEnd || fixEnd <= balanceDate) {
        showError('wizardError2');
        return false;
      }
    }
    if (wizardStep === 3) {
      const value = Number($('wizardPropertyValue').value);
      if (!Number.isFinite(value) || value < 50000 || value > 1000000 || $('wizardPropertyValue').value === '') {
        showError('wizardError3');
        return false;
      }
    }
    return true;
  }

  function completeWizard() {
    $('balanceInput').value = $('wizardBalance').value;
    $('rateInput').value = $('wizardRate').value;
    $('paymentInput').value = $('wizardPayment').value;
    $('balanceDateInput').value = $('wizardBalanceDate').value;
    $('fixEndInput').value = $('wizardFixEnd').value;
    $('overpaySlider').value = $('wizardOverpay').value;
    $('cashSlider').value = $('wizardCash').value;
    const propertyValue = Number($('wizardPropertyValue').value);
    $('valueSlider').value = String(Math.min(1000000, Math.max(50000, propertyValue)));
    document.querySelectorAll('#plannerApp .target-choice').forEach((button) => {
      const active = button.dataset.target === (document.querySelector('[data-wizard-target].active')?.dataset.wizardTarget || DEFAULTS.target);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $('valueSlider').dispatchEvent(new Event('input', { bubbles: true }));
    showPlanner();
    announce('Your plan is ready. You can change any assumption as you go.');
  }

  $('wizardNextBtn').addEventListener('click', () => {
    if (wizardStep > 0 && !validateWizardStep()) return;
    if (wizardStep === 4) return completeWizard();
    wizardStep = Math.min(4, wizardStep + 1);
    renderWizard();
    const focusTarget = document.querySelector(`[data-wizard-screen="${wizardStep}"] input`);
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  });
  $('wizardBackBtn').addEventListener('click', () => {
    wizardStep = Math.max(0, wizardStep - 1);
    renderWizard();
  });
  document.querySelectorAll('[data-wizard-target]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-wizard-target]').forEach((other) => {
        const active = other === button;
        other.classList.toggle('active', active);
        other.setAttribute('aria-pressed', String(active));
      });
    });
  });
  ['wizardOverpay', 'wizardCash'].forEach((id) => $(id).addEventListener('input', updateWizardSliderLabels));

  document.querySelectorAll('#plannerApp .target-choice').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('#plannerApp .target-choice').forEach((other) => {
        const active = other === button;
        other.classList.toggle('active', active);
        other.setAttribute('aria-pressed', String(active));
      });
      refresh();
    });
  });

  ['balanceInput', 'rateInput', 'paymentInput', 'balanceDateInput', 'fixEndInput', 'overpaySlider', 'valueSlider', 'cashSlider'].forEach((id) => {
    $(id).addEventListener('input', refresh);
    $(id).addEventListener('change', refresh);
  });
  $('resetBtn').addEventListener('click', resetToDefaults);
  $('applyRecommendation').addEventListener('click', () => {
    const balance = number('balanceInput', 0);
    const rate = number('rateInput', 0);
    const regular = number('paymentInput', 0);
    const targetPct = Number(document.querySelector('#plannerApp .target-choice.active')?.dataset.target || DEFAULTS.target);
    const propertyValue = Math.max(1, number('valueSlider', 240000));
    const dates = countFuturePayments(parseDate($('balanceDateInput').value), parseDate($('fixEndInput').value));
    const recommended = recommendedExtra(balance, rate, regular, propertyValue * targetPct / 100, dates.count);
    if (recommended === null) return announce('Please check the balance date and fix-end date first.');
    $('overpaySlider').value = String(Math.min(500, Math.ceil(recommended)));
    refresh();
    if (recommended > 500) announce(`Applied £500/month, the slider maximum. The estimate needs around ${money(Math.ceil(recommended))}/month to meet the target.`);
    else announce(`Monthly overpayment set to ${money(Math.ceil(recommended))}.`);
  });
  $('detailsBtn').addEventListener('click', () => {
    const details = $('calculationDetails');
    const showing = details.hidden;
    details.hidden = !showing;
    $('detailsBtn').setAttribute('aria-expanded', String(showing));
    $('detailsBtn').innerHTML = showing ? 'Hide calculation details <span aria-hidden="true">−</span>' : 'Show calculation details <span aria-hidden="true">＋</span>';
  });
  $('shareBtn').addEventListener('click', async () => {
    const shareData = { title: 'Morrow — Mortgage planner', text: 'Plan mortgage overpayments and remortgage LTV with Morrow.', url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(window.location.href); announce('Planner link copied.'); }
      else announce('Copy this page URL to share the planner.');
    } catch (error) {
      if (error?.name !== 'AbortError') announce('Use your browser menu to share this page.');
    }
  });

  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    $('installBtn').hidden = false;
  });
  $('installBtn').addEventListener('click', async () => {
    if (!deferredInstallPrompt) {
      announce('Use your browser menu and choose “Install app” or “Add to Home Screen”.');
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $('installBtn').hidden = true;
  });

  try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch (_) { /* Ignore unavailable storage. */ }
  if (restoreSettings()) {
    $('onboarding').hidden = true;
    $('plannerApp').hidden = false;
    refresh();
  } else {
    showOnboarding();
    updateWizardSliderLabels();
  }

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* Offline support is optional if registration fails. */ });
    });
  }
})();
