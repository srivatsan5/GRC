# Gate 1: Research problem and scope validation

**Project:** a LEAD-2027 paper on the ERMA GRC system
**Date:** 6 November 2026 · **Submission deadline:** 10 November 2026 (4 days)
**Status:** awaiting your approval. Nothing beyond this gate has been written.

---

## 0. Summary

**My assessment:** a paper that says "we built a GRC tool" would not survive review. A missing implementation is not a research gap. There is a stronger, evidence-backed problem that this project is unusually well placed to study:

> GRC systems exist to produce *assurance*: trustworthy evidence that risks are rated, controls approved and actions recorded. Our audit of the original version of this system found that the software itself was silently manufacturing that evidence:
> - invented risk scores
> - approvals defaulting to "Approved"
> - approval status that could never be saved
> - a forgeable, browser-only audit log
> - database failures reported as success
>
> **The research problem:** how should GRC information systems be designed so that the assurance evidence they produce is trustworthy?

**Recommended framing:** a Design Science Research (DSR) study that does three things:
1. Derives a taxonomy of *assurance-integrity failures* from a forensic audit of a real GRC system.
2. Turns them into design principles.
3. Instantiates and tests those principles in the redesigned system (ERMA GRC).

**Recommended submission:** Track 1 (Information Systems: Theory and Practice → Digital Ethics and Policy: *Regulation and Compliance*), as a **full paper of type "ongoing research (design science)"**.

**Main weakness, stated plainly:** the evaluation so far is technical (automated tests and controlled experiments), not with real users in real organisations. The paper must claim only what that evidence supports.

---

## 1. Venue requirements (from the two templates you attached)

| Item | Full paper | Abstract |
|---|---|---|
| Length | About 2,000 words, excluding references | 500 words maximum, across 4 sections |
| Abstract | Up to 500 words: Purpose / Design-Methodology-Approach / Findings / Originality-Value | Purpose 100–125 · Design 100–125 · Findings 150–175 · Originality 75–100 |
| Sections | 1 Introduction 300–400 · 2 Literature Review 500–600 (2.1–2.4) · 3 Methodology 300–400 (3.1–3.4) · 4 Results and Discussion 500–600 · 5 Implications 150–200 · 6 Conclusion, Limitations and Future Research 200–250 | — |
| Header fields | Title, Name of the Track, Type of Submission | Same |
| Format | Times New Roman 12 pt, single spacing, 1-inch margins, page numbers bottom centre | Times New Roman 12 pt, single spacing |
| Tables/figures | 5 combined, maximum | None allowed. No references or equations either |
| Citations | APA 7th edition | None |
| Keywords | 4–6 | 4–6, separated by semicolons |
| Authors | Template shows no author block. Treat the paper as anonymous; names are added after acceptance | "Add author name(s)… after acceptance" |
| Other | File as .docx or PDF; plagiarism below 10%; COPE position on generative AI | Same |

The 2,000-word limit is tight. The paper can carry **one** clear contribution, and only a few studies can be discussed in depth.

---

## 2. COPE compliance plan (applies to every later gate)

COPE's position "Authorship and AI tools" (February 2023), as quoted by secondary sources (I could not open the COPE page itself from this environment):
1. **AI tools cannot be authors**, because they cannot take responsibility for the work.
2. **Authors must disclose**, in the Methods or a similar section, **which AI tool was used and how**: for collecting or analysing data, and for preparing text, figures and tables.
3. **Authors remain fully responsible** for all content, including AI-produced parts, and are liable for any breach of publication ethics.

What this means for this paper:

| Requirement | How we will meet it |
|---|---|
| No AI authorship | Only human authors are listed. Claude is not an author or co-author. |
| Disclosure, in Methods (§3) | A paragraph stating that Claude (Anthropic), an AI assistant, was used for (a) the code-and-runtime audit of the legacy system, (b) implementing most of the redesigned software under the authors' direction, (c) the literature search, and (d) drafting text. You fill in the model/version and dates, and the authors' own roles. |
| Verification | You personally check every citation against its original source, and every number against the repository before submission. I mark any claim I could not verify from a primary source. |
| Accountability | The authors must be able to explain and defend every sentence. This is also why I recommend you **rewrite the final text in your own words**: AI-drafted prose can raise similarity and AI-detection flags, and the venue requires plagiarism below 10%. |
| Honesty about AI's role in the artifact | Because AI did much of the audit and implementation, the paper must say so. It is also a **validity threat**, and the paper will discuss it in §6. |

