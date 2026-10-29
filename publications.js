/* Progressive enhancement. Static references and the full CSV also work without JS.
   Data is embedded in publications.html, so a local file:// preview needs no server. */
(() => {
  'use strict';
  const dataEl = document.getElementById('publication-data');
  if (!dataEl) return;
  let records;
  try { records = JSON.parse(dataEl.textContent); }
  catch (error) { console.error('Publication data could not be read.', error); return; }
  if (!Array.isArray(records) || !records.length) return;

  const form = document.getElementById('pub-filters');
  const search = document.getElementById('pub-search');
  const year = document.getElementById('pub-year');
  const type = document.getElementById('pub-type');
  const sort = document.getElementById('pub-sort');
  const results = document.getElementById('pub-results-count');
  const groupContainer = document.getElementById('pub-groups');
  const exportButton = document.getElementById('pub-export-filtered');
  const chips = document.getElementById('pub-year-chips');
  const noResults = document.getElementById('pub-no-results');
  if (![form, search, year, type, sort, results, groupContainer, exportButton, chips, noResults].every(Boolean)) return;

  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const normalized = new Map(records.map(p => [p.id, normalize([p.title, p.authors.join(' '), p.venue, p.publisher, p.doi, p.type_label, p.year].join(' '))]));
  const cards = new Map(records.map(p => [p.id, document.getElementById(p.id)]));
  const groups = Array.from(groupContainer.querySelectorAll('[data-year-group]'));
  let visible = records.slice();

  function update() {
    const words = normalize(search.value).trim().split(/\s+/).filter(Boolean);
    visible = records.filter(p =>
      (year.value === 'all' || String(p.year) === year.value) &&
      (type.value === 'all' || p.type === type.value) &&
      words.every(word => normalized.get(p.id).includes(word))
    );
    const direction = sort.value === 'asc' ? 1 : -1;
    visible.sort((a, b) => direction * (a.year - b.year) || a.index - b.index);
    const ids = new Set(visible.map(p => p.id));
    cards.forEach((node, id) => { if (node) node.hidden = !ids.has(id); });
    groups.sort((a, b) => direction * (Number(a.dataset.yearGroup) - Number(b.dataset.yearGroup)));
    groups.forEach(group => {
      const count = visible.filter(p => p.year === Number(group.dataset.yearGroup)).length;
      group.hidden = count === 0;
      group.querySelector('.year-count').textContent = `${count} ${count === 1 ? 'publication' : 'publications'}`;
      groupContainer.appendChild(group);
    });
    results.textContent = visible.length === records.length
      ? `Showing ${records.length} publications`
      : `Showing ${visible.length} of ${records.length} publications`;
    noResults.hidden = visible.length !== 0;
    exportButton.disabled = visible.length === 0;
    exportButton.setAttribute('aria-label', `Download ${visible.length} matching publications as CSV`);
    chips.querySelectorAll('[data-year-filter]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.yearFilter === year.value));
    });
  }

  function reset() {
    search.value = '';
    year.value = 'all';
    type.value = 'all';
    sort.value = 'desc';
    update();
  }

  function csvCell(value) {
    let text = String(value ?? '');
    // Quote every cell and neutralize spreadsheet formula prefixes.
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function citationCsvValues(p) {
    const card = cards.get(p.id);
    const badge = card?.querySelector('.pub-citation-openalex');
    const checkDate = document.getElementById('oa-updated')?.getAttribute('datetime') || '';
    // UI and CSV use exactly the same verified, DOI-matched OpenAlex figure.
    const gsBadge = card?.querySelector('.pub-citation-scholar[data-gs-cites]');
    const gsValue = gsBadge?.dataset.gsCites ?? '';
    const gsDate = gsBadge?.dataset.gsChecked ?? (gsValue !== '' ? '2026-10-29' : '');
    return [badge?.dataset.cites ?? '', badge?.href ?? '', checkDate, gsValue, gsDate];
  }
  function exportResults() {
    if (!visible.length) return;
    const header = ['Year','Type','Title','Authors','Venue','Publisher','Volume','Issue','Pages or article number','DOI','DOI URL','Publication URL','Publication date','Conference year','Source','Verification note','Bibliographic note','OpenAlex citations','OpenAlex work URL','OpenAlex last checked','Google Scholar citations (verified)','Google Scholar last checked'];
    const rows = visible.map(p => [p.year,p.type_label,p.title,p.authors.join('; '),p.venue,p.publisher,p.volume,p.issue,p.pages,p.doi,p.doi_url,p.url,p.publication_date,p.event_year,p.source,p.verification,p.note, ...citationCsvValues(p)]);
    const content = '\uFEFF' + [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
    const blob = new Blob([content], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = visible.length === records.length ? 'Serban-Teodor_Nicolescu_Publications.csv' : 'Serban-Teodor_Nicolescu_Publications_filtered.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('reset', event => {event.preventDefault(); reset();});
  search.addEventListener('input', update);
  year.addEventListener('change', update);
  type.addEventListener('change', update);
  sort.addEventListener('change', update);
  chips.addEventListener('click', event => {
    const button = event.target.closest('[data-year-filter]');
    if (!button) return;
    year.value = button.dataset.yearFilter;
    update();
  });
  document.getElementById('pub-clear-empty').addEventListener('click', () => {reset(); search.focus();});
  exportButton.addEventListener('click', exportResults);
  form.hidden = false;
  chips.hidden = false;
  exportButton.hidden = false;
  document.getElementById('pub-sort-wrap').hidden = false;
  update();
})();
