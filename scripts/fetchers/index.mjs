// Every source this project can re-read by script.
//
// A scripted source pays twice: no row limit and no transcription error going in, and re-running
// it is that source's drift check afterwards. A transcribed source has neither, which is why
// AGENTS.md says to look for the page's own data file before hiring a transcriber.
//
// Adding one means writing scripts/fetchers/<id>.mjs and listing it here. Nothing else: the
// runner, the drift check, the scheduled refresh and the pull request all iterate this array.

import { aaEvaluations } from "./aa-evaluations.mjs";
import { ale } from "./ale.mjs";
import { arcprize, arcprizeV1, arcprizeV3 } from "./arcprize.mjs";
import { arena } from "./arena.mjs";
import { artificialAnalysis } from "./artificial-analysis.mjs";
import { deepswe } from "./deepswe.mjs";
import { epoch } from "./epoch.mjs";
import { epochFrontierMath } from "./epoch-frontiermath.mjs";
import { gdpval } from "./gdpval.mjs";
import { livebench } from "./livebench.mjs";
import { mmmu } from "./mmmu.mjs";
import { terminalBench } from "./terminal-bench.mjs";

export const FETCHERS = [livebench, deepswe, epoch, epochFrontierMath, terminalBench, ale, gdpval, mmmu, arena, arcprize, arcprizeV1, arcprizeV3, artificialAnalysis, aaEvaluations];

export const fetcherById = (id) => FETCHERS.find((fetcher) => fetcher.id === id);
