/**
 * DOM Utilities for Field Discovery and Visibility Check
 */

export function hasSize(rect: DOMRect): boolean {
  return rect && rect.width > 0 && rect.height > 0;
}

export function isClipped(style: CSSStyleDeclaration): boolean {
  const cp = (style as any).clipPath || (style as any).webkitClipPath || '';
  const clip = style.clip || '';
  return (cp && cp !== 'none') || (clip && clip !== 'auto');
}

export function isZeroScale(style: CSSStyleDeclaration): boolean {
  const tr = style.transform || style.webkitTransform || '';
  if (!tr || tr === 'none') return false;
  if (/scale\(\s*0[),]/.test(tr)) return true;
  const m = tr.match(/matrix\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
    if (parts.length >= 4 && (parts[0] === 0 || parts[3] === 0)) return true;
  }
  return false;
}

export function isVisibleDeep(elem: Element): boolean {
  if (!(elem instanceof Element)) return false;

  if (elem.hasAttribute('hidden') || elem.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  const rect = elem.getBoundingClientRect();
  const style = window.getComputedStyle(elem);

  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.visibility === 'collapse' ||
    parseFloat(style.opacity) === 0 ||
    isZeroScale(style) ||
    !hasSize(rect)
  ) {
    return false;
  }

  if (isClipped(style)) return false;

  let node = elem.parentElement;
  while (node && node !== document.documentElement) {
    if (node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true') {
      return false;
    }

    const s = window.getComputedStyle(node);
    if (
      s.display === 'none' ||
      s.visibility === 'hidden' ||
      s.visibility === 'collapse' ||
      parseFloat(s.opacity) === 0 ||
      isZeroScale(s) ||
      isClipped(s)
    ) {
      return false;
    }

    const isModal = node.matches?.('[role="dialog"], [role="alertdialog"], .modal, .dialog, dialog, [class*="modal"], [class*="dialog"]');
    if (isModal) {
      const modalStyle = window.getComputedStyle(node);
      const modalRect = node.getBoundingClientRect();
      if (
        modalStyle.display === 'none' ||
        modalStyle.visibility === 'hidden' ||
        parseFloat(modalStyle.opacity) === 0 ||
        !hasSize(modalRect)
      ) {
        return false;
      }
    }
    node = node.parentElement;
  }
  return true;
}

export function* walkTree(root: Node): Generator<Element> {
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let curr = tw.currentNode as Element | null;
  while (curr) {
    yield curr;
    if ((curr as HTMLElement).shadowRoot) yield* walkTree((curr as HTMLElement).shadowRoot!);
    curr = tw.nextNode() as Element | null;
  }
}

export function getLabelText(input: HTMLElement): string {
  if (input.id) {
    const lab = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
    if (lab && isVisibleDeep(lab)) return (lab as HTMLElement).innerText.trim();
  }
  const wrapper = input.closest('label');
  if (wrapper && isVisibleDeep(wrapper)) {
    const clone = wrapper.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input,textarea,select').forEach((n) => n.remove());
    if (clone.innerText.trim()) return clone.innerText.trim();
  }
  return getAriaLabel(input);
}

export function getAriaLabel(input: HTMLElement): string {
  const ariaLabel = input.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();
  const labelledBy = input.getAttribute('aria-labelledby');
  if (labelledBy) {
    return labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .map((el) => (el && isVisibleDeep(el!) ? (el as HTMLElement).innerText.trim() : ''))
      .filter(Boolean)
      .join(' ');
  }
  return '';
}
