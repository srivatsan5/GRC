# Gate 4: Methodology and evaluation design

### Gate 5 proposal (manuscript structure) in Part B

**Date:** 6 November 2026 · **Status:** awaiting approval

**Recorded decisions:**
- **Gates 2 and 3:** approved.
- **Track:** Track 1, *Information Systems: Theory and Practice* (Digital Ethics and Policy → Regulation and Compliance).
- **No Scopus access:** the literature search will be described honestly as a documented web-indexed search with DOI verification.
- **COPE wording:** verified by me (see C1).

---

# Part A: Gate 4

## A1. Research design

- **Paradigm:** design science research (Hevner et al., 2004), following the six DSRM activities (Peffers et al., 2007):

| DSRM activity | In this study |
|---|---|
| 1. Problem identification | A forensic audit of a deployed GRC/ERM system (1 Nov 2026): code review, runtime reproduction, data-path tracing → failure taxonomy F1–F7 (RQ1) |
| 2. Objectives | Assurance-integrity objectives: each failure mode must be prevented |
| 3. Design and development | Design principles DP1–DP7, built on kernel theories, instantiated in ERMA-GRC (RQ2) |
| 4. Demonstration | The full RCSA workflow on demo data in a live Oracle Autonomous Database |
| 5. Evaluation | Pre-registered scenario experiment, baseline vs artifact (RQ3) |
| 6. Communication | This paper; scenario scripts released in the repository |

- **Evaluation strategy (FEDS; Venable et al., 2016):**
  - *Technical Risk and Efficacy*: artificial, summative, ex post.
  - **Justified because** the main risk here is technical: does the design prevent the failures? Naturalistic evaluation with users is future work, and we state that openly.

## A2. Data collection

| Source | What it gives | Kind of evidence |
|---|---|---|
| Audit report (`docs/AUDIT_REPORT.md`, 1 Nov 2026) | The failure instances behind F1–F7 | Primary; recorded before the redesign |
| Git history (commits from 19 Mar 2026 onward) | The baseline system; the time order of audit and redesign | Primary; tamper-evident by commit hash |
| Scenario experiment (`docs/research/evaluation/SCENARIOS.md`) | Outcome per scenario per system | Primary; pre-registered |
| Artifact test suites and CI | Regression evidence | Primary |

## A3. Measures

- **Unit of analysis:** a scenario run.
- **Outcome:** PREVENTED / OCCURRED / N/A, with evidence.
- **Construct mapping:** each scenario operationalises one failure mode. Generalisation scenarios G1–G4 test the principles outside the audited defects. The boundary scenario L1 records a known limitation.

## A4. Analysis

- **Main result:** for each failure mode, PREVENTED/runnable for the baseline and for the artifact, plus a per-scenario table.
- **No inferential statistics:** the outcomes are deterministic, and n = 23 scenarios is a test suite, not a sample.
- **Qualitative mapping:** failures → principles → mechanisms → scenario outcome, which forms the chain of evidence.

## A5. Validity threats and mitigations

| Threat | Mitigation |
|---|---|
| **Researcher bias** (the authors built the artifact and wrote the scenarios) | Pre-registration before execution (commit timestamp); generalisation scenarios not derived from known defects; a boundary scenario expected to fail; every outcome reported |
| **Strawman baseline** | The baseline is a real system deployed before the study, audited before any redesign, with git timestamps. We make no claim about commercial products. |
| **Construct validity** (do the scenarios capture "assurance integrity"?) | Each scenario is tied to a documented failure and a kernel-theory principle. We do not claim the scenarios are exhaustive. |
| **External validity** | A single case. The contribution is framed as nascent design theory (Gregor & Jones, 2007), with generalisation left to future multi-case study. |
| **AI involvement** | Disclosed under COPE. Claude assisted the audit, implementation and scenario scripting. Human authors define, review and take responsibility for the scenarios and the interpretation. |
| **Test-environment artefacts** (an in-memory ORDS stand-in instead of Oracle) | The same stand-in for both systems. Database-level claims rest on the separate verified install on Oracle 23ai. |

## A6. Ethics

- No human participants and no personal data. The demo data is fictitious.
- No ethics approval is needed for technical evaluation. Please confirm with your department if Atria requires a declaration.

---

# Part B: Gate 5, detailed manuscript structure (follows the LEAD-2027 full-paper template exactly)

**Header:**
- **Title:** *When the Risk System Becomes the Risk: Design Principles for Assurance Integrity in Governance, Risk and Compliance Information Systems*
- **Track:** Track 1, Information Systems: Theory and Practice (Digital Ethics and Policy: Regulation and Compliance)
- **Type of submission:** Ongoing research (design science; completed artifact and technical evaluation; naturalistic evaluation pending)
- **Authors:** omitted in the review copy. Template anonymity applies, and names are added after acceptance. A separate title page with authors and affiliations is prepared.

