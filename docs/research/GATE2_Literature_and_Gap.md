# Gate 2: Literature investigation and research-gap validation

### Gate 3 proposal (research questions, objectives, contributions) in Part B

**Date:** 6 November 2026 · **Status:** awaiting your approval of Part A (Gate 2) and Part B (Gate 3)

**Gate 1 decisions recorded:**
- **Framing:** C (assurance-integrity design science study)
- **Submissions:** full paper and abstract, both
- **Tracks:** Track 1 and Track 7, both
- **Title:** the proposed one
- **Authors:** five, as given
- **Evaluation:** controlled experiments, with no external experts
- **Name:** ERMA-GRC

---

# Part A: Gate 2

## A1. Summary

- **The gap holds up, with one important qualification.** In the peer-reviewed literature we reached:
  - GRC information systems are studied for their **definition, implementation and value**.
  - The building blocks (separation of duties, fail-safe design, tamper-evident logs) are studied **as generic security mechanisms**.
  - **No study examined how the design of a GRC application can corrupt the assurance evidence that boards and auditors rely on.**
- **The qualification.** Each individual mechanism is well known, so we **cannot claim novel mechanisms**. The defensible novelty has two parts:
  - an empirically derived **mapping from application design failures to corrupted assurance evidence**
  - **assurance-specific design principles**, tested against a real baseline
- **Coverage is a caveat, not a closed question.** Without Scopus, Web of Science, IEEE Xplore or ACM DL, I cannot rule out a relevant paper in, for example, the *International Journal of Accounting Information Systems*. §A6 gives the exact search for you to run through your institution before submission.

## A2. Search strategy (documented)

| Item | Detail |
|---|---|
| Dates | 6 November 2026 |
| Tools | A general web search engine (two modes), which indexes publisher pages, RePEc/EconPapers, institutional repositories, AIS eLibrary, USENIX and arXiv. The **Crossref REST API** was used to verify every DOI. Open-access full texts were downloaded where permitted. |
| Not available | Direct Scopus, Web of Science, IEEE Xplore and ACM DL searches. The COPE site and core.ac.uk refuse automated access, and I did not try to get around either refusal. |
| Search strings | The 24 strings in Gate 1 §8, plus: "application controls accounting information systems data integrity audit trail"; "ERM information system risk information quality decision making"; "GRC information systems 2023 2024 2025 design architecture"; "Separation of duties … workflow environments"; "compliance theater box-ticking risk management software"; "ERM function influences decision-making"; "risk management and calculative cultures"; "anatomy of a design theory"; "continuous monitoring of business process controls Siemens"; "fail-safe defaults Saltzer Schroeder"; "OWASP broken access control" |
| Inclusion | Peer-reviewed articles or proceedings, foundational books and standards that (a) theorise ERM/GRC practice, (b) study GRC/ERM information systems, (c) define a mechanism the artifact relies on, or (d) define the design science method |
| Exclusion | Vendor content; AI-generated wiki mirrors; unreviewed preprints used as evidence; opinion pieces (these were recorded as context only) |
| Screening | Title/abstract screening of about 150 results, then full-text reading where accessible (§A4) |
| Honest label | A **structured, documented literature investigation**, not a systematic review. The paper will describe it this way. |

## A3. The literature, synthesised

**1. ERM/GRC as organisational practice.**
- ERM is enacted through "risk rationalities, uncertainty experts and technologies", and varies across firms (Arena et al., 2010).
- Risk functions differ in "calculative cultures" (Mikes, 2009).
- Universal ERM guidelines are themselves risky, which motivates a contingency view (Mikes & Kaplan, 2015).
- Risk technologies built over time change how much the ERM function influences decisions (Meidell & Kaarbøe, 2017).
- Critics argue that ERM can become "the risk management of nothing" (Power, 2009), and that verification can yield *auditability* rather than assurance (Power, 1997).
- *Implication:* the **technology is part of how risk is produced**, not a neutral container. That justifies studying its design.

**2. GRC information systems.**
- Integrated GRC was defined and framed by Racz, Weippl & Seufert (2010).
- Papazafeiropoulou & Spanaki (2015, full text read) interviewed GRC implementation stakeholders. They produced a framework of implementation characteristics:
  - goals and objectives
  - purpose of the system
  - key stakeholders
  - methodology and requirements
  - critical success factors
  - problems and barriers
