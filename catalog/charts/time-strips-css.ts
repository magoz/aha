import { CHART_CSS } from '../shared/chart-css.js'

/**
 * Time-strips styles. Rows default to ink; the blue lane covers rain and
 * water rows. Warning red is never used here.
 */

export const TIME_STRIPS_CSS = `${CHART_CSS}
.aha-strips .ts-blue { stroke: #2f6b9a; }
.aha-strips rect.bar.ts-blue { fill: #2f6b9a; }
.aha-strips rect.bar.ls-0, .aha-strips rect.bar.ls-1, .aha-strips rect.bar.ls-2, .aha-strips rect.bar.ls-3 { fill: var(--ink); opacity: 0.7; }
.aha-strips path.band.ts-blue { fill: #2f6b9a; }
.aha-strips path.band.ls-0, .aha-strips path.band.ls-1, .aha-strips path.band.ls-2, .aha-strips path.band.ls-3 { fill: var(--ink); }
@media (prefers-color-scheme: dark) {
  .aha-strips .ts-blue { stroke: #7fb3d5; }
  .aha-strips rect.bar.ts-blue { fill: #7fb3d5; }
  .aha-strips path.band.ts-blue { fill: #7fb3d5; }
}
`