| Section | Words | Content | Tables/figures |
|---|---|---|---|
| Abstract | ≤500 | Purpose / Design-Methodology-Approach / Findings / Originality-Value | — |
| Keywords | 4–6 | assurance integrity; governance, risk and compliance; design science research; enterprise risk management; audit trail; segregation of duties | — |
| 1 Introduction | 300–400 | GRC systems as systems of record for assurance → the problem: the software itself can manufacture evidence → gap → RQ1–3 → structure | — |
| 2 Literature Review | 500–600 | 2.1 Concepts (ERM, GRC IS, assurance, assurance integrity) · 2.2 Previous studies (GRC IS adoption and value; ERM as practice; mechanisms) · 2.3 Gap · 2.4 Framework: failure → principle → mechanism | **Table 1** Summary of selected literature (7 studies: context, method, finding, gap) |
| 3 Methodology | 300–400 | 3.1 DSR design (DSRM, FEDS) · 3.2 Data: audit, git history, scenario experiment · 3.3 Measures · 3.4 Analysis · **AI-use disclosure (COPE)** | **Figure 1** DSR process and evaluation set-up (baseline vs artifact, same data) |
| 4 Results and Discussion | 500–600 | 4.1 Results: taxonomy (RQ1), principles (RQ2), scenario outcomes (RQ3) · 4.2 Discussion: links to Power, Crosby & Wallach, OWASP/Saltzer; what is new vs generic | **Table 2** Failure modes → design principles → mechanisms · **Table 3** Scenario outcomes, baseline vs ERMA-GRC |
| 5 Implications | 150–200 | Theoretical (assurance integrity as a design property of GRC IS); practical (procurement checklist for GRC buyers; auditors); societal (trust in compliance claims) | — |
| 6 Conclusion, Limitations and Future Research | 200–250 | Summary; limitations (single case, artificial evaluation, AI involvement, no external anchoring, no commercial comparison); future work (naturalistic evaluation, multi-case, anchored logs) | — |
| References | APA 7 | About 20 verified sources, each with a purpose | — |
| **Total** | **about 2,000** | | **4 of 5 allowed** |

**Abstract (extended-abstract template):** written separately to that template's budgets: Purpose 100–125, Design 100–125, Findings 150–175, Originality 75–100. No references, tables or equations.

**Writing order (Gate 6):**
1. Run the experiment (results first, so the text reports facts).
2. Write §3, §4, §2, §1, §5, §6, then the abstract.
3. Send you each section for approval.

---

# Part C: COPE check and the track decision

## C1. COPE "Authorship and AI tools" verified (6 Nov 2026)

The COPE page refuses automated requests, so I did not fetch it directly. I verified its text in two ways:
- The search engine's index of the COPE page itself.
- Three independent pages that reproduce the same sentences verbatim: Wolters Kluwer/Lippincott, ASME author resources, and the UNBC library guide.

Verbatim requirements:
1. "AI tools cannot meet the requirements for authorship as they cannot take responsibility for the submitted work. As non-legal entities, they cannot assert the presence or absence of conflicts of interest nor manage copyright and license agreements."
2. "Authors who use AI tools in the writing of a manuscript, production of images or graphical elements of the paper, or in the collection and analysis of data, must be transparent in disclosing in the Materials and Methods (or similar section) of the paper how the AI tool was used and which tool was used."
3. "Authors are fully responsible for the content of their manuscript, even those parts produced by an AI tool, and are thus liable for any breach of publication ethics."

**Draft disclosure for §3 (you complete the bracketed parts):**
> *Use of generative AI.* Claude ([model and version], Anthropic) was used under the authors' direction to (a) assist the code-and-runtime audit of the baseline system, (b) implement substantial parts of the ERMA-GRC software, (c) script the evaluation scenarios, (d) support the literature search and DOI verification, and (e) draft text, which the authors revised. The authors designed the study, defined the design principles and scenarios, verified all sources and results, and take full responsibility for the content. No AI tool is listed as an author.

## C2. Track decision and the abstract

- **Track 1** is the best fit. Its topic list explicitly names *Regulation and Compliance* under IS theory and practice, and GRC IS is an IS research stream.
- **Full paper vs abstract.** The call offers "Full paper … **or** Abstract", and submitting both for the same work could be treated as a duplicate submission. **Recommendation:** submit the **full paper**. I will also prepare the **abstract** to its template, so you have it ready if you decide on an abstract-only submission, or if the organisers ask for it.
