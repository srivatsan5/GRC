# Draft for approval: Abstract, §1 Introduction, §5 Implications, §6 Conclusion

*Gate 6, sections 4–7 of 7. Numbers come from `docs/research/evaluation/RESULTS.md`. The abstract contains no references, tables or equations, as both templates require.*

---

**Title:** When the Risk System Becomes the Risk: Design Principles for Assurance Integrity in Governance, Risk and Compliance Information Systems

**Name of the Track:** Track 1 – Information Systems: Theory and Practice (Digital Ethics and Policy: Regulation and Compliance)

**Type of Submission:** Ongoing research (design science research; artifact and technical evaluation completed, naturalistic evaluation pending)

## Abstract

**Purpose**

Boards, auditors and regulators rely on governance, risk and compliance (GRC) information systems for evidence that risks are identified, rated, approved and controlled. Research on these systems has examined their adoption and value. It has not asked whether the evidence they present can itself be trusted. A forensic audit of a deployed risk management system found that the software invented risk ratings, discarded approvals, accepted unauthenticated authority and reported failed database writes as successes. This study asks which design failures compromise the integrity of assurance evidence. It then asks which design principles prevent them, and how well an instantiation of those principles performs against the original system.

**Design/Methodology/Approach**

The study follows design science research. A code and runtime audit of the deployed system produced a taxonomy of seven failure modes. Each failure mode was matched to a design principle grounded in established theory: fail-safe defaults, complete mediation, separation of duties, tamper-evident logging and the critique of ritualised assurance. The principles were instantiated in a new system, ERMA-GRC. The evaluation compared the original system with ERMA-GRC in 23 scenarios that were pre-registered before execution and run once each against identical stored data. Eighteen scenarios came from the audited failures, four tested the principles beyond them, and one was expected to fail.

**Findings**

The original system prevented the failure in 4 of the 18 audit-derived scenarios. ERMA-GRC prevented it in all 18. Each outcome was read from the stored data, not from what the system reported. It accepted no unauthenticated writes, rejected self-approval, recorded audit entries only under the signed-in identity, detected an edited audit entry, and returned errors instead of false successes. In the generalisation scenarios, ERMA-GRC prevented 3 of 4 failures and the original system none. Two failures of the new design are reported with equal weight. First, a key risk indicator's status was computed correctly in the user interface but could be declared by a client calling the server directly. Second, an insider holding the audit key could rewrite the evidence trail undetected after a restart. The results also show that the principles depend on one another. Separation of duties relies on the integrity of the audit trail, and a principle enforced only in the client offers no assurance.

**Originality/Value**

The study treats assurance integrity as a design property of GRC information systems rather than an organisational outcome. It contributes a failure taxonomy derived from a real system, seven design principles that form a nascent design theory, and a reusable, pre-registered scenario protocol. Practitioners and auditors can use the principles as a procurement and review checklist. The documented boundaries point to future work: externally anchored audit trails, server-side computation of every assurance metric, and evaluation with practitioners.

**Keywords:** assurance integrity; governance, risk and compliance; design science research; enterprise risk management; audit trail; segregation of duties

---

## 1 Introduction

Organisations increasingly record their risk management in GRC information systems. A risk register, a heatmap, an approved assessment and an audit trail are no longer working notes. They are the evidence that boards, external auditors and regulators rely on when they judge whether risks are understood and controlled (Power, 1997). The value of such a system therefore depends on more than its features. It depends on whether what it shows is true.

This study began with a forensic audit of a GRC system that was already deployed. The audit found that the software produced assurance evidence without any underlying record:
- ratings derived from row numbers;
- approvals that every subsequent save silently reset;
- an "immutable" audit trail kept in the browser, which anyone could rewrite;
- database failures reported to users as successful saves.

None of these were exotic security flaws. They were ordinary design decisions, and each one turned the system into a source of risk rather than a control over it.

