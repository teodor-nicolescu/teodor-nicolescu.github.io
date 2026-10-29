/* OpenAlex citation data: independent of manually checked Google Scholar figures.
   A missing DOI is never treated as zero citations. */
(() => {
  'use strict';
  if (location.protocol === 'file:') return; // HTML contains safe fallback for local previews
  const AUTHOR='A5020131961';
  const ORCID='0009-0004-1196-2069';
  const badges=[...document.querySelectorAll('.pub-citation-openalex[data-doi]')];
  const fmtDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
    const t=new Date(value+'T00:00:00Z');
    return isNaN(t.valueOf()) ? null : new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(t);
  };
  async function update() {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),9000);
    try {
      const response=await fetch('assets/openalex-citations.json?cache='+Date.now(),{signal:controller.signal,cache:'no-store'});
      if (!response.ok) throw Error('OpenAlex snapshot unavailable');
      const data=await response.json();
      if (data.source!=='OpenAlex' || data.author_id!==AUTHOR || data.orcid!==ORCID || !data.works) throw Error('Unexpected author record');
      for (const badge of badges) {
        const work=data.works[badge.dataset.doi];
        if (!work || !Number.isInteger(work.cited_by_count) || work.cited_by_count<0) continue;
        badge.textContent='OpenAlex · '+work.cited_by_count;
        badge.dataset.cites=String(work.cited_by_count);
        badge.classList.remove('pub-citation-unverified');
        const id=String(work.openalex_id||'');
        if (/^W\d+$/.test(id)) badge.href='https://openalex.org/works/'+id;
        badge.setAttribute('aria-label', work.cited_by_count+' OpenAlex citations for '+(badge.closest('.pub-card')?.querySelector('h3')?.textContent||''));
        badge.title='OpenAlex: citation count from the last successful synchronization.';
      }
      const profile=data.profile || {};
      const fields={'oa-profile-citations':'cited_by_count','oa-h-index':'h_index','oa-i10-index':'i10_index','oa-work-count':'works_count'};
      if (Object.values(fields).every(k=>Number.isInteger(profile[k]) && profile[k]>=0)) {
        Object.entries(fields).forEach(([id,k])=>{const el=document.getElementById(id);if(el) el.textContent=String(profile[k]);});
        const summary=document.getElementById('oa-works-summary');
        if (summary) {
          const shown = Number.isInteger(data.selected_count) ? data.selected_count : badges.length;
          summary.textContent=`Indexed profile: ${profile.works_count} works (${shown} shown here).`;
        }
      }
      const date=fmtDate(data.updated_at);
      if (date) {
        const el=document.getElementById('oa-updated');
        if (el) {el.textContent=date;el.setAttribute('datetime',data.updated_at)}
      }
    } catch(err) {console.info('Retaining verified OpenAlex figures:',err.message)}
    finally {clearTimeout(timer)}
  }
  update();
})();