- Spanaki & Papazafeiropoulou (2016) add an adoption lifecycle and value drivers.
- *Implication:* this stream asks **how GRC systems are adopted and what value they bring**. It does not ask **whether their evidence can be trusted**.

**3. Mechanisms the artifact relies on (kernel theories).**
- **Fail-safe defaults and complete mediation** (Saltzer & Schroeder, 1975).
- **Separation of duties** in workflow, static and dynamic (Botha & Eloff, 2001).
- **Tamper-evident logging:**
  - Forward-integrity hash chains (Schneier & Kelsey, 1999).
  - History trees with external auditors (Crosby & Wallach, 2009). Their model is "an untrusted logger … kept honest by a number of auditors who will challenge the logger to prove its correct behavior". It requires commitments to be distributed to auditors, for example by gossip.
- **Continuous assurance and monitoring** (Vasarhelyi, Alles & Kogan, 2004; Alles et al., 2006).
- **Scoring:** risk matrices have poor resolution and can rank risks wrongly (Cox, 2008).
- *Implication:* the mechanisms exist, but **separately, outside GRC application design**, and not tied to the specific evidence that RCSA produces: ratings, approvals, appetite exposure, KRI status.

**4. Method.**
- Design science research (Hevner et al., 2004; Peffers et al., 2007).
- Design theory and design principles (Gregor & Jones, 2007; Gregor, Chandra Kruse & Seidel, 2020).
- Evaluation strategy (Venable, Pries-Heje & Baskerville, 2016).

## A4. Closest competing studies (seven, with what each does and does not do)

| # | Study (verified) | What it does | What it does not address | How our study differs |
|---|---|---|---|---|
| 1 | Papazafeiropoulou & Spanaki (2015), *Inf. Syst. Frontiers* 18(6), 1251–1263, doi:10.1007/s10796-015-9572-3. **Full text read.** | Literature review plus interviews with GRC implementation stakeholders; framework of implementation characteristics | Integrity of the data/evidence GRC systems produce; software design faults. Neither appears in the text. The authors call GRC systems "still in their infancy". | We study faults *inside* the application that corrupt evidence, and test a remedy |
| 2 | Spanaki & Papazafeiropoulou (2016), *Inf. Syst. Management* 33(4), 302–315, doi:10.1080/10580530.2016.1220214. Abstract level. | Adoption lifecycle; value drivers (integration, optimisation, information) | Whether "information" as a value driver is trustworthy | Makes the trustworthiness of GRC information the object of design |
| 3 | Racz, Weippl & Seufert (2010), LNCS 6109, 106–117, doi:10.1007/978-3-642-13241-4_11. Abstract level; full text refused (403). | Definition and frame of reference for integrated GRC research | Artifact design and evaluation | Contributes artifact-level design knowledge within that frame |
| 4 | Arena, Arnaboldi & Azzone (2010), *AOS* 35(7), 659–675, doi:10.1016/j.aos.2010.07.003. Abstract level. | ERM dynamics: rationalities, experts, technologies | How a technology's design can distort risk information | Opens the "technology" element at design level |
| 5 | Crosby & Wallach (2009), USENIX Security, 317–334. **Full text read.** | Efficient tamper-evident logs with auditors | Integration with business workflows; other failure types (fabrication, silent failure, overwrite) | Tamper-evidence is one principle among several. We also inherit its **boundary** (see A5) |
| 6 | Botha & Eloff (2001), *IBM Syst. J.* 40(3), 666–682, doi:10.1147/sj.403.0666. PDF obtained, but it is a scan with no text layer, so abstract level only. | SoD enforcement in workflow access control; static vs dynamic SoD | RCSA approval semantics; UI-only enforcement as a failure | Server-enforced maker-checker on risk approvals, tested against a baseline that lacked it |
| 7 | Alles, Brennan, Kogan & Vasarhelyi (2006), *IJAIS* 7(2), 137–161, doi:10.1016/j.accinf.2005.10.004. Abstract level. | Continuous monitoring of business process controls (Siemens pilot) | Integrity of the monitoring/GRC tool itself | Asks who assures the assurance system |

Context, not competition:
- Meidell & Kaarbøe (2017), *BAR* 49(1), 39–55, doi:10.1016/j.bar.2016.10.005
- Mikes (2009), *MAR* 20(1), 18–40, doi:10.1016/j.mar.2008.10.005
- Hoyt & Liebenberg (2011), *JRI* 78(4), 795–822: ERM users carry roughly a 20% value premium. Used only to show significance, and correlational.

