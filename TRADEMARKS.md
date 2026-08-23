# Trademarks

"Hyperscale" and "ADL" are trademarks of Hyperscale LLC.

The AGPL covers the code in this repository and nothing else. It grants no
right to use the Hyperscale name, the Hyperscale logo, or any other Hyperscale
mark, and it never mentions them: a copyright license says nothing about
trademarks either way.

What that means in practice:

- **Yes**, you may say your adapter is written in ADL, or that it passes
  Hyperscale conformance. Accurate, factual references to the project are fine.
- **No**, you may not name your package, product, service, or organization in a
  way that suggests Hyperscale LLC published it or endorses it, and you may not
  use the marks in a logo, domain, or app icon of your own.

## Claiming compatibility

An independent implementation of ADL or of its conformance
runner may say it "passes the Hyperscale ADL conformance suite version X"
only while it passes the published cases for that version, unmodified.
[`conformance/cases.json`](conformance/cases.json) is the whole test: no
skipped case, no edited expectation, no local fork of the fixtures.

That claim is a statement about your implementation, so keep the marks out of
its name and off its logo, and do not present it as endorsement or
certification by Hyperscale LLC. We certify nothing; the suite does.

Forks stay welcome. Rename the package and drop the marks.
