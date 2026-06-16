const START = "<!-- METRICS:START -->";
const END = "<!-- METRICS:END -->";

export function replaceBlock(markdown: string, block: string): string {
  const wrapped = `${START}\n${block}\n${END}`;
  const startIdx = markdown.indexOf(START);
  const endIdx = markdown.indexOf(END);
  if (startIdx === -1 || endIdx === -1) {
    const sep = markdown.endsWith("\n") ? "\n" : "\n\n";
    return `${markdown}${sep}${wrapped}\n`;
  }
  return markdown.slice(0, startIdx) + wrapped + markdown.slice(endIdx + END.length);
}

export function picture(lightSrc: string, darkSrc: string, alt: string, width: number): string {
  return `<picture><source media="(prefers-color-scheme: dark)" srcset="${darkSrc}"><img src="${lightSrc}" alt="${alt}" width="${width}"></picture>`;
}

export function linkedPicture(href: string, lightSrc: string, darkSrc: string, alt: string, width: number): string {
  return `<a href="${href}">${picture(lightSrc, darkSrc, alt, width)}</a>`;
}
