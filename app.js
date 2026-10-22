(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const DEFAULTS = {
    balance: '134396.39', rate: '4.56', payment: '715.85', balanceDate: '2026-10-22',
    fixEnd: '2030-02-28', overpay: '33', propertyValue: '200000', target: '59.5', cash: '0'
  };
  const STORAGE_KEY = 'morrow-planner-settings-v1';
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
    target: document.querySelector('.target-choice.active')?.dataset.target || DEFAULTS.target,
    cash: $('cashSlider').value
  });

  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(readForm())); } catch (_) { /* Storage may be disabled. */ }
  }

  function restoreSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved || typeof saved !== 'object') return;
      const map = {
        balance: 'balanceInput', rate: 'rateInput', payment: 'paymentInput',
        balanceDate: 'balanceDateInput', fixEnd: 'fixEndInput', overpay: 'overpaySlider',
        propertyValue: 'valueSlider', cash: 'cashSlider'
      };
      Object.entries(map).forEach(([key, id]) => {
        if (saved[key] !== undefined && $(id)) $(id).value = saved[key];
      });
      const target = String(saved.target ?? DEFAULTS.target);
      document.querySelectorAll('.target-choice').forEach((button) => {
        const active = button.dataset.target === target;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    } catch (_) { /* Ignore invalid or unavailable local settings. */ }
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
    const balance = number('balanceInput', 134396.39);
    const rate = number('rateInput', 4.56);
    const regular = number('paymentInput', 715.85);
    const overpay = number('overpaySlider', 33);
    const propertyValue = Math.max(1, number('valueSlider', 200000));
    const targetPct = Number(document.querySelector('.target-choice.active')?.dataset.target || DEFAULTS.target);
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

    updateScenarioList(balance, rate, regular, overpay, targetPct, months);
    ['overpaySlider', 'valueSlider', 'cashSlider'].forEach((id) => updateRangeFill($(id)));
    saveSettings();
  }

  function updateScenarioList(balance, rate, regular, overpay, targetPct, months) {
    const scenarios = [
      { value: 195000, label: 'Conservative' },
      { value: 200000, label: 'Middle case' },
      { value: 210000, label: 'Higher value' }
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
    Object.entries({ balance: 'balanceInput', rate: 'rateInput', payment: 'paymentInput', balanceDate: 'balanceDateInput', fixEnd: 'fixEndInput', overpay: 'overpaySlider', propertyValue: 'valueSlider', cash: 'cashSlider' }).forEach(([key, id]) => {
      $(id).value = DEFAULTS[key];
    });
    document.querySelectorAll('.target-choice').forEach((button) => {
      const active = button.dataset.target === DEFAULTS.target;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* Ignore unavailable storage. */ }
    refresh();
    announce('Starting figures restored.');
  }

  document.querySelectorAll('.target-choice').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.target-choice').forEach((other) => {
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
    const balance = number('balanceInput', 134396.39);
    const rate = number('rateInput', 4.56);
    const regular = number('paymentInput', 715.85);
    const targetPct = Number(document.querySelector('.target-choice.active')?.dataset.target || DEFAULTS.target);
    const propertyValue = Math.max(1, number('valueSlider', 200000));
    const dates = countFuturePayments(parseDate($('balanceDateInput').value), parseDate($('fixEndInput').value));
    const recommended = recommendedExtra(balance, rate, regular, propertyValue * targetPct / 100, dates.count);
    if (recommended === null) return announce('Please check the balance date and fix-end date first.');
    $('overpaySlider').value = String(Math.min(300, Math.ceil(recommended)));
    refresh();
    if (recommended > 300) announce(`Applied £300/month, the slider maximum. The estimate needs around ${money(Math.ceil(recommended))}/month to meet the target.`);
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

  restoreSettings();
  refresh();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* Offline support is optional if registration fails. */ });
    });
  }
})();
