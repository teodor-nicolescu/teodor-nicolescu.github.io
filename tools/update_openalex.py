#!/usr/bin/env python3
"""Refresh citation snapshot without touching user-curated publication metadata.

Uses the official OpenAlex API. A free key is OPTIONAL for this low-volume job;
if supplied, it must come from the GitHub Actions secret OPENALEX_API_KEY.
Never display an API key or put it in client-side code.
"""
from __future__ import annotations

import datetime as dt
import json
import os
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
AUTHOR = 'A5020131961'
ORCID = '0009-0004-1196-2069'
SNAPSHOT = ROOT / 'assets' / 'openalex-citations.json'
PAGE = ROOT / 'publications.html'
API = 'https://api.openalex.org'


def request_json(route: str, params: dict[str, str] | None = None) -> dict:
    params = dict(params or {})
    key = os.getenv('OPENALEX_API_KEY', '').strip()
    if key:
        params['api_key'] = key
    url = f'{API}{route}' + (f'?{urlencode(params)}' if params else '')
    # No credentials are logged, even on HTTP error.
    for attempt in range(4):
        try:
            headers = {'User-Agent': 'TeodorAcademicWebsite-CitationUpdater/1.0', 'Accept': 'application/json'}
            with urlopen(Request(url, headers=headers), timeout=30) as response:
                return json.load(response)
        except HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504) or attempt == 3:
                raise RuntimeError(f'OpenAlex API error: HTTP {exc.code}') from None
        except (URLError, TimeoutError) as exc:
            if attempt == 3:
                raise RuntimeError('OpenAlex API request failed or timed out') from exc
        time.sleep(2 ** attempt)
    raise RuntimeError('OpenAlex API request failed')


def curated_records() -> list[dict]:
    text = PAGE.read_text(encoding='utf-8')
    block = re.search(r'<script\b[^>]*\bid="publication-data"[^>]*>(.*?)</script>', text, re.S)
    if not block:
        raise RuntimeError('Cannot find DOI whitelist in Publications page')
    records = json.loads(block.group(1))
    if not isinstance(records, list) or not records:
        raise RuntimeError('Empty curated publication list')
    return records


def refresh() -> dict:
    selected=curated_records()
    dois={str(p.get('doi','')).strip().lower() for p in selected}
    if len(dois)!=len(selected) or any(not x.startswith('10.') for x in dois):
        raise RuntimeError('Each selected publication needs a unique DOI')
    author=request_json(f'/authors/{AUTHOR}', {'select':'id,orcid,works_count,cited_by_count,summary_stats'})
    if str(author.get('id','')).split('/')[-1].upper()!=AUTHOR:
        raise RuntimeError('Author ID mismatch')
    auth_orcid=str(author.get('orcid') or '').split('/')[-1]
    if auth_orcid and auth_orcid!=ORCID:
        raise RuntimeError('ORCID mismatch - manual identity review required')
    # Batching DOI lookups is robust to author disambiguation differences.
    # The result may be partial: missing works stay unknown, never 0.
    works_response=request_json('/works', {
        'filter':'doi:'+'|'.join('https://doi.org/'+x for x in sorted(dois)),
        'per_page':'100','select':'id,doi,cited_by_count,authorships'
    })
    meta=works_response.get('meta') or {}
    if meta.get('count',10**9)>len(works_response.get('results',[])):
        raise RuntimeError('Incomplete OpenAlex DOI batch')
    snapshot=json.loads(SNAPSHOT.read_text(encoding='utf-8'))
    previous=snapshot.get('works') or {}
    works=dict(previous)
    found=0
    for w in works_response.get('results',[]):
        doi=str(w.get('doi') or '').removeprefix('https://doi.org/').lower().strip()
        if doi not in dois:continue
        wid=str(w.get('id','')).split('/')[-1]
        n=w.get('cited_by_count')
        if not isinstance(n,int) or n<0 or not re.fullmatch(r'W\d+',wid):continue
        # Refuse accidentally matched works with different authors if metadata are available.
        auths=w.get('authorships') or []
        if auths and not any(str((a.get('author') or {}).get('id','')).split('/')[-1].upper()==AUTHOR for a in auths):
            print(f'NOTE: DOI {doi} not associated with chosen author in OpenAlex; retaining old value.',file=sys.stderr)
            continue
        works[doi]={'openalex_id':wid,'openalex_url':f'https://openalex.org/works/{wid}','cited_by_count':n}
        found+=1
    stats=author.get('summary_stats') or {}
    profile={'works_count':author.get('works_count'),'cited_by_count':author.get('cited_by_count'),
             'h_index':stats.get('h_index'),'i10_index':stats.get('i10_index')}
    if not all(isinstance(n,int) and n>=0 for n in profile.values()):
        raise RuntimeError('Profile metrics missing; retain last snapshot')
    if not found:
        raise RuntimeError('No DOI was successfully refreshed; retain last snapshot')
    return {'schema_version':1,'source':'OpenAlex','author_id':AUTHOR,
            'author_url':f'https://openalex.org/authors/{AUTHOR}',
            'orcid':ORCID,'updated_at':dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d'),
            'profile':profile,'selected_count':len(dois),
            'selected_citations':sum(v['cited_by_count'] for k,v in works.items() if k in dois),
            'verified_doi_count':len([k for k in works if k in dois]),
            'evidence':'Updated through OpenAlex API; missing DOI records preserved from verified snapshot, not filled with zero.',
            'works':dict(sorted((k,v) for k,v in works.items() if k in dois))}

def main():
    try:
        latest = refresh()
    except Exception as exc:
        print(f'WARNING: {exc}. Last verified citation values retained.', file=sys.stderr)
        return 0
    tmp = SNAPSHOT.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(latest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    tmp.replace(SNAPSHOT)
    print(f'OpenAlex refreshed: {latest["profile"]["cited_by_count"]} profile citations; '
          f'{latest["selected_citations"]} citations across {latest["selected_count"]} selected publications.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
