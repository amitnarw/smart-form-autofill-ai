import { ROLE_KEYWORDS } from '../constants';

export function classifyRole(input: HTMLInputElement | HTMLTextAreaElement, label: string): string {
  const textToCheck = [
    input.getAttribute('type'),
    input.name,
    input.id,
    input.getAttribute('placeholder'),
    label
  ].join(' ').toLowerCase();

  for (const [role, keywords] of Object.entries(ROLE_KEYWORDS)) {
    if (keywords.some(k => textToCheck.includes(k))) {
      return role;
    }
  }

  return 'unknown';
}

export function getFormSignature(): string {
  const inputs = document.querySelectorAll('input, textarea');
  const sigs: string[] = [];
  inputs.forEach(el => {
    const input = el as HTMLElement;
    const type = input.getAttribute('type') || input.tagName.toLowerCase();
    const name = input.getAttribute('name') || '';
    const id = input.getAttribute('id') || '';
    sigs.push(`${type}:${name}:${id}`);
  });
  return sigs.sort().join('|');
}
