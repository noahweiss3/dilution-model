import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];out=root/'artifacts'
base=os.environ.get('PROTOTYPE_URL','http://localhost:5173')
report={'flow':[],'accessibility':[],'layout':[],'errors':[]}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000})
    if os.environ.get('PROTOTYPE_ACCESS_URL'):page.goto(os.environ['PROTOTYPE_ACCESS_URL'],wait_until='networkidle')
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    for concept in ['review','workbench','studio','terminal']:
        page.goto(f'{base}/?concept={concept}',wait_until='networkidle')
        page.get_by_role('button',name='After Series A',exact=True).click()
        assert '51.84%' in page.locator('#main').inner_text()
        page.get_by_role('button',name='After Seed',exact=True).click()
        page.get_by_role('combobox',name='Scenario',exact=True).select_option('efficient')
        assert '69.43%' in page.locator('#main').inner_text()
        page.get_by_role('spinbutton',name='Pre-money valuation').fill('20')
        assert page.get_by_role('button',name='Update example').is_enabled()
        page.get_by_role('button',name='Update example').click()
        assert '70.43%' in page.locator('#main').inner_text()
        page.get_by_role('spinbutton',name='New investment').fill('0')
        page.get_by_role('button',name='Update example').click()
        assert page.get_by_role('alert').is_visible()
        page.get_by_role('button',name='Reset',exact=True).click()
        assert page.get_by_role('spinbutton',name='New investment').input_value()=='4'
        assert page.get_by_role('button',name='Update example').is_disabled()
        page.get_by_text('How this example works',exact=False).first.click()
        assert page.locator('details.explanation').get_attribute('open') is not None
        if concept=='workbench':
            page.get_by_role('button',name='02 Financing path').click()
            assert page.locator('.trajectory').is_visible()
        if concept=='terminal':
            page.get_by_role('button',name='02 / Value waterfall').click()
            assert page.locator('.waterfall-chart').is_visible()
        page.get_by_role('button',name='Choose this direction',exact=True).click()
        page.get_by_role('link',name='All directions',exact=False).first.click()
        assert dict(review='Financial Review',workbench='Analyst Workbench',studio='Scenario Studio',terminal='Capital Terminal')[concept] in page.locator('.favorite-banner').inner_text()
        page.goto(f'{base}/?concept={concept}',wait_until='networkidle')
        page.get_by_role('button',name='System & components',exact=True).click()
        page.get_by_role('button',name='Apply changes',exact=False).click()
        assert 'Example updated' in page.locator('.notice').first.inner_text()
        report['flow'].append({'concept':concept,'stages':True,'preset':True,'validInput':True,'invalidInput':True,'reset':True,'explanation':True,'favoriteNavigation':True,'specimenFeedback':True})
    for width in [320,390,768,1024,1440]:
        page.set_viewport_size({'width':width,'height':900})
        for path in ['', '?compare=review,terminal']+[f'?concept={c}' for c in ['review','workbench','studio','terminal']]:
            page.goto(base+'/'+path,wait_until='networkidle')
            overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth')
            report['layout'].append({'width':width,'path':path,'overflow':overflow})
            if path.startswith('?concept='):
                page.get_by_role('button',name='System & components',exact=True).click()
                report['layout'].append({'width':width,'path':path+'&system','overflow':page.evaluate('document.documentElement.scrollWidth > innerWidth')})
    for width in [390,1440]:
        page.set_viewport_size({'width':width,'height':1000})
        for path in ['']+[f'?concept={c}' for c in ['review','workbench','studio','terminal']]:
            page.goto(base+'/'+path,wait_until='networkidle')
            for view in (['app','system'] if path else ['gallery']):
                if view=='system':page.get_by_role('button',name='System & components',exact=True).click()
                page.add_script_tag(path='/tmp/dilution-qa-tools/node_modules/axe-core/axe.min.js')
                result=page.evaluate("async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({html:n.html,summary:n.failureSummary}))}))}")
                report['accessibility'].append({'width':width,'path':path,'view':view,'violations':result})
        page.goto(base+'/?concept=terminal',wait_until='networkidle')
        page.keyboard.press('Tab')
        assert page.get_by_role('link',name='Skip to content').evaluate('(e)=>e===document.activeElement')
        page.keyboard.press('Tab')
        focus=page.evaluate("({tag:document.activeElement.tagName,outline:getComputedStyle(document.activeElement).outlineStyle})")
        assert focus['outline']!='none'
    page.goto(base+'/?compare=review,terminal',wait_until='networkidle')
    assert page.locator('iframe').count()==2
    for frame in page.frames[1:]:
        frame.get_by_role('button',name='After Series A',exact=True).click()
        assert '51.84%' in frame.locator('#main').inner_text()
    report['compareFrames']=True
    browser.close()
(out/'verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'flow':report['flow'],'layoutFailures':[x for x in report['layout'] if x['overflow']],'accessibilityFailures':[x for x in report['accessibility'] if x['violations']],'errors':report['errors'],'compareFrames':report.get('compareFrames')},indent=2))
