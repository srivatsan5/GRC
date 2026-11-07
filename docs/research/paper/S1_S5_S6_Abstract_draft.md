# Abstract, §1 Introduction, §5 Implications, §6 Conclusion

*Revised after the Gate 7 peer review (7 November 2026). Numbers come from `docs/research/evaluation/RESULTS.md`. The abstract contains no references, tables or equations, as both templates require.*

---

**Title:** When Software Fabricates Assurance: Seven Design Principles for Trustworthy Governance, Risk and Compliance Systems

**Name of the Track:** Track 1 – Information Systems: Theory and Practice (Digital Ethics and Policy: Regulation and Compliance)

**Type of Submission:** Ongoing research (design science research; artifact and technical evaluation completed, naturalistic evaluation pending)

## Abstract

**Purpose**

Boards, auditors and regulators rely on governance, risk and compliance (GRC) information systems for evidence that risks are identified, rated, approved and controlled. Research on these systems has examined their adoption and value. We found no study asking whether the evidence they present can itself be trusted. A code and runtime audit of an existing risk management application found that the software invented risk ratings, discarded approvals, accepted unauthenticated authority and reported failed database writes as successes. This study asks which design failures compromise the integrity of assurance evidence. It also asks which design principles prevent them, and how well an instantiation of those principles performs against the original system.

**Design/Methodology/Approach**

The study follows design science research.

**Findings**

The original system prevented the failure in 4 of the 18 audit-derived scenarios; ERMA-GRC prevented it in all 18.

**Originality/Value**

The study treats assurance integrity as a design property of GRC information systems rather than an organisational outcome.

**Keywords:** assurance integrity; governance, risk and compliance; design science research; enterprise risk management; audit trail; separation of duties

---

## 1 Introduction

We therefore ask which design failures in a GRC information system compromise the integrity of its assurance evidence (RQ1); which theory-grounded design principles address them (RQ2); and to what extent an instantiation of these principles prevents the failures compared with the original system (RQ3).


---

## 5 Implications

**Theoretical implications.** The study recasts assurance integrity as a design property of GRC systems and contributes components of a nascent design theory (Gregor & Jones, 2007): purpose and scope, constructs, seven principles and two testable propositions. P1: separation of duties is only as strong as the integrity of the evidence trail it reads. P2: an assurance rule enforced only in the client can be defeated by any authenticated client.

**Practical implications.** Before purchase, buyers and auditors can test whether an unrated risk is shown as unrated, whether an ordinary save can overwrite an approval, whether authority comes from a verified session, whether the audit trail is verifiable and anchored outside the vendor's control, and whether a failed write can ever appear as a success.

**Societal implications.** Regulators and the public increasingly rely on compliance claims produced by software. Systems that cannot fabricate evidence make those claims more trustworthy and accountability harder to evade.


---

## 6 Conclusion, Limitations and Future Research

This study asked how a GRC system's design can corrupt its assurance evidence, and how to prevent it. An audit yielded seven failure modes, addressed by seven theory-grounded principles. ERMA-GRC, which instantiates them, prevented every audit-derived failure; the original system prevented four of eighteen. Its two failures, a metric enforced only in the client and an audit trail its key holder can rewrite, are part of the contribution.

**Limitations.** The evidence comes from one case. The authors built the artifact and wrote the scenarios with an AI assistant involved in every stage, from audit to outcome coding; time-stamping the protocol and reporting every outcome reduce but do not remove this bias. The evaluation was artificial: both systems ran against a stand-in derived from ERMA-GRC's own test double, so concurrency and outage results depend on its fidelity, and the display scenarios lacked a rated risk as a positive control. The literature search lacked Scopus and Web of Science, and no commercial product was compared.

**Future research.** Next steps are naturalistic evaluation with practitioners, multiple-case studies across GRC products, externally anchored audit commitments, server-side computation of every assurance metric, and longitudinal study of how integrity-preserving systems change the use of risk information.


---

**Word counts (body text):**

| Section | Words | Budget |
|---|---|---|
| Abstract: Purpose | 110 | 100–125 |
| Abstract: Design | 100 | 100–125 |
| Abstract: Findings | 163 | 150–175 |
| Abstract: Originality | 79 | 75–100 |
| Abstract total | 452 | ≤ 500 |
| §1 Introduction | 301 | 300–400 |
| §5 Implications | 152 | 150–200 |
| §6 Conclusion | 200 | 200–250 |
