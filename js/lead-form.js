/* ============================================================
 * Area Wide Paving — Lead Form Handler
 * ------------------------------------------------------------
 * Single shared form handler so every paving LP submits to
 * /api/contact, fires a Google Ads conversion, and lands on
 * /thank-you.html for reliable conversion attribution.
 *
 * Markup contract — your form must:
 *   1. Have attribute  data-awp-form  (any value)
 *   2. Have a hidden honeypot input named "company" (we'll inject if missing)
 *   3. Have inputs whose names are any subset of:
 *        name (required), phone (required), email, city, service, details, message
 *
 * Optional attributes on the <form>:
 *   data-awp-service="driveway" | "parking lot" | "sealcoating" | etc.
 *   data-awp-city="Tyler, TX"   (will be sent if no city input is present)
 *   data-awp-redirect="/thank-you.html"  (default — set to "" for inline-only)
 *   data-awp-conversion="lead_form_submit"  (default)
 * ============================================================ */
(function () {
  'use strict';

  function getVal(form, name) {
    var el = form.querySelector('[name="' + name + '"]');
    return el ? (el.value || '').trim() : '';
  }

  function injectHoneypot(form) {
    if (form.querySelector('[name="company"]')) return;
    var hp = document.createElement('input');
    hp.type = 'text';
    hp.name = 'company';
    hp.tabIndex = -1;
    hp.autocomplete = 'off';
    hp.setAttribute('aria-hidden', 'true');
    // Off-screen but technically visible (some bots check display:none)
    hp.style.cssText = 'position:absolute !important;left:-9999px !important;width:1px;height:1px;opacity:0;';
    form.appendChild(hp);
  }

  function showSuccessInline(form) {
    form.innerHTML =
      '<p style="color:var(--amber, #F5A623); text-align:center; padding:32px 16px; font-weight:600; font-size:18px; line-height:1.4;">' +
      '\u2713 Got it. Paul will call you within 24 hours. ' +
      '<br><span style="color:var(--bone-2, #EAE4D9); font-weight:400; font-size:15px;">Need it faster? Call ' +
      '<a href="tel:9038856388" style="color:var(--amber, #F5A623);">(903) 885-6388</a>.</span></p>';
  }

  function showError(form, msg) {
    var btn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (btn) {
      btn.disabled = false;
      if (btn._awpOriginal) btn.textContent = btn._awpOriginal;
    }
    var existing = form.querySelector('.awp-form-error');
    if (existing) existing.remove();
    var err = document.createElement('p');
    err.className = 'awp-form-error';
    err.style.cssText = 'color:#e05c4b; text-align:center; font-size:14px; margin-top:14px;';
    err.textContent = msg || 'Something went wrong. Please call (903) 885-6388.';
    form.appendChild(err);
  }

  function setLoading(form) {
    var btn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (btn) {
      btn._awpOriginal = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Sending\u2026';
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    var form = e.currentTarget;

    // Honeypot — if filled, silently "succeed" so bot moves on
    var hp = form.querySelector('[name="company"]');
    if (hp && hp.value) {
      showSuccessInline(form);
      return;
    }

    // Build payload — combine free-form fields (size, zip, message) into a
    // single details string so the API receives consistent data.
    var detailParts = [];
    var sizeVal = getVal(form, 'size');     if (sizeVal) detailParts.push('Size: ' + sizeVal);
    var zipVal  = getVal(form, 'zip');      if (zipVal)  detailParts.push('ZIP: ' + zipVal);
    var msgVal  = getVal(form, 'message');  if (msgVal)  detailParts.push(msgVal);
    var detailsField = getVal(form, 'details');
    var combinedDetails = [detailsField, detailParts.join(' · ')].filter(Boolean).join(' · ');

    var payload = {
      name:    getVal(form, 'name'),
      phone:   getVal(form, 'phone'),
      email:   getVal(form, 'email'),
      city:    getVal(form, 'city')    || form.dataset.awpCity    || '',
      service: getVal(form, 'service') || form.dataset.awpService || '',
      details: combinedDetails
    };

    if (!payload.name || !payload.phone) {
      showError(form, 'Name and phone are required.');
      return;
    }

    // Attach UTM/attribution data so Paul sees which ad / page produced the lead
    if (window.AWP && typeof window.AWP.getAttribution === 'function') {
      var attr = window.AWP.getAttribution();
      payload.attribution = attr;
      // Also flatten utm_source into details if present (helpful for Paul reading email on phone)
      if (attr.utm_source || attr.gclid) {
        var src = [];
        if (attr.utm_source)   src.push('source=' + attr.utm_source);
        if (attr.utm_campaign) src.push('campaign=' + attr.utm_campaign);
        if (attr.utm_medium)   src.push('medium=' + attr.utm_medium);
        if (attr.gclid)        src.push('gclid=' + attr.gclid.slice(0, 12) + '\u2026');
        payload.details = (payload.details ? payload.details + '\n\n' : '') + '[Source: ' + src.join(', ') + ']';
      }
    }

    setLoading(form);

    // Fire conversion
    var conversion = form.dataset.awpConversion || 'lead_form_submit';
    if (window.AWP && typeof window.AWP.fireConversion === 'function') {
      window.AWP.fireConversion(conversion, {
        service:   payload.service || '',
        city:      payload.city || '',
        page_path: location.pathname
      });
    }

    // Show inline success — lead-capture.js handles the actual submission
    showSuccessInline(form);
  }

  function wire(form) {
    if (form._awpWired) return;
    form._awpWired = true;
    injectHoneypot(form);
    form.addEventListener('submit', handleSubmit);
  }

  function init() {
    document.querySelectorAll('form[data-awp-form]').forEach(wire);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