**Your decision:** COPE requires the authors to own the work, so the human authors need to have done (or be able to defend) the design decisions, the analysis and the conclusions. If that is not true for some part, we must narrow the claims rather than hide it.

---

## 3. Understanding the research problem

**Historical development (brief):**
- **ERM as a management practice.** Frameworks such as COSO ERM and ISO 31000 standardised the vocabulary. Field research shows ERM is enacted very differently across firms (Arena, Arnaboldi & Azzone, 2010; Mikes & Kaplan, 2015). Critics argue ERM can become ritual compliance that offers limited real protection (Power, 2009). Power's earlier *Audit Society* (1997) argues that verification practices often produce *auditability* rather than real assurance.
- **GRC as an information-systems topic.** Racz, Weippl & Seufert (2010) gave the first scientifically grounded definition of integrated GRC and a research frame. Spanaki & Papazafeiropoulou (2015, 2016) studied GRC IS implementation and value from an enterprise-systems perspective. Most of this work is about **definition, adoption and value**, not about the **integrity of the evidence these systems produce**.
- **Technical mechanisms.** Secure and tamper-evident logging (Schneier & Kelsey, 1999; Crosby & Wallach, 2009), separation of duties in workflow systems (Botha & Eloff, 2001), and continuous auditing and monitoring (Vasarhelyi, Alles & Kogan, 2004) each solve **one** mechanism, usually in isolation and outside GRC/ERM applications.
- **Scoring practice.** Cox (2008) shows that risk matrices have poor resolution and can rank risks wrongly. That bears directly on how a GRC system should present scores, including showing "not rated" honestly.

**The problem, sharpened:** in practice, GRC software is trusted as a system of record for assurance. Yet the literature treats it as a neutral container. It rarely asks how *application-level* design faults could corrupt the evidence it holds, such as:
- defaults that overwrite decisions
- fabricated fallback values
- controls enforced only in the user interface
- failures reported as success

Our audit documents such faults concretely.

---

## 4. Candidate framings considered

| Framing | Verdict | Why |
|---|---|---|
| A. "Design and implementation of an ERM/GRC platform" | **Reject** | A missing implementation, not a research gap. Many commercial and open-source tools exist. |
| B. "AI-powered risk management" | **Reject** | The system does not use AI for risk analysis. Claiming it would be false. |
| C. **Assurance integrity in GRC information systems: failure taxonomy, design principles, instantiation and technical evaluation (DSR)** | **Recommend** | Grounded in real evidence (a documented forensic audit plus the redesign). Addresses a gap that early searches suggest is under-studied. Uses established DSR methods (Hevner et al., 2004; Peffers et al., 2007; Gregor, Chandra Kruse & Seidel, 2020; Venable, Pries-Heje & Baskerville, 2016). |
| D. Tools demo paper of ERMA GRC | Fallback | Allowed by the call and lowest risk, but a weaker contribution. |
| E. Literature review of GRC IS | Not recommended | Four days is too short to do a proper PRISMA-style review, and an informal one cannot be called systematic. |

**Proposed working title:**
> **When the Risk System Becomes the Risk: Design Principles for Assurance Integrity in Governance, Risk and Compliance Information Systems**

Alternatives:
- *Assurance Integrity by Design: Evidence from Re-engineering an Enterprise Risk Management Platform*
- *Trustworthy by Construction? Designing GRC Information Systems That Cannot Manufacture Their Own Evidence*

---

## 5. Preliminary closest studies (full analysis at Gate 2)

