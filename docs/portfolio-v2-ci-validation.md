# Portfolio v2 CI validation

This branch intentionally changes no application behavior beyond `main`.

Its only purpose is to trigger the repository's pull-request CI against the current `main` tree after the 2026-08-23 recruiter-facing portfolio rewrite. The validation target includes:

- lint;
- production build;
- data/provenance contracts;
- rendered-site checks;
- ICP footer checks;
- mobile layout probes for both `/` and `/models` at 320 / 390 / 430px.

Close this PR after CI is inspected; this marker does not need to merge.
