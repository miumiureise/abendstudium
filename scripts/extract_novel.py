"""Extract this manuscript without rewriting source text; stdlib only.
Usage: python3 scripts/extract_novel.py /path/to/manuscript.docx
Source paragraph indexes are 1-based OOXML paragraph positions, including blanks.
"""
import sys,re,json,csv,hashlib
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from collections import Counter
source=Path(sys.argv[1]); out=Path(__file__).resolve().parents[1]/'data'
w='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
with ZipFile(source) as z:root=ET.fromstring(z.read('word/document.xml'))
paras=[]
for index,p in enumerate(root.iter(w+'p'),1):
    # OOXML runs split styling, not sentences; page breaks do not add text.
    text=''.join(n.text or '' for n in p.iter(w+'t'))
    if text.strip():paras.append({'paragraph':index,'text':text})
JP=re.compile(r'[\u3040-\u30ff\u3400-\u9fff]')
def japanese(s):return bool(JP.search(s))
records=[];notes=[];chapters=[];audit=[];issues=[];chapter=None;kind='story';section={};heading='';seq=0;i=0

def account(p,role,**extra):audit.append({**p,'role':role,**extra})
while i<len(paras):
    p=paras[i];t=p['text'];n=paras[i+1] if i+1<len(paras) else None
    m=re.fullmatch(r'Kapitel (\d+): (.+)',t)
    if m:
        assert n and n['text'].startswith('第'+m[1]+'章')
        chapter={'chapter':int(m[1]),'title_de':m[2],'title_ja':re.sub(r'^第\d+章[\s　]*','',n['text']),'grammar_tags':'','sections':[]};chapters.append(chapter)
        account(p,'chapter_title_de');account(n,'chapter_title_ja');kind='story';section={};heading='';i+=2;continue
    if chapter is None:account(p,'front_matter');i+=1;continue
    if t.startswith('重点文法：'):
        chapter['grammar_tags']=t.removeprefix('重点文法：');account(p,'chapter_grammar');i+=1;continue
    if re.fullmatch(r'[ー・－—\-\s]+',t):account(p,'separator');i+=1;continue
    m=re.fullmatch(r'(\d+)\. (.+)',t)
    if kind=='story' and m and not japanese(t):
        assert n and japanese(n['text'])
        section={'section':m[1],'title_de':m[2],'title_ja':n['text']};chapter['sections'].append(section)
        account(p,'section_title_de');account(n,'section_title_ja');i+=2;continue
    if t=='重要表現':kind='expression';section={};heading=t;account(p,'type_heading');i+=1;continue
    if t.startswith('文法ポイント'):
        kind='grammar_example';section={};heading=t;account(p,'grammar_heading');notes.append({'chapter':chapter['chapter'],'heading':heading,'paragraph':p['paragraph'],'text':t});i+=1;continue
    if t.startswith('音読用・重要'):
        kind='reading_practice';section={};heading=t;account(p,'type_heading');i+=1;continue
    # Exact adjacent language pair. German-only headings and unpaired paradigms
    # are explicitly retained as grammar notes, never paired with the next German line.
    if not japanese(t) and n and japanese(n['text']):
        seq+=1
        record={'id':f'mythos-b1-p{p["paragraph"]:04d}', 'chapter':chapter['chapter'],
        'chapter_title_de':chapter['title_de'],'chapter_title_ja':chapter['title_ja'],
        'section':section.get('section',''),'section_title_de':section.get('title_de',''),'section_title_ja':section.get('title_ja',''),
        'sequence':seq,'type':kind,'german':t,'japanese':n['text'],'grammar_tags':chapter['grammar_tags'],
        'grammar_heading':heading if kind=='grammar_example' else '', 'source_paragraph_de':p['paragraph'],'source_paragraph_ja':n['paragraph'],
        'level':'B1','category':f'小説・第{chapter["chapter"]}章','audio':''}
        records.append(record);account(p,'german',record_id=record['id']);account(n,'japanese',record_id=record['id']);i+=2;continue
    if kind=='grammar_example':
        notes.append({'chapter':chapter['chapter'],'heading':heading,'paragraph':p['paragraph'],'text':t});account(p,'grammar_note')
    else:
        issues.append({'paragraph':p['paragraph'],'text':t,'reason':'対訳未確定'});account(p,'unresolved')
    i+=1
assert len(chapters)==5
assert len(audit)==len(paras) and len({p['paragraph'] for p in audit})==len(paras)
assert len({r['id'] for r in records})==len(records)
# Exhaustive text equality check: every extracted side matches its source paragraph.
by_p={p['paragraph']:p['text'] for p in paras}
for r in records:
    assert r['german']==by_p[r['source_paragraph_de']] and r['japanese']==by_p[r['source_paragraph_ja']]
    assert not japanese(r['german']) and japanese(r['japanese'])
manifest={'id':'mythos-novel-b1','title':'中身で選んだ夫が、顔まで理想だった件','author':'春日リューリック未雨','chapters':chapters,'grammar_notes':notes}
out.mkdir(exist_ok=True)
with (out/'mythos_novel_b1.csv').open('w',encoding='utf-8',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=list(records[0]));writer.writeheader();writer.writerows(records)
(out/'mythos_novel_b1.json').write_text(json.dumps({**manifest,'records':records},ensure_ascii=False,indent=2),encoding='utf-8')
report={'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'nonempty_paragraphs':len(paras),'records':len(records),'counts':{str(c['chapter']):dict(Counter(r['type'] for r in records if r['chapter']==c['chapter'])) for c in chapters},'issues':issues,'paragraph_audit':audit}
(out/'extraction-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='paragraph_audit'},ensure_ascii=False,indent=2))