| Study | What it does | What it does not address | How our study differs |
|---|---|---|---|
| Racz, Weippl & Seufert (2010), IFIP CMS, LNCS 6109 | Defines integrated GRC and builds a research frame | Design of GRC software; integrity of its evidence | We study faults in a GRC application that corrupt assurance evidence |
| Spanaki & Papazafeiropoulou (2015, *Information Systems Frontiers*; 2016, *Information Systems Management*) | GRC IS characteristics, adoption lifecycle, value drivers, from expert views | Faults inside the software; technical evaluation | Artifact-level design principles, tested |
| Arena, Arnaboldi & Azzone (2010), *Accounting, Organizations and Society* | ERM as organisational dynamics; "technologies" as one element | How the technology itself can distort risk information | Opens the "technology" element at the design level |
| Power (2009), *AOS*; Power (1997) | Critique: ERM and audit can be ritual and produce auditability rather than assurance | Concrete design responses | Turns the critique into testable design principles |
| Crosby & Wallach (2009), USENIX Security; Schneier & Kelsey (1999), ACM TISSEC | Cryptographic tamper-evident logging | Integration into GRC workflows; other failure types | Treats tamper-evidence as one of several assurance principles inside an ERM system |
| Botha & Eloff (2001), *IBM Systems Journal* | Separation-of-duties enforcement in workflow | ERM/RCSA context; client-side enforcement failures | Server-enforced maker-checker in an RCSA workflow |
| Cox (2008), *Risk Analysis* | Limits of risk matrices | Software presentation of unrated or invalid scores | A principle against fabricated scores; configurable bands |

**Gap status: provisional.** Searches so far found no peer-reviewed study of how GRC/ERM application design corrupts the assurance evidence those systems hold. Before calling the gap genuine, Gate 2 needs more targeted searches covering:
- ACM DL, IEEE, AISeL, Scopus-indexed venues
- "risk register data quality"
- "compliance software defects"
- "information quality in ERM"
- "assurance" plus "information systems design"

If a close prior study turns up, I will tell you and reframe.

---

## 6. Scope

**In scope:**
- **The legacy system:** one GRC/ERM web application, audited on 1 November 2026. The audit covered code, runtime behaviour, the database interface, security and deployment.
- **The redesign:** the redesigned artifact (ERMA GRC) and its technical evaluation:
  - 94 automated API tests
  - 3 browser end-to-end suites: core flow, all routes on real data, security
  - a database install verified on Oracle Database 23ai
  - a dependency vulnerability audit
- **Evaluation type:** artificial, summative evaluation (FEDS) of whether each design principle is met.

**Out of scope, and stated as limitations:**
- effectiveness in real organisations
- user acceptance
- real-world loss reduction
- generalisation beyond one case

**Possible strengthening within the deadline (your call):** a short **expert walkthrough** with 3–5 risk or audit professionals who rate the design principles. It needs real participants, consent, and honest reporting even if the results are negative. It is optional, and I would not invent it.

---

## 7. Risks and weaknesses (not hidden)

1. **Single case, built by the authors.** There is a risk of confirmation bias, and the results do not generalise. The paper must frame its contribution as exploratory design knowledge.
2. **AI performed much of the audit and implementation.** This must be disclosed (COPE) and discussed as a validity threat.
3. **No naturalistic evaluation yet.** We cannot claim the system improves risk outcomes.
4. **The evidence base needs primary-source checks.** Several sources so far are known only from abstracts and metadata. Gate 2 will check full texts where accessible. Paywalled ones you may need to check through your library.
5. **No Scopus or Web of Science access.** My searches use a general web search engine. The search log will say so, and we will not call the review "systematic".
6. **Time.** With four days left, the gates have to move quickly, about one per half-day.
7. **Anonymity.** Naming "ERMA GRC" is fine if the product name is not publicly tied to the authors. Otherwise, use "the artifact" in the review copy.

---

## 8. Search log (Gate 1, 6 November 2026)

- **Tool:** a general web search engine that indexes publisher pages, repositories (RePEc, institutional repositories), Google Scholar-like listings and USENIX/ACM pages. No direct access to Scopus, WoS, IEEE Xplore or ACM DL. publicationethics.org is blocked from this environment.
- **Search strings used:**
  - "integrated governance risk compliance GRC information systems frame of reference"
  - "enterprise risk management information systems design science research artifact evaluation"
  - "risk and control self-assessment RCSA effectiveness empirical"
  - "tamper-evident audit logging hash chain"
  - "Mikes Kaplan contingency ERM"
  - "segregation of duties maker-checker four-eyes information systems"
  - "What's wrong with risk matrices"
  - "GRC IS adoption Papazafeiropoulou Spanaki"
  - "organizational dynamics of ERM"
  - "secure audit logs computer forensics"
  - "FEDS design science evaluation"
  - "value of enterprise risk management Hoyt Liebenberg"
  - "continuous auditing continuous monitoring"
  - "RegTech systematic literature review"
  - "ERM barriers SMEs emerging economies"
  - "design science GRC platform prototype evaluation"
  - "Power risk management of nothing"
  - "key risk indicators empirical"
  - "risk register information quality"
  - "Gregor anatomy of a design principle"
  - "Peffers DSRM"
  - "Power audit society"
  - "GRC audit trail tampering research"
  - "Hevner design science"
