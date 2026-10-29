/* Google Scholar does not provide a dependable automatic profile-metrics API.
   These values come only from author-verified manual snapshots in local JSON.
   OpenAlex data remains separate in citations.js. */
(() => {
  'use strict';
  if (location.protocol === 'file:') return; // Static HTML fallback is complete offline.
  const fmtDate = stamp => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(stamp || '')) return null;
    const d = new Date(`${stamp}T00:00:00Z`);
    return isNaN(d.valueOf()) ? null : new Intl.DateTimeFormat('en-GB',
      {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(d);
  };
  async function run() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const r = await fetch(`assets/google-scholar-metrics.json?updated=${Date.now()}`,
        {signal:controller.signal,cache:'no-store'});
      if (!r.ok) throw new Error('Google Scholar snapshot is unavailable');
      const data = await r.json();
      if (data.source !== 'Google Scholar' || data.schema_version !== 1 ||
          data.profile_url !== 'https://scholar.google.com/citations?user=M1yoOGwAAAAJ&hl=en')
        throw new Error('Unexpected Google Scholar snapshot');
      const metrics = data.profile || {};
      const checked = fmtDate(data.profile_metrics_checked_at);
      const vals = [metrics.cited_by_count,metrics.h_index,metrics.i10_index];
      if (checked && vals.every(n => Number.isInteger(n) && n >= 0)) {
        const ids=['gs-profile-citations','gs-h-index','gs-i10-index'];
        ids.forEach((id,i) => {document.getElementById(id).textContent=String(vals[i]);});
        document.getElementById('gs-metrics-grid').hidden=false;
        document.getElementById('gs-pending').hidden=true;
        document.getElementById('gs-metrics-caption').hidden=false;
        const time=document.getElementById('gs-updated');
        time.textContent=checked;time.setAttribute('datetime',data.profile_metrics_checked_at);
      }
      // Article figures are displayed only when verified by user-provided evidence.
      const works=data.works || {};
      for (const card of document.querySelectorAll('.pub-card[data-openalex-doi]')) {
        const doi=card.dataset.openalexDoi;
        const w=works[doi];
        if (!w || !Number.isInteger(w.cited_by_count) || w.cited_by_count < 0 ||
            !fmtDate(w.verified_at)) continue;
        let badge=card.querySelector('.pub-citation-scholar[data-gs-doi]');
        if (!badge) {
          const box=card.querySelector('.pub-card-badges');
          if (!box) continue;
          badge=document.createElement('a');
          badge.className='pub-citation-badge pub-citation-scholar';
          badge.dataset.gsDoi=doi;
          badge.href=data.profile_url;
          badge.target='_blank';
          badge.rel='noopener noreferrer';
          box.prepend(badge);
        }
        badge.textContent=`Google Scholar · ${w.cited_by_count}`;
        badge.classList.remove('pub-citation-unverified');
        badge.dataset.gsCites=String(w.cited_by_count);
        badge.dataset.gsChecked=w.verified_at;
        badge.title=`Google Scholar: ${w.cited_by_count} citations, checked ${fmtDate(w.verified_at)}; updated manually.`;
        const title=card.querySelector('h3')?.textContent || '';
        badge.setAttribute('aria-label',`${w.cited_by_count} Google Scholar citations for ${title}; updated manually`);
      }
    } catch (err) {
      console.info('Showing last manually verified Google Scholar data:',err.message);
    } finally {clearTimeout(timer)}
  }
  run();
})();
