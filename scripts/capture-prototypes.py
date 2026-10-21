import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
out=root/'artifacts';out.mkdir(exist_ok=True)
base=os.environ.get('PROTOTYPE_URL','http://localhost:5173')
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    for width,height,label in [(1440,1050,'desktop'),(390,844,'mobile')]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
        if os.environ.get('PROTOTYPE_ACCESS_URL'):page.goto(os.environ['PROTOTYPE_ACCESS_URL'],wait_until='networkidle')
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        for concept in ['review','workbench','studio','terminal']:
            page.goto(f'{base}/?concept={concept}',wait_until='networkidle')
            page.evaluate('document.fonts.ready')
            page.screenshot(path=str(out/f'{concept}-{label}.png'),full_page=True)
            results.append({'concept':concept,'viewport':label,'width':width,'documentWidth':page.evaluate('document.documentElement.scrollWidth'),'fonts':page.evaluate("[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family)"),'errors':errors[:]})
            page.get_by_role('button',name='System & components',exact=True).click()
            page.screenshot(path=str(out/f'{concept}-system-{label}.png'),full_page=True)
        page.goto(base,wait_until='networkidle');page.evaluate('document.fonts.ready');page.screenshot(path=str(out/f'gallery-{label}.png'),full_page=True)
        page.goto(f'{base}/?compare=review,terminal',wait_until='networkidle');page.screenshot(path=str(out/f'comparison-{label}.png'),full_page=True)
        page.close()
    browser.close()
(out/'capture-results.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))