- **Inclusion (provisional):** peer-reviewed, or foundational books and standards, on ERM/GRC as practice or IS; on mechanisms (logging, SoD, monitoring); or on DSR method.
- **Exclusion:** vendor marketing, AI-generated wiki mirrors, unreviewed preprints used as evidence. Preprints may be mentioned only as recent context, labelled as preprints.

## 9. Evidence register (initial)

| # | Claim | Source | Verified level |
|---|---|---|---|
| E1 | First scientifically grounded definition of integrated GRC and a research frame | Racz, Weippl & Seufert (2010), LNCS 6109, 106–117, doi:10.1007/978-3-642-13241-4_11 | Bibliographic and abstract |
| E2 | GRC IS literature focuses on implementation, adoption and value; adoption-success analysis is limited | Spanaki & Papazafeiropoulou (2015, ISF 18(6), 1251–1263; 2016, ISM 33(4), 302–315) | Abstracts |
| E3 | ERM is enacted differently across organisations; technologies are one of its elements | Arena, Arnaboldi & Azzone (2010), AOS 35(7), 659–675 | Abstract |
| E4 | One-size ERM guidelines are themselves a risk; contingency theory of ERM | Mikes & Kaplan (2015), J. Applied Corporate Finance 27(1), 37–40 | Abstract |
| E5 | ERM offers limited protection; risk appetite poorly conceived | Power (2009), AOS 34(6–7), 849–855, doi:10.1016/j.aos.2009.06.001 | Abstract |
| E6 | Risk matrices: poor resolution, errors, ambiguity | Cox (2008), Risk Analysis 28(2), 497–512, doi:10.1111/j.1539-6924.2008.01030.x | Abstract |
| E7 | Hash-chain logs make tampering detectable; auditing must be frequent | Schneier & Kelsey (1999), ACM TISSEC 1(3), 159–176; Crosby & Wallach (2009), USENIX Security, 317–334 | Abstracts and slides |
| E8 | Separation of duties enforced in workflow systems | Botha & Eloff (2001), IBM Systems Journal | Title only. **Must verify** |
| E9 | DSR method and evaluation strategy | Hevner et al. (2004) MISQ 28(1) 75–105; Peffers et al. (2007) JMIS 24(3) 45–77; Venable et al. (2016) EJIS 25(1) 77–89; Gregor et al. (2020) JAIS 21(6) 1622–1652 | Bibliographic and abstract |
| E10 | ERM users are valued about 20% higher (insurers) | Hoyt & Liebenberg (2011), J. Risk & Insurance 78(4), 795–822 | Abstract. Context only (shows significance, not causality) |
| E11 | Legacy system faults: fabricated scores, approval defaults, browser-only data, forgeable audit log, silent failure, no authentication | Project audit report (docs/AUDIT_REPORT.md, 1 Nov 2026), with reproduction notes | Primary (our own evidence) |
| E12 | Redesign test results (94 API tests; e2e suites; install on Oracle 23ai) | Repository change logs, CI | Primary. Numbers to re-run before submission |

---

## 10. Decisions needed from you (Gate 1)

1. **Framing:** approve C (assurance-integrity DSR paper), or choose D (tools demo)?
2. **Submission:** full paper (my recommendation) or abstract only? I can also produce both.
3. **Track:** Track 1 → Digital Ethics and Policy: Regulation and Compliance (my recommendation), or Track 7 (Digital Platforms and Transformation)?
4. **Title:** the proposed one, an alternative, or your own?
5. **Authors and roles:** who are the human authors, and what did each do? This is needed for the COPE disclosure.
6. **Optional expert walkthrough:** can you get 3–5 risk/audit professionals for a 30-minute session before 9 November? If not, we report a technical evaluation only.
7. **Name:** is "ERMA GRC" the name to use in the paper, and is it publicly linked to you (anonymity)?
