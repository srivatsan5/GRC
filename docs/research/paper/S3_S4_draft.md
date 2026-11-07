# §3 Methodology and §4 Results and Discussion

*Revised after the Gate 7 peer review (7 November 2026). Every number comes from `docs/research/evaluation/RESULTS.md` (commit `afdfdd3`). Word counts exclude headings, tables and figure captions.*

---

## 3 Methodology

### 3.1 Research Design

We followed design science research (DSR; Hevner et al., 2004), entering the design science research methodology (DSRM; Peffers et al., 2007) at problem identification. Its six activities were: (1) problem identification through the audit, yielding seven failure modes (RQ1); (2) objectives, preventing each failure mode; (3) design of seven principles and their instantiation, ERMA-GRC, a web application whose server mediates every read and write (RQ2); (4) demonstration of the risk and control self-assessment (RCSA) workflow on Oracle Autonomous Database; (5) evaluation (RQ3); and (6) communication, this paper. The evaluation is one artificial, summative episode of the Technical Risk and Efficacy strategy of the Framework for Evaluation in Design Science (FEDS; Venable et al., 2016); naturalistic episodes remain.

### 3.2 Data Collection

Evidence came from the audit and a scenario experiment whose protocol was time-stamped in the project repository, not a public registry, before execution. The original system (the baseline) and ERMA-GRC ran against one in-memory database stand-in seeded with identical rows (Figure 1). Each scenario had one recorded run per system, keeping its HTTP status, stored rows, screen text and screenshot.

### 3.3 Measures and Instruments

The unit of analysis is a scenario run. Eighteen scenarios operationalise the failure modes, four test the principles beyond the audited defects, and one boundary scenario was expected to fail. Each run was coded PREVENTED, OCCURRED or not applicable against a criterion registered in advance. Stored-state outcomes were read from the stand-in, and display outcomes from screen text.

### 3.4 Data Analysis

We count PREVENTED scenarios per failure mode, without inferential statistics, because outcomes are deterministic and the scenarios form a test suite, not a sample.

All deviations are reported in a replication package available on request. The test scripts were piloted on a separate copy after registration. Choices where the protocol was silent, such as an approver as editor in S2.2, were fixed before each run. The rule coding G4 by its stricter path was not registered, and one run (S5.1) was repeated after a script fault.

**Use of generative AI.** Claude (Claude Opus 5.5, Anthropic) was used under the authors' direction to assist the audit, implement much of ERMA-GRC, draft the scenario protocol, write and run the test scripts, propose outcome codings, produce the figures, support the literature search and DOI checks, and draft text.

The authors set the questions, approved each stage including the protocol before execution, verified sources and results, revised the text and take full responsibility. No AI tool is an author.

> **Figure 1.** DSR process and evaluation set-up. The audit of the baseline yields failure modes F1–F7, which inform principles DP1–DP7, which are instantiated in ERMA-GRC. Both systems run the 23 scenarios against one shared database stand-in. *(File: `figures/figure-1-dsr-process.png`.)*

---

## 4 Results and Discussion

### 4.1 Results

**RQ1 and RQ2.** Table 2 maps each failure mode to the principle that counters it, that principle's kernel theory, and its mechanism in ERMA-GRC.

**Table 2.** Failure modes, design principles, kernel theories and mechanisms

| Failure mode (RQ1) | Design principle (RQ2) | Kernel theory | Mechanism in ERMA-GRC |
|---|---|---|---|
| F1 Fabricated assurance values | DP1 Evidence provenance | Clark & Wilson (1987); Power (1997) | No derived ratings; unrated risks shown as "Not rated" and kept off the heatmap |
| F2 Decisions overwritten by defaults | DP2 Decision preservation | Clark & Wilson (1987); Saltzer & Schroeder (1975) | Defaults fill only missing fields at creation; approvals change only through authorised transitions |
| F3 Client-side or absent enforcement | DP3 Server-enforced, identity-bound separation of duties | Saltzer & Schroeder (1975); Botha & Eloff (2001) | Signed server session; deny-by-default permissions; maker ≠ checker; a conflicting decision is refused; deactivation revokes sessions |
| F4 Mutable, forgeable evidence trail | DP4 Tamper-evident, actor-bound trail | Schneier & Kelsey (1999); Crosby & Wallach (2009) | Keyed hash chain with a static key; actor taken from the session; verification shown to users |
| F5 Silent failure reported as success | DP5 Fail-visible operation | Saltzer & Schroeder (1975) | Database failures returned as error statuses; no fallback store |
| F6 Fragmented system of record | DP6 Single system of record | Clark & Wilson (1987) | Risk and module records in the database; accounts and audit chain on the API server, the chain copied to the database |
| F7 Destructive actions on fabricated records | DP1 Evidence provenance | as for F1 | Empty states instead of placeholder rows |
| F1 (metrics) | DP7 Computed, not declared, metrics | Vasarhelyi et al. (2004); Cox (2008) | Indicator status derived from thresholds and direction, in the client |

