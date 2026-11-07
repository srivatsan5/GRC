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

The study follows design science research. The audit produced a taxonomy of seven failure modes. Each was matched to a design principle grounded in established theory: integrity models, fail-safe defaults, complete mediation, separation of duties, tamper-evident logging and the critique of ritualised assurance. The principles were instantiated in a new system, ERMA-GRC. Both systems were then run against identical stored data in 23 scenarios, whose protocol was time-stamped in the project repository before execution. Eighteen scenarios derive from the audited failures, four test the principles beyond them, and one was expected to fail. Every deviation from the protocol is reported.

**Findings**

The original system prevented the failure in 4 of the 18 audit-derived scenarios; ERMA-GRC prevented it in all 18. ERMA-GRC accepted no unauthenticated writes, rejected self-approval, recorded audit entries only under the signed-in identity, detected an edited audit entry and returned errors instead of false successes. It also prevented 3 of the 4 failures in the scenarios beyond the audit, including a race between two simultaneous approval decisions, and every stored-state outcome was read from the database stand-in, not from what either system reported. Two failures of the new design are reported with equal weight. First, a key risk indicator's status was computed correctly in the interface but could be declared by a client calling the server directly. Second, an insider holding the audit key could rewrite the evidence trail undetected after a restart. The principles also depend on one another: separation of duties relies on the integrity of the audit trail, and a rule enforced only in the client offers no assurance.

**Originality/Value**

The study treats assurance integrity as a design property of GRC information systems rather than an organisational outcome. It contributes three things: a failure taxonomy derived from a real system, seven design principles with two testable propositions toward a nascent design theory, and a reusable scenario protocol. Auditors and buyers can use the principles as a review checklist. The documented boundaries point to future work: externally anchored audit trails, server-side computation of every assurance metric, and evaluation with practitioners.

**Keywords:** assurance integrity; governance, risk and compliance; design science research; enterprise risk management; audit trail; separation of duties

---

## 1 Introduction

Organisations increasingly record their risk management in governance, risk and compliance (GRC) information systems. A risk register, a heatmap, an approved assessment and an audit trail are the evidence that boards, auditors and regulators rely on to judge whether risks are controlled (Power, 1997). Such a system is valuable only if what it shows is true.

This study began with a code and runtime audit of an existing GRC application documented as production-ready. The software produced assurance evidence with no underlying record. It invented ratings for unrated risks from record identifiers or default loss values, reset every approval to draft on the next save, kept an "immutable" audit trail in the browser where anyone could rewrite it, and reported failed database writes as successes. These were ordinary design decisions, not exotic security flaws, and each turned the system into a source of risk rather than a control over it.

Within the literature reached by our search, this problem is unaddressed. GRC information systems research has studied adoption and value (Papazafeiropoulou & Spanaki, 2016; Racz et al., 2010), enterprise risk management research warns that assurance can decay into ritual (Power, 2009), and the relevant mechanisms are understood in generic form (Clark & Wilson, 1987; Saltzer & Schroeder, 1975). We found no study connecting application design failures to corrupted assurance evidence or testing design principles against a real system.

We therefore ask which design failures in a GRC information system compromise the integrity of its assurance evidence (RQ1); which theory-grounded design principles address them (RQ2); and to what extent an instantiation of these principles prevents the failures compared with the original system (RQ3). Using design science research, we contribute a failure taxonomy, seven design principles and a time-stamped scenario evaluation of the artifact, ERMA-GRC. Sections 2 to 6 present the literature, method, results, implications and limitations.


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