## A5. Contradictory evidence and reviewer objections (to be addressed in the paper)

| Objection | Evidence | Our response |
|---|---|---|
| "This is just secure software engineering" | Fail-safe defaults (Saltzer & Schroeder, 1975); OWASP ranks broken access control first among web application risks (the OWASP page could not be fetched; to verify) | **Partly true.** The novelty is the mapping to **assurance evidence**, and principles that have no generic counterpart: no fabricated ratings, computed (not declared) appetite exposure, defaults that must never overwrite decisions. We cite the generic principles as kernel theory rather than claim them. |
| "Tamper-evidence is overstated" | Crosby & Wallach: integrity requires external auditors who hold commitments | **Valid.** ERMA-GRC's HMAC chain is held by the API server, so an insider with the key and the file could rewrite the chain. We will state this boundary and propose external anchoring as future work. |
| "Integrity does not equal good risk management" | Power (2009, 1997); Cox (2008) | **Agreed.** Assurance integrity is a **necessary, not sufficient** condition. We will not claim better risk outcomes. |
| "One design does not fit all firms" | Mikes & Kaplan (2015) | Our principles concern evidence integrity, which is plausibly context-independent. Configurability (bands, currency) addresses part of this. Generalisability remains a limitation. |
| "Single case, authors built it, AI did much of it" | Methodological | Disclosed (COPE). Mitigated by a pre-registered scenario protocol, a public baseline (git history) and reproducible scripts. |
| "Baseline is a strawman" | The baseline was a real deployed system and shipped as production. Its faults were not created for the study. | We will show the audit predates the redesign (git timestamps) and was not tuned. We will not compare against commercial products. |

## A6. Gap verdict

- **Genuine and relevant:** yes, on the evidence reached. GRC IS research has not studied the integrity of the evidence these systems produce. Mechanism research does not address GRC semantics.
- **Significant:** boards, auditors and regulators rely on GRC records as evidence. Corrupted evidence defeats the purpose of the system.
- **Not already addressed:** not found, but **coverage is incomplete** (see A2).
- **Feasible:** yes. The baseline and the artifact both exist and can be run.
- **Defensible contribution:** yes, if claims stay at the level of a taxonomy, design principles and a technical evaluation.
- **Not merely a missing implementation:** correct. The contribution is design knowledge, not the software.

**Before submission, please run this search in Scopus or Web of Science through your institution and tell me about any hits:**
```
TITLE-ABS-KEY(("governance, risk and compliance" OR "GRC" OR "enterprise risk management" OR "risk register" OR "compliance management system")
  AND ("data integrity" OR "data quality" OR "information quality" OR "trustworth*" OR "audit trail" OR "tamper*" OR "segregation of duties" OR "design principle*" OR "design science"))
```

---

# Part B: Gate 3 proposal (research questions, objectives, contributions)

## B1. Research objective

To develop and evaluate design knowledge that keeps GRC information systems from corrupting the assurance evidence they produce.

## B2. Research questions

- **RQ1:** Which design failures in a GRC information system compromise the integrity of the assurance evidence it produces?
- **RQ2:** Which design principles, grounded in established kernel theories, address these failures?
- **RQ3:** To what extent does an instantiation of these principles (ERMA-GRC) prevent the failures, compared with the original system, under controlled fault and misuse scenarios?

## B3. Failure taxonomy (RQ1), from the legacy-system audit of 1 November 2026

All items below are documented in the audit report (`docs/AUDIT_REPORT.md`). Several were reproduced live.

| Code | Failure mode | Examples observed in the baseline |
|---|---|---|
| F1 | **Fabricated assurance values** | Likelihood/impact derived from the row id `(id*7)%5+1`; canned risk statements; status defaulting to APPROVED; the same SLE on every row; audit log seeded with fake entries |
| F2 | **Decisions overwritten by defaults** | Every save forced `APPROVAL_STATUS='DRAFT'`, so approvals could never be stored |
| F3 | **Client-side or absent enforcement** | Role taken from a request header (no header meant full rights); any password accepted; an inactive user fell back to Administrator; any table writable |
| F4 | **Mutable, forgeable evidence trail** | Audit log in browser storage; anyone could forge entries through the API; in-memory log capped at 5,000; database trigger swallowing errors |
| F5 | **Silent failure reported as success** | Database errors returned 200/201 into an in-memory "shadow" store; errors shown as "no data"; DELETE reported success when nothing was deleted |
| F6 | **Fragmented system of record** | 11 modules saved only in the browser |
| F7 | **Destructive actions on fabricated records** | Delete buttons on invented rows sent DELETEs for real ids |

