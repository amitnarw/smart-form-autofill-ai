import { isVisibleDeep, walkTree } from './dom-utils';
import { INPUT_SELECTORS } from './constants';

export function collectCandidates(): (HTMLInputElement | HTMLTextAreaElement)[] {
  const results = new Set<HTMLInputElement | HTMLTextAreaElement>();

  function tryAddElement(el: Element) {
    const parentDiv = el.closest('div[id*="byteseal" i]');
    if (parentDiv) return;

    const tag = el.tagName.toLowerCase();
    if (tag === 'input') {
      const input = el as HTMLInputElement;
      const inputType = (input.getAttribute('type') || '').toLowerCase();
      const excludedTypes = ['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image', 'hidden', 'range', 'color'];
      if (!excludedTypes.includes(inputType)) {
        results.add(input);
      }
    } else if (tag === 'textarea') {
      results.add(el as HTMLTextAreaElement);
    }
  }

  document.querySelectorAll(INPUT_SELECTORS).forEach(tryAddElement);

  for (const el of walkTree(document)) {
    const host = el as HTMLElement;
    if (host.shadowRoot) {
      host.shadowRoot.querySelectorAll(INPUT_SELECTORS).forEach(tryAddElement);
    }
  }

  return Array.from(results).filter(isVisibleDeep);
}

export function collectIframeCandidates(): (HTMLInputElement | HTMLTextAreaElement)[] {
  const results: (HTMLInputElement | HTMLTextAreaElement)[] = [];
  
  function findInFrames(win: Window) {
    for (let i = 0; i < win.frames.length; i++) {
      const frameWin = win.frames[i];
      try {
        const doc = frameWin.document;
        const inputs = doc.querySelectorAll(INPUT_SELECTORS);
        inputs.forEach(el => {
            if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                if (isVisibleDeep(el)) results.push(el);
            }
        });
        findInFrames(frameWin);
      } catch (e) {
        // Cross-origin frame access denied
      }
    }
  }

  findInFrames(window);
  return results;
}
