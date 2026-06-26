/* ============================================================
 * Area Wide Paving — Analytics & Conversion Tracking
 * ------------------------------------------------------------
 * One file. Loaded with `defer`. Handles:
 *   - GA4 + Google Ads gtag.js bootstrap
 *   - Phone-click conversion events
 *   - UTM persistence (so form submits get attribution)
 *   - "?ad=1" paid-traffic mode (hides nav/footer leaks)
 *   - window.AWP.fireConversion(label) helper for forms
 *
 * SETUP (paste real IDs once you have them):
 *   1. Replace AW_CONVERSION_ID with your Google Ads ID  (e.g. AW-123456789)
 *   2. Replace GA4_MEASUREMENT_ID                         (e.g. G-ABC1234567)
 *   3. Replace CONVERSION_LABELS.* with the labels Google Ads gives you
 *      when you create each conversion action.
 * ============================================================ */
(function () {
  'use strict';

  // ====== CONFIG — replace with real IDs in production ======
  var AW_CONVERSION_ID = 'AW-XXXXXXXXX';      // Google Ads conversion ID
  var GA4_MEASUREMENT_ID = 'G-XXXXXXXXXX';    // GA4 measurement ID
  var CONVERSION_LABELS = {
    phone_click:       'PHONE_CLICK_LABEL',   // from Google Ads → Conversions
    lead_form_submit:  'LEAD_FORM_LABEL',
    text_click:        'TEXT_CLICK_LABEL'
  };
  // ==========================================================

  // Don't track on localhost or preview/dev hostnames
  var host = location.hostname;
  var IS_PROD = host === 'areawidepaving.net' || host === 'www.areawidepaving.net';
  // Treat unconfigured IDs as "no tag installed yet"
  var HAS_REAL_IDS = AW_CONVERSION_ID.indexOf('XXX') === -1 && GA4_MEASUREMENT_ID.indexOf('XXX') === -1;

  // Always set up dataLayer + gtag stub so calls don't error in dev
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  // Default consent — granted for US small business (no GDPR/CCPA scope here)
  // Update later if/when consent UI is added
  gtag('consent', 'default', {
    ad_storage:        'granted',
    ad_user_data:      'granted',
    ad_personalization:'granted',
    analytics_storage: 'granted'
  });

  // Load gtag.js only in production with real IDs
  if (IS_PROD && HAS_REAL_IDS) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + AW_CONVERSION_ID;
    document.head.appendChild(s);

    gtag('js', new Date());
    gtag('config', AW_CONVERSION_ID);
    gtag('config', GA4_MEASUREMENT_ID);
  }

  // ====== UTM persistence (so form submits get full attribution) ======
  // Capture UTMs from URL → sessionStorage. Forms read them out on submit.
  try {
    var qs = new URLSearchParams(location.search);
    var utmKeys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','gad_source'];
    var existing = {};
    try { existing = JSON.parse(sessionStorage.getItem('awp_utm') || '{}'); } catch (e) {}
    var changed = false;
    utmKeys.forEach(function (k) {
      var v = qs.get(k);
      if (v) { existing[k] = v; changed = true; }
    });
    if (changed) sessionStorage.setItem('awp_utm', JSON.stringify(existing));
  } catch (e) { /* sessionStorage may be unavailable */ }

  // Public helper for forms / lead-form.js
  window.AWP = window.AWP || {};

  window.AWP.getAttribution = function () {
    try {
      var utm = JSON.parse(sessionStorage.getItem('awp_utm') || '{}');
      utm.landing_page = location.pathname + location.search;
      utm.referrer = document.referrer || '';
      return utm;
    } catch (e) {
      return { landing_page: location.pathname + location.search };
    }
  };

  window.AWP.fireConversion = function (label, params) {
    var send_to = AW_CONVERSION_ID + '/' + (CONVERSION_LABELS[label] || label);
    var payload = Object.assign({ send_to: send_to }, params || {});
    try { gtag('event', 'conversion', payload); } catch (e) {}
    // Also fire a GA4 event for analytics reporting
    try { gtag('event', label, params || {}); } catch (e) {}
    if (!IS_PROD || !HAS_REAL_IDS) {
      // Dev-friendly visibility
      try { console.log('[AWP] Conversion fired (dev):', label, payload); } catch (e) {}
    }
  };

  // ====== Phone-click tracking ======
  // Fire conversion on tap of any tel: link. Don't preventDefault — let dial happen.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="tel:"]');
    if (!a) return;
    window.AWP.fireConversion('phone_click', {
      phone:       a.getAttribute('href').replace('tel:', ''),
      cta_id:      a.id || '',
      cta_text:    (a.innerText || '').trim().slice(0, 80),
      page_path:   location.pathname
    });
  }, { passive: true });

  // SMS-click tracking (lower-value but useful)
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="sms:"]');
    if (!a) return;
    window.AWP.fireConversion('text_click', {
      cta_id:    a.id || '',
      page_path: location.pathname
    });
  }, { passive: true });

  // ====== "?ad=1" paid-traffic mode ======
  // When a visitor comes from a Google Ad (we add ?ad=1 to all ad final URLs),
  // hide nav + footer + breadcrumb + cross-link sections so the page is
  // single-purpose conversion. The persistent thumb-bar + form remain.
  try {
    var isAd = qs.get('ad') === '1' || qs.get('utm_medium') === 'cpc' || !!qs.get('gclid');
    if (isAd) {
      document.documentElement.classList.add('ad-mode');
      // Add stylesheet rules without needing a separate file
      var st = document.createElement('style');
      st.textContent = [
        '.ad-mode .city-header,',
        '.ad-mode footer,',
        '.ad-mode .city-footer,',
        '.ad-mode .breadcrumb,',
        '.ad-mode .footer-cta,',
        '.ad-mode .footer-bottom,',
        '.ad-mode [data-ad-hide] { display: none !important; }',
        '.ad-mode body { padding-top: 0 !important; }'
      ].join(' ');
      document.head.appendChild(st);
    }
  } catch (e) {}
})();
