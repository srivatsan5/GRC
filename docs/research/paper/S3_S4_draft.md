# §3 Methodology and §4 Results and Discussion (approved; Figure 2 added after approval)

*Gate 6, sections 1–2 of 7. Every number below comes from `docs/research/evaluation/RESULTS.md` (commit `afdfdd3`). Word counts exclude headings, tables and figure captions.*

---

## 3 Methodology

### 3.1 Research Design

We followed design science research (Hevner et al., 2004) and the six activities of the DSRM (Peffers et al., 2007):

1. **Problem identification.** A forensic audit of a GRC/ERM system that was already deployed. The audit combined code review, runtime reproduction and data-path tracing, and produced seven failure modes (RQ1).
2. **Design.** We expressed remedies as design principles in the aim–mechanism–rationale form of Gregor et al. (2020), each grounded in a kernel theory (RQ2).
3. **Instantiation.** The principles were instantiated in ERMA-GRC, a web application whose server mediates every read and write to an Oracle database.
4. **Evaluation (RQ3).** We followed the *technical risk and efficacy* strategy of FEDS (Venable et al., 2016): artificial, summative and ex post.

### 3.2 Data Collection

Data came from the audit of the original system (code, runtime behaviour and data paths) and from a scenario experiment whose protocol a timestamped repository commit recorded before any run.

**Systems compared:**
- **Baseline:** the original system at its last commit before the redesign.
- **Artifact:** ERMA-GRC.

Both ran against the same in-memory stand-in for the database interface, seeded with identical rows. Ground truth was read from the stand-in, never from the system under test (Figure 1). Each scenario ran once per system. Evidence (HTTP status, stored row, screen text, screenshot) was kept for every run.

### 3.3 Measures and Instruments

The unit of analysis is a scenario run. The experiment contains 23 scenarios in three groups. Eighteen are audit-derived: each operationalises one failure mode. Four generalisation scenarios test the principles beyond the audited defects. One boundary scenario, expected to fail, records a known limitation. Each outcome was coded against a criterion fixed in advance: PREVENTED, OCCURRED, or not applicable.

### 3.4 Data Analysis

- For each failure mode and system, we count PREVENTED scenarios out of the runnable ones.
- We use no inferential statistics. The outcomes are deterministic, and the scenarios are a test suite, not a sample.
- Protocol clarifications and one environmental re-run are reported in the replication package.

**Use of generative AI.** Claude (Claude Opus 5.5, Anthropic) was used under the authors' direction to:
- (a) assist the code and runtime audit of the baseline;
- (b) implement substantial parts of ERMA-GRC;
- (c) script the evaluation scenarios;
- (d) support the literature search and DOI verification;
- (e) draft text, which the authors revised.

The authors designed the study, defined the principles and scenarios, verified all sources and results, and take full responsibility for the content. No AI tool is listed as an author.

> **Figure 1.** DSR process and evaluation set-up. The audit of the baseline yields F1–F7, which inform DP1–DP7, which are instantiated in ERMA-GRC. The baseline and ERMA-GRC each run the 23 pre-registered scenarios against one shared database stand-in, and outcomes are coded against its stored state. *(File: `figures/figure-1-dsr-process.png`.)*

---

## 4 Results and Discussion

### 4.1 Results

**RQ1 and RQ2.** Table 2 maps the seven failure modes to the principles that counter them and to the mechanisms that instantiate those principles in ERMA-GRC.

**Table 2.** Failure modes, design principles and mechanisms

| Failure mode (RQ1) | Design principle (RQ2) | Mechanism in ERMA-GRC |
|---|---|---|
| F1 Fabricated assurance values | DP1 Evidence provenance | No derived ratings; unrated risks shown as "Not rated" and kept off the heatmap |
| F2 Decisions overwritten by defaults | DP2 Decision preservation | Defaults fill only missing fields at creation; approval fields change only through authorised transitions |
| F3 Client-side or absent enforcement | DP3 Server-enforced, identity-bound separation of duties | Signed session; deny-by-default permission matrix; maker ≠ checker; conditional writes (ETag) on decisions; deactivation revokes sessions |
| F4 Mutable, forgeable evidence trail | DP4 Tamper-evident, actor-bound trail | Append-only HMAC-SHA256 hash chain; actor taken from the session only; verification shown to users |
| F5 Silent failure reported as success | DP5 Fail-visible operation | Database failures returned as explicit error statuses; no fallback store |
| F6 Fragmented system of record | DP6 Single system of record | All modules persisted in the database |
| F7 Destructive actions on fabricated records | DP1 Evidence provenance | Empty states instead of placeholder rows |
| (F1) | DP7 Computed, not declared, metrics | KRI status derived from thresholds and direction |

