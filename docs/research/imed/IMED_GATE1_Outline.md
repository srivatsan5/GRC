# IMED-2027 paper: evidence summary and outline (Gate 1)

*Status: for author approval. Counts marked ⟨log⟩ are filled from the session-log analysis.*

**Conference:** IMED-2027 (Kuala Lumpur, 25–26 January 2027), **Track 1: Artificial Intelligence, Machine Learning & Intelligent Systems** (topic: *Human-AI Collaboration and Responsible AI*).
**Deadline:** 30 November 2026 (CMT). **Format:** IEEE conference, two columns, Times New Roman 10 pt, at most 8 pages, IEEE reference style. Double-blind review: an anonymous copy for CMT and a named copy for the final version.
**Authors (final copy only):** Srivatsan B, Soumit Roy, Raja Vishnu, Rithvik R, Niranthar M Javagal.

---

## 1. Working title

**Trust but Verify: Human–AI Collaboration in Auditing and Rebuilding an Enterprise Risk Management System**

## 2. Research questions

- **RQ1.** Which engineering and research tasks did a generative AI assistant perform in a project that audited, rebuilt and evaluated a governance, risk and compliance (GRC) system, and what did those tasks produce?
- **RQ2.** Where was the assistant's output wrong, overstated or unsafe, and which safeguards detected it?
- **RQ3.** Which practices made the AI-assisted work verifiable?

## 3. How this paper differs from the LEAD-2027 paper (under review)

| | LEAD-2027 paper | This paper |
|---|---|---|
| Question | Which design principles keep GRC assurance evidence trustworthy? | How can AI-assisted engineering of such a system itself be trusted? |
| Unit of analysis | The two software systems | The human–AI working process |
| Data | 23 evaluation scenarios | Commit history, gate records, review findings, test results, session log |
| Contribution | Failure taxonomy, seven design principles | Incident catalogue by detector, six verification practices |

The LEAD paper is cited in anonymised form ("under review"). No text or tables are reused from it.

## 4. Evidence (all from records that already exist)

### 4.1 Project record (git)
- 85 commits in total. **14** by the student team (19–20 March and 31 October 2026), the pre-study system. **71** made with the assistant between 1 and 16 November 2026, each carrying a co-author trailer.
- Active days with the assistant: 1, 2, 3, 6, 7, 8, 9 and 16 November (8 days).
- Stages, in order:
  - audit report (1 Nov);
  - Phases 0–4 rebuild: secrets locked down, authenticated API, real data, new design, production engineering (1 Nov);
  - new database installer and demo data (2–3 Nov);
  - research Gates 1–5 and the time-stamped scenario protocol (6 Nov, 17:48 UTC, commit `fe021fe`);
  - evaluation run (6 Nov, 17:57–18:24 UTC);
  - manuscript and independent review (6–9 Nov).

### 4.2 What the assistant produced (RQ1)
| Stage | Output | Measure |
|---|---|---|
| Audit | 3,500-word audit with scorecard and roadmap | 6 critical findings; 20 dependency vulnerabilities at audit time |
| Rebuild | TypeScript API, Next.js web app, Oracle migrations | 94 API tests, 18 web unit tests, 49 end-to-end checks passing |
| Security | Vulnerable dependencies patched | Production dependencies: baseline 19 → web app 0, API 4 moderate |
| Database | Installer for a new Autonomous Database | 216 tables, 1,379 rows, 247 enabled foreign keys, 0 invalid objects |
| Research | Protocol, harness, evaluation, manuscript | 23 scenarios; LEAD paper 1,996 words, 22 references checked against Crossref |

### 4.3 Where it went wrong, and what caught it (RQ2)
- **Evaluation contradicted the audit.** Three audit claims did not reproduce when tested (S1.2, S1.3, S1.4). Example: fake audit entries existed in the code but never appeared on a fresh installation. *Detector:* the time-stamped evaluation.
- **Independent reviews of AI-written code.** These ran three times, after Phases 0/1, 2 and 3, with **35 findings fixed** in total. Who performed the reviews is ⟨log⟩.
  - **Phase 0/1 (15 fixes):** approval state kept after a non-approver edit; a lockout race under parallel wrong passwords; an unkeyed, recomputable audit hash chain; columns blanked on update; and others.
  - **Phase 2 (11 findings):** a Risk Manager could approve a risk they created; dates shown a day early west of UTC; a seed row broke a CHECK constraint; and others.
  - **Phase 3 (9 behaviour bugs).**
  - *Detector:* independent review, confirmed by probing.
