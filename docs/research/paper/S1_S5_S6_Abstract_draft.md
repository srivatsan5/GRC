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

This is a design science study. We read the code of an existing risk management application, ran it, and recorded seven distinct ways in which it failed. Each failure was traced to theory that already explains it, from integrity models, fail-safe defaults and complete mediation to separation of duties, tamper-evident logging and the critique of audit as ritual, and a design principle was drawn from that theory. We built a new system, ERMA-GRC, on these principles. The old and new systems then faced 23 scenarios over the same stored data, under a protocol time-stamped in the project repository beforehand. Eighteen scenarios come from the audit, four go beyond it, and one was meant to fail. All deviations are reported.

**Findings**

There are 18 cases altogether that may have been created as a result of an audit test but, through the old system, the prevention of the security issue took place in 4 of these. On the contrary, ERMA-GRC managed to prevent the security breach in all 18 cases. ERMA-GRC prevents the write actions in the sessions, where the user does not have the ability to approve his record, stamps the audit trails lines in the logged-in user, but does not put down his name while detecting edit on the entry and indicating unavailability of the database as a failure. In addition to the above criteria in audit test, ERMA-GRC managed to prevent all failures except 3 out of the 4 cases, where it managed to prevent two simultaneous approvals for one record in 2 times. Storage results come from the simulation of the database and not from the actual system. The two cases where the new design was not able to block the security breach have been listed below. Although the risk indicator shows the correct state of the client on the screen, it can still connect to the server and change the state of the screen to anything it likes. Also, the person that has access to the audit key has the opportunity to manipulate the audit trails when offline and without being caught once the server restarts. Principles depend on each other because the reliability of the audit depends on the separation of duties.

**Originality/Value**

We treat the integrity of assurance evidence as something a GRC system's design can protect or destroy, rather than as an organisational outcome. This paper provides a taxonomy of failures observed in a working system, seven principles together with two testable propositions towards a design theory, and a scenario protocol that others can rerun. They may utilize these principles in the form of actions. These two problems identified in the design lead to the three exercises as follows: external anchoring of the audit trail from the system; calculation of the entire metrics from the server, and the test of the principles with the practitioners.

**Keywords:** assurance integrity; GRC information systems; design science research; enterprise risk management; tamper-proof audit trail; separation of duties

---

## 1 Introduction

The risks, the risk registers, the risk map and the assessments are normally in governance, risk and compliance (GRC) information systems. This is enough evidence for risk management for the boards, auditors and the regulators. (Power, 1997). The evidence is based on its documentation.

We started the research with an audit of the code and run-time behaviour of a GRC application documented as ready for deployment. The application displayed assurance with nothing behind it. Unrated risks received scores computed from the related record's identifier or a default loss value. Any further save reverted a signed-off assessment to draft status. The claimed immutable audit trail was stored in the browser, where any user could tamper with it. In case of failing to write data, the user was guaranteed that everything was all right. Design choices led to the transformation of the system into an agent of the dangers rather than the instrument of mitigating them.

Regarding literature covering the issue, there is none in our review. GRC IS literature studies reasons for introducing the systems and the advantages they provide to the organizations (Papazafeiropoulou & Spanaki, 2016; Racz et al., 2010). ERM literature states that assurance can become a ritual activity (Power, 2009). Proper security literature suggests solutions but just for the general case (Clark & Wilson, 1987; Saltzer & Schroeder, 1975). There is no research related to mistakes in the design of application software and corruption of assurance information and verification of design ideas in practice.

We therefore ask which design failures in a GRC information system compromise the integrity of its assurance evidence (RQ1); which theory-grounded design principles address them (RQ2); and to what extent an instantiation of these principles prevents the failures compared with the original system (RQ3). Our design science research approach yields a failure taxonomy, seven principles and a new artifact, ERMA-GRC, tested through time-stamped scenarios. The next section covers the move from literature review through to method, results, implications and limitations.


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
| Abstract: Design | 119 | 100–125 |
| Abstract: Findings | 246 | 150–175 |
| Abstract: Originality | 104 | 75–100 |
| Abstract total | 579 | ≤ 500 |
| §1 Introduction | 326 | 300–400 |
| §5 Implications | 153 | 150–200 |
| §6 Conclusion | 200 | 200–250 |
