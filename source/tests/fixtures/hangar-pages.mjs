export function hangarPageHtml(source, page) {
  if (Number(page) !== 15) return source;
  return source
    .replaceAll('Phoenix Insignia Display', 'Gladius - Foundation Festival Paint')
    .replace('value="101"', 'value="1501"');
}
