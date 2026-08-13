// A promotional price is a number with an expiry date on it, and the catalog has nowhere to say
// "until August". Quote one and two things go wrong: the model looks cheaper than every other
// model priced at list, and the number goes stale silently the day the promotion lapses.
//
// So the rule is that the catalog quotes list price. Batch metas record promotions under
// `priceTerms` — the promotion is archived because it is a real published fact — and this check
// fails if one ever reaches the catalog.
//
//   node --experimental-strip-types scripts/check-price-terms.mjs

import { readdirSync, readFileSync } from "node:fs";
import { MODELS } from "../app/model-data.ts";

const SOURCE_DIR = "data/sources";
const DAY_MS = 24 * 60 * 60 * 1000;

// `--as-of YYYY-MM-DD` exists for the self-test at the bottom and nothing else. A scheduled term
// is a guard that fires on a date, so the only way to know it fires is to ask it about that date;
// without this the assertion would be "it will go red on the 16th", which is a claim, not a test.
const asOf = process.argv[process.argv.indexOf("--as-of") + 1];
const today = new Date(
  process.argv.includes("--as-of") ? asOf : new Date().toISOString().slice(0, 10),
);
const models = new Map(MODELS.map((model) => [model.id, model]));

const errors = [];
const notes = [];
let checked = 0;

const money = (price) => `$${price.input}/$${price.output}`;

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

    // A promotion is a price with an END date. A scheduled change is the mirror image: a price
    // with a START date, announced before it applies. Both exist because the catalog has one
    // price field and no way to say "until" or "from", and both fail the same way if ignored —
    // the number on the site quietly stops being what the vendor charges.
    //
    // Written because DeepSeek announced peak/off-peak billing from 2026-08-16 while nothing in
    // this repo watches a vendor pricing page: the only official DeepSeek price in the archive is
    // a hand-read snapshot from 2026-08-01, and the audit PREFERS official rows, so the frozen
    // copy outranks the Artificial Analysis rows that do move. Left alone, the site would have
    // gone on quoting the old price with every contract green.
    if (term.scheduled) {
      const daysUntil = Math.round((new Date(term.scheduled.effectiveFrom) - today) / DAY_MS);
      const listed = money(term.listPrice);
      const coming = money(term.scheduled);
      if (daysUntil > 0) {
        if (quotes(term.scheduled)) {
          errors.push(
            `${where}: catalog quotes ${coming}, which does not take effect until ` +
              `${term.scheduled.effectiveFrom} (${daysUntil} day(s) away). Quote ${listed} until then.`,
          );
        } else if (!quotes(term.listPrice)) {
          notes.push(`${where}: catalog shows ${money(model.price)}, term lists ${listed} — re-archive the price or retire the term`);
        } else {
          notes.push(`${where}: ${listed} → ${coming} in ${daysUntil} day(s), on ${term.scheduled.effectiveFrom} (${term.source})`);
        }
      } else if (!quotes(term.scheduled)) {
        errors.push(
          `${where}: the published price changed to ${coming} on ${term.scheduled.effectiveFrom} ` +
            `(${-daysUntil} day(s) ago) and the catalog still shows ${money(model.price)}. ` +
            `Re-archive from ${term.source}, update the record, then retire this term.`,
        );
      }
      continue;
    }
    const daysLeft = Math.round((new Date(term.promotional.endsOn) - today) / DAY_MS);

    if (quotes(term.promotional)) {
      errors.push(
        `${where}: catalog quotes the promotional ${money(term.promotional)}, which ` +
          (daysLeft >= 0
            ? `runs only to ${term.promotional.endsOn}`
            : `expired ${-daysLeft} day(s) ago on ${term.promotional.endsOn}`) +
          `. The catalog quotes list price — use ${money(term.listPrice)} (${term.source}).`,
      );
      continue;
    }

    if (!quotes(term.listPrice)) {
      // Neither price matches: the vendor moved, or the catalog did. Either way the term is
      // no longer describing reality and someone has to say which number is right.
      notes.push(
        `${where}: catalog shows ${money(model.price)}, term lists ${money(term.listPrice)} — re-archive the price or retire the term`,
      );
      continue;
    }

    if (daysLeft < 0) {
      notes.push(
        `${where}: the ${money(term.promotional)} promotion ended on ${term.promotional.endsOn} — the term can be retired`,
      );
    }
  }
}

for (const note of notes) console.log(`note: ${note}`);

if (errors.length > 0) {
  console.error(`\nPrice terms failed:\n${errors.map((error) => `  ${error}`).join("\n")}`);
  process.exit(1);
}

console.log(
  `Price terms passed: ${checked} term(s) checked, none quoted by the catalog before it applies, ${notes.length} note(s).`,
);
