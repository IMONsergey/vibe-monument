#!/usr/bin/env python3
"""Optional local visual smoke test. Requires Playwright Python + Chromium."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def snapshot_html() -> str:
    css = "\n".join(p.read_text() for p in sorted((ROOT / 'src/styles').glob('*.css')))
    icons = (ROOT / 'src/icons.js').read_text().replace('export const icons', 'const icons')
    mock = (ROOT / 'src/mock-data.js').read_text()
    for name in ('projects', 'tasks', 'activity', 'fileTree', 'evidence'):
        mock = mock.replace(f'export const {name}', f'const {name}')
    state = (ROOT / 'src/state.js').read_text().replace('export const state', 'const state').replace('export function setState', 'function setState').replace('export function subscribe', 'function subscribe')
    module_paths = [
        ROOT / 'src/utils.js',
        ROOT / 'src/views/palette.js',
        ROOT / 'src/views/sidebar.js',
        ROOT / 'src/views/center.js',
        ROOT / 'src/views/agent.js',
        ROOT / 'src/main.js',
    ]
    modules = []
    for path in module_paths:
        body = '\n'.join(line for line in path.read_text().splitlines() if not line.startswith('import '))
        body = body.replace('export function ', 'function ').replace('export const ', 'const ')
        modules.append(body)
    script = '\n'.join([icons, mock, state, *modules])
    return f'<!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head><body><div id="app"></div><script type="module">{script}</script></body></html>'


def main():
    output = ROOT / 'artifacts'
    output.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        page.set_content(snapshot_html(), wait_until='load')
        assert page.locator('.task').count() == 4
        assert page.locator('.agent-panel').count() == 1
        assert page.locator('.canvas-frame').count() == 1
        assert 'bottom-closed' in page.locator('.main').get_attribute('class')
        page.locator('[data-mode="code"]').click()
        assert page.locator('.code-view.visible').count() == 1
        page.locator('[data-mode="preview"]').click()
        page.locator('[data-viewport="mobile"]').click()
        assert 'mobile' in page.locator('.canvas-frame').get_attribute('class')
        page.locator('[data-open-bottom]').click()
        assert page.locator('.bottom-panel').is_visible()
        page.locator('[data-bottom="evidence"]').click()
        assert page.locator('.evidence-card').count() == 6
        page.locator('[data-close-bottom]').click()
        page.keyboard.press('Meta+K')
        assert page.locator('.palette').count() == 1
        page.locator('.palette-input input').fill('inspect')
        assert page.locator('[data-command="inspect"]').count() == 1
        page.locator('[data-command="inspect"]').click()
        page.locator('[data-inspect-target]').dispatch_event('click')
        assert 'Hero.tsx:24' in page.locator('.composer textarea').input_value()
        page.locator('[data-mode="preview"]').click()
        page.locator('[data-viewport="desktop"]').click()
        page.screenshot(path=str(output / 'desktop-1440.png'))
        browser.close()
    print('Monument UI smoke: PASS')


if __name__ == '__main__':
    main()