## B4. Candidate design principles (RQ2), following Gregor et al. (2020): aim, mechanism, rationale

| DP | Principle | Counters | Kernel theory |
|---|---|---|---|
| DP1 | **Evidence provenance:** every assurance value shown must come from a stored record; absence is shown explicitly ("Not rated"), never estimated | F1, F7 | Power (1997, 2009); Cox (2008) |
| DP2 | **Decision preservation:** defaults apply only to missing fields at creation; decisions change only through authorised state transitions | F2 | Saltzer & Schroeder (1975), fail-safe defaults |
| DP3 | **Server-enforced, identity-bound separation of duties:** deny by default; a maker cannot be the checker, for any role | F3 | Botha & Eloff (2001); Saltzer & Schroeder (complete mediation) |
| DP4 | **Tamper-evident, actor-bound evidence trail with user-visible verification** (boundary: no external anchoring) | F4 | Schneier & Kelsey (1999); Crosby & Wallach (2009) |
| DP5 | **Fail-visible operation:** no success without a durable commit; failures are surfaced, not masked | F5 | Saltzer & Schroeder (fail-safe) |
| DP6 | **Single authoritative system of record** | F6 | Enterprise-systems view (Spanaki & Papazafeiropoulou, 2016) |
| DP7 | **Computed, not declared, assurance metrics:** appetite exposure and KRI status are derived from data and rules, not typed in | F1 | Vasarhelyi et al. (2004); Cox (2008) |

## B5. Expected contributions (claimed only to the level the evidence will support)

1. **A taxonomy** of seven assurance-integrity failure modes in GRC information systems, derived from a real system (RQ1).
2. **Seven design principles**, a nascent design theory per Gregor & Jones (2007), each linked to failures and kernel theory (RQ2).
3. **An instantiation (ERMA-GRC) plus a reusable scenario-based evaluation protocol**, with results against the baseline (RQ3).

**Explicitly not claimed:**
- better risk outcomes
- user acceptance
- superiority over commercial GRC products
- novel cryptographic or access-control mechanisms

## B6. Preview of Gate 4 (method), for orientation only; it needs its own approval

- **Approach:** DSR following Peffers et al. (2007), evaluated with FEDS' "technical risk and efficacy" strategy (artificial, summative).
- **Experiment:**
  - For each failure mode F1–F7, define two to four misuse or fault scenarios **before running anything**.
  - Run each scenario against (a) the baseline, which is the legacy system at commit `c371526^` and is preserved in git, and (b) ERMA-GRC.
  - Record pass or fail with captured evidence (HTTP responses, stored rows, screenshots).
- **Supporting evidence:** existing regression suites (API tests, end-to-end suites) and a dependency audit.
- **Reproducibility:** the scenario scripts are released with the repository.

## B7. Changes to the plan made during this gate

- **Track:** the paper will name **Track 1** on the full paper. The call says multiple papers must be submitted separately and does not mention one paper in two tracks. Please confirm with the organisers whether one paper may be listed under two tracks. Otherwise, I suggest the **full paper in Track 1** and the **abstract in Track 7**, re-angled to digital platforms. Submitting essentially the same work twice could breach the venue's rules, so the abstract must be a distinct framing if it goes to a different track.
- **Evidence-register corrections:**
  - Schneier & Kelsey is *ACM TISSEC* **2(2)**, 159–176, not 1(3).
  - Hevner et al. pages are 75–106 per Crossref.
  - Gregor & Jones (2007): the Crossref author order is unusual; cite as published on the journal page.

## B8. Your actions

1. **Approve Part A (gap) and Part B (RQs, objectives, contributions)**, or tell me what to change.
2. **Run the Scopus/WoS string in A6** if you can, and send me any relevant hits.
3. **Read the COPE page in your browser** and confirm it matches Gate 1 §2: no AI authorship; disclose the tool and how it was used in Methods; authors are fully responsible.
4. **Confirm the track question in B7** with the organisers, or accept my suggestion.
