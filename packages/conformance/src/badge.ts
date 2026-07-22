/**
 * Generate a conformance badge (SVG) from suite results.
 * Projects that pass all cases can display this as proof of honesty.
 */
export function badge(result: { passed: number; failed: number }): string {
  const total = result.passed + result.failed;
  const pass = result.failed === 0;
  const label = pass ? "sourced-conformant" : "non-conformant";
  const color = pass ? "#2d8f4e" : "#d4111e";
  const score = `${result.passed}/${total}`;
  const labelWidth = 148;
  const scoreWidth = 42;
  const width = labelWidth + scoreWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${label}: ${score}">
  <title>${label}: ${score}</title>
  <linearGradient id="s" x2="1" x1="0">
    <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
    <stop offset=".1" stop-color="#aaa" stop-opacity=".1"/>
    <stop offset=".9" stop-opacity=".3"/>
    <stop offset="1" stop-opacity=".5"/>
  </linearGradient>
  <clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${scoreWidth}" height="20" fill="${color}"/>
    <rect width="${width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + scoreWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${score}</text>
    <text x="${labelWidth + scoreWidth / 2}" y="14">${score}</text>
  </g>
</svg>`;
}

/**
 * Compute a conformance score object for programmatic use.
 */
export function score(result: { passed: number; failed: number; results: { pass: boolean; id: string }[] }): {
  conformant: boolean;
  passed: number;
  failed: number;
  total: number;
  failedCases: string[];
} {
  return {
    conformant: result.failed === 0,
    passed: result.passed,
    failed: result.failed,
    total: result.passed + result.failed,
    failedCases: result.results.filter((r) => !r.pass).map((r) => r.id),
  };
}
