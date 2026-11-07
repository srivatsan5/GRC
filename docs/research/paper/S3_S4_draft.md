# §3 Methodology and §4 Results and Discussion

*Revised after the Gate 7 peer review (7 November 2026). Every number comes from `docs/research/evaluation/RESULTS.md` (commit `afdfdd3`). Word counts exclude headings, tables and figure captions.*

---

## 3 Methodology

### 3.1 Research Design

We followed design science research (DSR; Hevner et al., 2004), entering the design science research methodology (DSRM; Peffers et al., 2007) at problem identification. Its six activities were (1) problem identification, the audit (RQ1); (2) objectives; (3) design of seven principles, instantiated in ERMA-GRC (RQ2); (4) demonstration on Oracle Autonomous Database; (5) evaluation (RQ3); and (6) communication. The evaluation is one artificial, summative episode of the Technical Risk and Efficacy strategy of the Framework for Evaluation in Design Science (FEDS; Venable et al., 2016).

### 3.2 Data Collection

Evidence came from the audit and a scenario experiment, its protocol time-stamped in the project repository (not a public registry) before execution. The original system (baseline) and ERMA-GRC ran against one database stand-in with identical rows (Figure 1), one recorded run per scenario, keeping full evidence.

### 3.3 Measures and Instruments

Eighteen of the 23 scenarios operationalise the failure modes, four test the principles beyond them, and one was expected to fail. Runs were coded PREVENTED, OCCURRED or not applicable against criteria registered in advance, reading stored state from the stand-in and display outcomes from screen text.

### 3.4 Data Analysis

We count PREVENTED scenarios per failure mode; deterministic outcomes need no inferential statistics. All deviations are reported in a replication package available on request: the test scripts were piloted after registration; open points (e.g., an approver as editor in S2.2) were fixed before each run; the rule coding G4 by its stricter path was not registered; and S5.1 was re-run after a script fault.

**Use of generative AI.** Claude (Claude Opus 5.5, Anthropic) was used under the authors' direction to assist the audit, implement much of ERMA-GRC, draft the protocol, write and run the test scripts, propose outcome codings, produce the figures, support the literature search, and draft text. The authors set the questions, approved each stage including the protocol before execution, verified sources and results, revised the text and take full responsibility. No AI tool is an author.

> **Figure 1.** DSR process and evaluation set-up: the audit yields F1–F7, which inform DP1–DP7, instantiated in ERMA-GRC; both systems run the 23 scenarios against one database stand-in. *(File: `figures/figure-1-dsr-process.png`.)*

---

## 4 Results and Discussion

### 4.1 Results

**RQ1 and RQ2.** Table 2 maps each failure mode to its principle, kernel theory and mechanism in ERMA-GRC.

**Table 2.** Failure modes, design principles, kernel theories and mechanisms

| Failure mode (RQ1) | Design principle (RQ2) | Kernel theory | Mechanism in ERMA-GRC |
|---|---|---|---|
| F1 Fabricated assurance values | DP1 Evidence provenance | Clark & Wilson (1987); Power (1997) | No derived ratings; "Not rated" shown |
| F2 Decisions overwritten by defaults | DP2 Decision preservation | Clark & Wilson (1987); Saltzer & Schroeder (1975) | Defaults only at creation; approvals only via authorised transitions |
| F3 Client-side or absent enforcement | DP3 Server-enforced, identity-bound separation of duties | Saltzer & Schroeder (1975); Botha & Eloff (2001) | Server session; deny by default; maker ≠ checker; conflicts refused; revocation |
| F4 Mutable, forgeable evidence trail | DP4 Tamper-evident, actor-bound trail | Schneier & Kelsey (1999); Crosby & Wallach (2009) | Keyed hash chain (static key); session-bound actor; visible verification |
| F5 Silent failure reported as success | DP5 Fail-visible operation | Saltzer & Schroeder (1975) | Errors returned; no fallback store |
| F6 Fragmented system of record | DP6 Single system of record | Clark & Wilson (1987) | Records in database; accounts and audit chain on server |
| F7 Destructive actions on fabricated records | DP1 Evidence provenance | as for F1 | Empty states, no placeholder rows |
| F1 (metrics) | DP7 Computed, not declared, metrics | Vasarhelyi et al. (2004); Cox (2008) | Status computed from thresholds, in the client |