- **Peer review of the AI-drafted manuscript (Gate 7).** It found:
  - overstated measurement claims;
  - the term "pre-registered" used loosely;
  - deviations hidden in a replication package;
  - a factual error in Table 2;
  - incorrect use of the design science framework;
  - absolute claims about the literature.

  *Detector:* independent review.
- **A faulty test script.** The evaluation harness stopped the database stand-in by port, which also killed both APIs. The run was recorded as an environmental failure and re-run once. *Detector:* raw evidence and logs.
- **Environment guardrails.** A destructive `rm` was blocked by a safety check. A font install that would have accepted a licence on the user's behalf was refused. *Detector:* the environment.
- **Human review by the authors.** The authors asked for a better title, clearer figures, figures that did not look machine-made, word counts within limits and closer template compliance. *Detector:* the user.
- **Pre-delivery self-audits.** These caught an ambiguous pronoun in §6, the wrong font on page numbers in the PDF, and word counts over the limit. *Detector:* the assistant's own verification step.
- ⟨log⟩ Full catalogue with counts by detector.

### 4.4 Before and after: claims versus evidence
The team's August 2026 design paper (rejected, unpublished) presented features as strengths that the audit and evaluation later showed to be failures:
- an in-memory "shadow store" that answers when the database is down;
- client-supplied identity headers;
- a browser-side store for nine modules;
- an "immutable" audit log.

This is used as evidence that confident claims, from people or from AI, need executable checks. None of that paper's text is reused.

## 5. Method
- **Retrospective single-case study** following Runeson and Höst's case-study guidelines.
- **Data sources:**
  - the commit history;
  - change logs;
  - the audit report;
  - gate documents;
  - the evaluation protocol and results;
  - the independent review reports;
  - the session log.
- **Coding scheme:** each incident is coded by task stage, error type (fabrication or overclaim, incorrect behaviour, unsafe action, scope or format) and detector (tests or evaluation, independent review, environment, human, self-check).
- **Validity:** the authors study their own project, and the assistant helped code the incidents. All codes were checked by the authors against the cited record. This is disclosed.

## 6. Structure (target 6–7 pages)

| Section | Content | Words |
|---|---|---|
| Abstract + Keywords | IEEE single paragraph, 150–200 words | 180 |
| I. Introduction | Context, gap, RQs, contributions | 450 |
| II. Related Work | AI coding assistants (productivity, usability); security and correctness risks; trust in automation and automation bias; gap | 600 |
| III. Case and Method | The case, data sources, coding, validity | 550 |
| IV. Results | A. Tasks and outputs (Table I); B. Incidents by detector (Fig. 2, Table II); C. Claims versus evidence | 1,200 |
| V. Discussion | Six verification practices (RQ3), linked to trust-in-automation research | 700 |
| VI. Limitations | Single case, self-study, AI-assisted coding | 200 |
| VII. Conclusion | | 150 |
| Acknowledgment | AI-use disclosure (IEEE policy) | 70 |
| References | 18–22, IEEE style, each checked against Crossref | |

**Figures and tables:**
- **Fig. 1:** project timeline with gates and commits per day.
- **Fig. 2:** incidents by type and detector.
- **Table I:** tasks and outputs.
- **Table II:** practices and the evidence behind them.

## 7. Planned practices (RQ3, to be confirmed by the evidence)
1. Require executable evidence, not assertions.
2. Fix the protocol before running it.
3. Review in a separate pass, ideally by a separate reviewer.
4. Keep humans at the decision gates.
5. Rely on environment guardrails for irreversible actions.
6. Disclose AI use precisely.

## 8. References verified with Crossref (17 so far)
Runeson & Höst 2009; Ziegler et al. 2024; Pearce et al. 2022; Perry et al. 2023; Vaithilingam et al. 2022; Barke et al. 2023; Ji et al. 2023; Parasuraman & Riley 1997; Lee & See 2004; Amershi et al. 2019; Shneiderman 2020; Fan et al. 2023; Hou et al. 2024; Liang et al. 2024; Nosek et al. 2018; Moradi Dakhel et al. 2023; Goddard et al. 2012.

## 9. Left out by default (author decision)
- The external paraphrasing tool used against the AI detector, and the errors it introduced. Including it is possible but would describe the authors' own submission process.
- Any secret, credential or personal detail from the session log.