**RQ3.** On the 18 audit-derived scenarios, ERMA-GRC prevented the failure in all 18, and the baseline in 4 (Table 3). The baseline stored DRAFT after an approver set APPROVED, accepted writes with no session or with only a self-declared administrator header, recorded an audit entry under a claimed "CEO" identity, reported success while the database was unreachable, and invented two scored risks, each with a delete button, for a cycle that had none. ERMA-GRC prevented three of the four generalisation failures. Of two simultaneous approval decisions it kept one and refused the other; it rejected a write from a deactivated user's still-valid session; and it rejected a path-traversal identifier before any database request. The baseline's 0/4 here largely repeats its F2 and F3 defects, so it is not independent evidence. Two variants are reported for balance. When an editor without approval rights changed an approved risk (S2.2 variant), ERMA-GRC returned it to review by design, which the literal S2.2 criterion codes as OCCURRED. The same simultaneous-decision race on a record's status (G1 variant) was prevented.

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

**Where the baseline passed.** The baseline met four criteria. It displayed a stored statement and single loss expectancy (SLE) faithfully (S1.2). It did not show a missing approval status as Approved, displaying "Draft" as ERMA-GRC also does (S1.3). Its fresh audit trail held no invented entries (S1.4). It attributed an audit entry to the acting persona, though that identity was self-asserted (S4.3). S1.3 and S1.4 contradict the audit report on the screens examined; for S1.4, the code that seeds invented audit entries exists but never runs on a fresh installation.

**Where ERMA-GRC failed.** ERMA-GRC failed twice. In G4, a key risk indicator (KRI) reading received its status by rule in the interface, but the API stored a status declared by the client; the baseline behaves the same way. In L1, an insider holding the audit key re-chained an edited log offline, and verification passed after a restart.

Figure 2 shows two of the baseline's failures next to ERMA-GRC's handling of the same stored data.

> **Figure 2.** The same stored data in both systems. (a) The baseline shows a risk with no stored rating or SLE with a score of 4 and an SLE of $40,000 (scenario S1.1). (b) ERMA-GRC shows the same risk as "Not rated". (c) For an assessment cycle that has no risks, the baseline shows two invented, scored risks, each with a delete button (S7.1). (d) ERMA-GRC shows the cycle as empty. These are illustrative re-captures, taken after the evaluation from the renamed build with the same set-up; unrelated columns are hidden. *(File: `figures/figure-2-baseline-vs-erma-grc.png`.)*

### 4.2 Discussion

**The failures are assurance failures.** The baseline produced scores, approvals and audit entries that were disconnected from its stored state: a software-made "risk management of nothing" (Power, 2009). The mechanisms that counter this are established: fail-safe defaults and complete mediation (Saltzer & Schroeder, 1975), separation of duties (Botha & Eloff, 2001), and well-formed transactions with integrity verification (Clark & Wilson, 1987). DP1, DP2 and DP7 specialise these integrity ideas to assurance evidence: they ask whether a displayed rating, decision or metric is evidence at all.

**The principles depend on each other.** ERMA-GRC reads a record's creator, and hence who may not approve it, from its audit trail. In L1, rewriting one creation entry changed who was barred from approving that record. DP3 therefore rests on DP4. DP4 in turn rests on keys held outside the application. Schneier and Kelsey (1999) evolve their keys; ERMA-GRC's key is static. Without external commitments, whoever holds that key can rewrite history (Crosby & Wallach, 2009).

**Enforcement must sit at the server.** G4 shows that a rule checked only in the client is a convention, not a control. Integrity remains necessary but not sufficient: faithful records of a poorly calibrated risk matrix are still poor risk information (Cox, 2008).

---

**Word counts:**

| Section | Words | Budget |
|---|---|---|
| §3 | ≈ 400 | 300–400 |
| §4 | ≈ 579 | 500–600 |
