/*
 * Records how a visitor found the site and which page they came from, then
 * fills the hidden source fields on the consultation form.
 * Stores only paths, referrer hostnames and UTM values. Never throws.
 */
(function () {
  'use strict';

  var SESSION_KEY = 'atlas_session';
  var FIRST_KEY = 'atlas_first';
  var FIRST_TTL = 90 * 24 * 60 * 60 * 1000; // 90 days
  var UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];

  function read(store, key) {
    try {
      var raw = window[store].getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function write(store, key, value) {
    try {
      window[store].setItem(key, JSON.stringify(value));
    } catch (e) { /* storage blocked or full */ }
  }

  function param(name) {
    try {
      var match = new RegExp('[?&]' + name + '=([^&#]*)').exec(location.search);
      return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')).slice(0, 100) : '';
    } catch (e) {
      return '';
    }
  }

  function referrerHost() {
    try {
      if (!document.referrer) return 'direct';
      var host = new URL(document.referrer).hostname;
      return host && host !== location.hostname ? host : 'direct';
    } catch (e) {
      return 'direct';
    }
  }

  function entry() {
    var data = {
      landing_page: location.pathname + location.search,
      referrer: referrerHost()
    };
    for (var i = 0; i < UTM.length; i++) data[UTM[i]] = param(UTM[i]);
    return data;
  }

  try {
    var path = location.pathname;

    // 1 and 2. Session data and previous page
    var session = read('sessionStorage', SESSION_KEY);
    if (!session) {
      session = entry();
      session.previous_page = '';
      session.current_page = '';
    }
    if (session.current_page !== path) {           // ignore reloads of the same page
      session.previous_page = session.current_page || '';
      session.current_page = path;
    }
    write('sessionStorage', SESSION_KEY, session);

    // 3. First visit, kept for 90 days and never overwritten while unexpired
    var first = read('localStorage', FIRST_KEY);
    if (!first || !first.ts || Date.now() - first.ts > FIRST_TTL) {
      first = entry();
      first.ts = Date.now();
      write('localStorage', FIRST_KEY, first);
    }

    // Fill hidden fields wherever they exist (the consultation form on /contact/)
    var values = {
      landing_page: session.landing_page,
      referrer: session.referrer,
      utm_source: session.utm_source,
      utm_medium: session.utm_medium,
      utm_campaign: session.utm_campaign,
      utm_content: session.utm_content,
      previous_page: session.previous_page,
      first_visit_landing_page: first.landing_page,
      first_visit_referrer: first.referrer,
      first_visit_date: first.ts ? new Date(first.ts).toISOString().slice(0, 10) : ''
    };
    for (var name in values) {
      if (!Object.prototype.hasOwnProperty.call(values, name)) continue;
      var fields = document.querySelectorAll('input[type="hidden"][name="' + name + '"]');
      for (var j = 0; j < fields.length; j++) fields[j].value = values[name] || '';
    }
  } catch (e) { /* never break the page */ }
})();