**RQ3.** ERMA-GRC prevented all 18 audit-derived failures; the baseline prevented 4 (Table 3). The baseline stored DRAFT after an approver set APPROVED, accepted writes without a session or with a self-declared administrator header, recorded an audit entry under a claimed "CEO" identity, reported success while the database was unreachable, and invented two scored risks, each with a delete button, for a cycle that had none. ERMA-GRC prevented three of the four generalisation failures: it kept one of two simultaneous approval decisions, rejected a write from a deactivated user's still-valid session, and rejected a path-traversal identifier before any database request. The baseline's 0/4 there largely repeats its F2 and F3 defects and is not independent evidence. For balance, when an editor without approval rights changed an approved risk (S2.2 variant), ERMA-GRC returned it to review by design, which the literal criterion codes as OCCURRED; the simultaneous-decision race on a record's status (G1 variant) was prevented.

**Table 3.** Scenario outcomes (PREVENTED / runnable)

| Scenarios | Baseline | ERMA-GRC |
|---|---|---|
| F1 Fabricated values (S1.1–S1.4) | 3 / 4 | 4 / 4 |
| F2 Decisions overwritten (S2.1–S2.2) | 0 / 2 | 2 / 2 |
| F3 Enforcement (S3.1–S3.4) | 0 / 4 | 4 / 4 |
| F4 Evidence trail (S4.1–S4.3) | 1 / 3 | 3 / 3 |
| F5 Silent failure (S5.1–S5.3) | 0 / 3 | 3 / 3 |
| F6 Fragmented record (S6.1) | 0 / 1 | 1 / 1 |
| F7 Fabricated-row deletion (S7.1) | 0 / 1 | 1 / 1 |
| Generalisation (G1–G4) | 0 / 4 | 3 / 4 |
| Boundary (L1, expected to fail) | 0 / 1 | 0 / 1 |
| **Total** | **4 / 23** | **21 / 23** |

**Where the baseline passed.** The baseline displayed a stored statement and single loss expectancy (SLE) faithfully (S1.2), showed a missing approval status as "Draft", as ERMA-GRC does, rather than Approved (S1.3), held no invented entries in a fresh audit trail (S1.4), and attributed an audit entry to the self-asserted acting persona (S4.3). S1.3 and S1.4 contradict the audit report; for S1.4, the seeding code exists but never runs on a fresh installation.

**Where ERMA-GRC failed.** In G4, a key risk indicator (KRI) reading received its status by rule in the interface, but the API stored a status declared by the client, as the baseline's does. In L1, an insider holding the audit key re-chained an edited log offline, and verification passed after a restart. Figure 2 contrasts two baseline failures with ERMA-GRC on the same stored data.

> **Figure 2.** The same stored data in both systems: (a) the baseline shows an unrated risk with score 4 and SLE $40,000 (S1.1); (b) ERMA-GRC shows it as "Not rated"; (c) the baseline invents two scored, deletable risks for an empty cycle (S7.1); (d) ERMA-GRC shows the cycle as empty. Illustrative post-evaluation re-captures; unrelated columns hidden. *(File: `figures/figure-2-baseline-vs-erma-grc.png`.)*

### 4.2 Discussion

**The failures are assurance failures.** The baseline produced scores, approvals and audit entries disconnected from its stored state: a software-made "risk management of nothing" (Power, 2009). Established mechanisms counter this: fail-safe defaults and complete mediation (Saltzer & Schroeder, 1975), separation of duties (Botha & Eloff, 2001), and well-formed transactions with integrity verification (Clark & Wilson, 1987). DP1, DP2 and DP7 specialise these integrity ideas to assurance evidence: they ask whether a displayed rating, decision or metric is evidence at all.

**The principles depend on each other.** ERMA-GRC reads a record's creator, and hence who may not approve it, from its audit trail; in L1, rewriting one creation entry changed who was barred from approving that record. DP3 therefore rests on DP4, and DP4 on keys held outside the application. Unlike Schneier and Kelsey's (1999) evolving keys, ERMA-GRC's key is static, and without external commitments its holder can rewrite history (Crosby & Wallach, 2009).

**Enforcement must sit at the server.** G4 shows that a rule checked only in the client is a convention, not a control. Integrity is necessary but not sufficient: faithful records of a poorly calibrated risk matrix are still poor risk information (Cox, 2008).


---

**Word counts:**

| Section | Words | Budget |
|---|---|---|
| §3 | ≈ 325 | 300–400 |
| §4 | ≈ 501 | 500–600 |
