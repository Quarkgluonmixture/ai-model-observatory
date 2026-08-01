// A promotional price is a number with an expiry date on it. The catalog quotes one price per
// model and has no way to say "until August", so an introductory rate goes stale silently — the
// dashboard keeps showing it, every check still passes, and nobody finds out until a reader
// compares it to the vendor page.
//
// Batch metas record the terms under `priceTerms`. This reads them back and fails once a quoted
// price has outlived its published end date, and warns while one is close.
//
//   node --experimental-strip-types scripts/check-price-terms.mjs

import { readdirSync, readFileSync } from "node:fs";
import { MODELS } from "../app/model-data.ts";

const SOURCE_DIR = "data/sources";
const WARN_WITHIN_DAYS = 45;
const DAY_MS = 24 * 60 * 60 * 1000;

const today = new Date(new Date().toISOString().slice(0, 10));
const models = new Map(MODELS.map((model) => [model.id, model]));

const errors = [];
const warnings = [];
const notes = [];
let checked = 0;

for (const file of readdirSync(SOURCE_DIR).filter((name) => name.endsWith(".meta.json"))) {
  const meta = JSON.parse(readFileSync(`${SOURCE_DIR}/${file}`, "utf8"));
  for (const term of meta.priceTerms ?? []) {
    checked += 1;
    const where = `${file} · ${term.modelId}`;
    const model = models.get(term.modelId);
    if (!model) {
      errors.push(`${where}: price term references a model that is not in the catalog`);
      continue;
    }

    const { input, output } = model.price;
    const quotes = (price) => price.input === input && price.output === output;
    const daysLeft = Math.round((new Date(term.endsOn) - today) / DAY_MS);

    if (daysLeft >= 0) {
      if (!quotes(term.quoted)) {
        // Not necessarily wrong — but the term describes a price the catalog no longer shows,
        // so one of the two has moved and the record should say which.
        notes.push(
          `${where}: catalog shows $${input}/$${output}, term describes $${term.quoted.input}/$${term.quoted.output} — update or retire the term`,
        );
      } else if (daysLeft <= WARN_WITHIN_DAYS) {
        warnings.push(
          `${where}: $${input}/$${output} ends in ${daysLeft} day(s) on ${term.endsOn}, reverting to $${term.revertsTo.input}/$${term.revertsTo.output} — ${term.source}`,
        );
      }
      continue;
    }

    if (quotes(term.quoted)) {
      errors.push(
        `${where}: promotional $${term.quoted.input}/$${term.quoted.output} expired ${-daysLeft} day(s) ago on ${term.endsOn}. ` +
          `The catalog still quotes it; the published rate is now $${term.revertsTo.input}/$${term.revertsTo.output} (${term.source}). ` +
          `Archive the new price, update the record, then retire this term.`,
      );
    } else if (quotes(term.revertsTo)) {
      notes.push(`${where}: expired on ${term.endsOn} and the catalog already carries the reverted price — the term can be retired`);
    } else {
      errors.push(
        `${where}: expired on ${term.endsOn}; catalog shows $${input}/$${output}, which matches neither the promotional nor the reverted price`,
      );
    }
  }
}

for (const note of notes) console.log(`note: ${note}`);
for (const warning of warnings) console.warn(`WARNING: ${warning}`);

if (errors.length > 0) {
  console.error(`\nPrice terms failed:\n${errors.map((error) => `  ${error}`).join("\n")}`);
  process.exit(1);
}

console.log(
  `Price terms passed: ${checked} term(s) checked, ${warnings.length} nearing expiry, ${notes.length} ready to retire.`,
);