The literature does not address this problem. GRC information systems research has defined the field and studied adoption and value (Papazafeiropoulou & Spanaki, 2016; Racz et al., 2010). Organisational research on enterprise risk management warns that assurance can decay into ritual (Power, 2009). The relevant mechanisms are well understood, but only in generic form (Saltzer & Schroeder, 1975; Schneier & Kelsey, 1999). No study we found connects application design failures to corrupted assurance evidence, or tests design principles against a real system.

This study addresses three research questions:
- **RQ1:** Which design failures in a GRC information system compromise the integrity of the assurance evidence it produces?
- **RQ2:** Which design principles, grounded in established kernel theories, address these failures?
- **RQ3:** To what extent does an instantiation of these principles prevent the failures, compared with the original system?

We answer them through design science research. The study contributes a failure taxonomy, seven design principles, and a pre-registered evaluation of the instantiated artifact, ERMA-GRC. Section 2 reviews the literature, Section 3 describes the method, and Section 4 reports and discusses the results. Sections 5 and 6 present the implications, limitations and future research.

---

## 5 Implications

**Theoretical implications.**
- The study recasts assurance integrity as a property of GRC system design. This adds a design perspective to research that has so far treated GRC systems through adoption and value.
- The principles are not independent. Separation of duties depends on the integrity of the evidence trail. Every principle holds only if it is enforced at the server.
- These relationships give the nascent design theory testable propositions.

**Practical implications.** GRC buyers, internal auditors and external auditors can turn the principles into review questions:
- Does the system show an unrated risk as unrated?
- Can an ordinary save overwrite an approval?
- Is authority taken from a verified session, or from what the client claims?
- Can users verify the audit trail, and is it anchored outside the vendor's control?
- Does a failed write ever appear as a success?

These questions can be tested in a demonstration before purchase, much as the scenarios here were.

**Societal implications.** Regulators and the public increasingly rely on compliance claims produced by software. Systems that cannot fabricate evidence make those claims more trustworthy. They also make accountability harder to evade.

---

## 6 Conclusion, Limitations and Future Research

**Conclusion.** This study asked how the design of a GRC information system can corrupt the assurance evidence it produces, and how to prevent it.
- An audit of a deployed system yielded seven failure modes.
- Seven principles, grounded in established theory, address those failure modes.
- ERMA-GRC, which instantiates the principles, prevented every audit-derived failure. The original system prevented four of eighteen.
- The two failures of the new design matter as much as its successes: a metric enforced only in the client, and an audit trail its key holder can rewrite.

**Limitations.**
- **Single case.** The evidence comes from one case, and the authors built the artifact and wrote the scenarios. Pre-registration and reporting every outcome reduce this bias but do not remove it.
- **Artificial evaluation.** The evaluation ran against a database stand-in, not against practitioners. Database-level claims rest on a separate install on Oracle Database 23ai.
- **Generative AI.** It assisted the audit, the implementation and the drafting, as disclosed in Section 3.
- **Literature coverage.** The literature search could not use Scopus or Web of Science.
- **No comparison with commercial products.** The study makes no claim about commercial GRC products.

**Future research.**
- Naturalistic evaluation with risk and audit professionals.
- Multiple-case studies across GRC products.
- Externally anchored audit commitments.
- Server-side computation of every assurance metric.
- Longitudinal study of whether integrity-preserving systems change how organisations use risk information.

---

**Word counts (body text):**

| Section | Words | Budget |
|---|---|---|
| Abstract: Purpose | 107 | 100–125 |
| Abstract: Design | 102 | 100–125 |
| Abstract: Findings | 159 | 150–175 |
| Abstract: Originality | 77 | 75–100 |
| Abstract total | 445 | ≤ 500 |
| §1 Introduction | 348 | 300–400 |
| §5 Implications | 183 | 150–200 |
| §6 Conclusion | 223 | 200–250 |

**New references in this part:** none. Every source cited here is already in §2's verified list.