**RQ3.** Table 3 summarises the outcomes:
- On the 18 audit-derived scenarios, ERMA-GRC prevented 18 failures and the baseline prevented 4.
- On the generalisation scenarios, ERMA-GRC prevented 3 of 4 and the baseline none.
- The boundary scenario occurred on both systems, as registered.

The baseline's failures were concrete:
- It stored DRAFT after an approver set APPROVED.
- It accepted writes carrying no session, or only a self-declared administrator header.
- It recorded an audit entry under a claimed "CEO" identity.
- It answered 201 while the database was unreachable.
- It invented two scored risks, with delete buttons, for an assessment cycle that had none.

In the generalisation scenarios, ERMA-GRC:
- kept exactly one of two simultaneous approval decisions, and the other approver received a conflict;
- rejected a write made with the still-valid session of a deactivated user;
- rejected a path-traversal identifier before it reached the database.

The baseline reported both simultaneous decisions as successful, accepted the write, and forwarded the traversal to the database.


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

**Where the baseline passed.** The baseline met four criteria:
- It displayed stored statements, monetary values and empty statuses faithfully.
- It attributed an audit entry to the acting persona, though that identity was self-asserted.
- On a fresh installation its audit trail held no invented entries. This contradicts the audit report: the seeding code exists, but it never runs on that path.

**Where ERMA-GRC failed.** It failed twice:
- **G4.** KRI status was computed correctly through the interface, but the API stored a status declared by the client. DP7 was therefore enforced only in the browser. The baseline behaved the same way.
- **L1.** An insider holding the audit key re-chained an edited log offline. After a restart, verification passed.

Figure 2 shows two of the baseline's failures next to ERMA-GRC's handling of the same stored data.

> **Figure 2.** The same stored data in both systems. (a) The baseline shows a risk with no stored rating or SLE with a score of 4 and an SLE of $40,000 (scenario S1.1). (b) ERMA-GRC shows the same risk as "Not rated". (c) For an assessment cycle that has no risks, the baseline shows two invented, scored risks, each with a delete button (S7.1). (d) ERMA-GRC shows the cycle as empty. Screens were re-captured after the product was renamed, from the same set-up as the recorded run; table columns unrelated to the comparison are hidden. *(File: `figures/figure-2-baseline-vs-erma-grc.png`.)*

### 4.2 Discussion

**The failures are assurance failures.** The baseline produced scores, approvals and audit entries that were disconnected from its stored state: a "risk management of nothing" (Power, 2009) produced by software rather than by organisational ritual. Several mechanisms are generic: fail-safe defaults and complete mediation (Saltzer & Schroeder, 1975), separation of duties (Botha & Eloff, 2001) and hash-chained logs (Schneier & Kelsey, 1999). What is specific to GRC is the object they protect. DP1, DP2 and DP7 have no direct counterpart in generic security guidance, because they concern whether a displayed rating or decision is evidence at all.

**The principles depend on each other.** ERMA-GRC identifies the creator of a record, and so who may not approve it, from its audit trail. In L1, rewriting one creation entry changed who was barred from approving that record. DP3 therefore rests on DP4, and DP4 rests on keys held outside the application. This is the boundary Crosby and Wallach (2009) predict for logs without external auditors.

**Where a principle is enforced matters.** G4 shows that a principle checked only in the client is a convention, not a control. We therefore refine the design theory: every principle must be enforced at the server boundary.

Assurance integrity remains necessary but not sufficient. Faithful records of a poorly calibrated risk matrix are still poor risk information (Cox, 2008).

---

**Word counts:**

| Section | Words | Budget |
|---|---|---|
| §3 | ≈ 399 | 300–400 |
| §4 | ≈ 551 | 500–600 |

**Status:** approved by the authors on 7 November 2026.
