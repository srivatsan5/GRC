# Draft for approval: §2 Literature Review

*Gate 6, section 3 of 7. Every source below was checked against Crossref on 7 November 2026. Studies read only at abstract level are described no further than their abstracts allow. Word count excludes headings and Table 1.*

---

## 2 Literature Review

### 2.1 Key concepts

*Enterprise risk management* (ERM) is the organisation-wide identification, assessment, treatment and monitoring of risk. *Governance, risk and compliance (GRC) information systems* integrate these activities and keep their records (Racz et al., 2010). *Assurance* is the confidence those records give boards, auditors and regulators that risks are known and controlled. We define *assurance integrity* as the property that every assurance artefact a GRC system presents is either a recorded, attributable action or an explicit statement that no such record exists. Such artefacts include a rating, an approval, an exposure figure and an audit entry. Assurance integrity is therefore a property of the system's design, not of the risks it manages.

### 2.2 Previous studies

**ERM as practice.**
- Organisational research shows that ERM is enacted, not simply adopted. Arena et al. (2010) trace how risk rationalities, experts and technologies combine differently across firms.
- Mikes (2009) shows that risk functions differ in their "calculative cultures".
- Mikes and Kaplan (2015) argue that a single ERM template is itself a risk.
- Meidell and Kaarbøe (2017) show that the tools an ERM function builds over time shape how much it influences decisions.
- Power (1997) warns that verification rituals can produce auditability rather than assurance. Power (2009) calls ERM at its weakest a "risk management of nothing".

Together these studies treat technology as part of how risk is produced. Its design is therefore a legitimate object of study.

**GRC information systems.**
- Racz et al. (2010) offered the first research frame for integrated GRC.
- Papazafeiropoulou and Spanaki (2016) interviewed GRC experts and derived a framework of implementation characteristics: goals, stakeholders, critical success factors and barriers.
- Spanaki and Papazafeiropoulou (2016) added an adoption lifecycle and value drivers.

This stream asks how GRC systems are adopted and what value they deliver. It does not ask whether the evidence they produce can be trusted.

**Mechanisms (kernel theories).** Each mechanism the artifact relies on is well established, but generically:
- Fail-safe defaults and complete mediation (Saltzer & Schroeder, 1975).
- Separation of duties in workflow systems (Botha & Eloff, 2001).
- Tamper-evident logging: hash chains (Schneier & Kelsey, 1999), and history trees whose integrity depends on external auditors holding commitments (Crosby & Wallach, 2009).
- Continuous assurance, which monitors controls through analytics (Vasarhelyi et al., 2004; Alles et al., 2006). It takes the monitoring system's own integrity for granted.
- Risk scoring: Cox (2008) shows that risk matrices can rank risks wrongly even when their inputs are correct.

Table 1 summarises the seven studies closest to this work.

**Table 1.** Summary of selected literature

| Study | Context | Method | Main finding | What it does not address |
|---|---|---|---|---|
| Racz et al. (2010) | Integrated GRC | Literature analysis, definition | A frame of reference for GRC research | Artifact design and evaluation |
| Papazafeiropoulou & Spanaki (2016) | GRC IS implementation | Literature review and expert interviews | Implementation characteristics and success factors | Integrity of the evidence the systems produce |
| Spanaki & Papazafeiropoulou (2016) | GRC IS adoption | Qualitative study | Adoption lifecycle; integration, optimisation and information as value drivers | Whether that information is trustworthy |
| Arena et al. (2010) | ERM in organisations | Comparative case study | ERM varies with its rationalities, experts and technologies | How a technology's design distorts risk information |
| Alles et al. (2006) | Continuous control monitoring | Pilot implementation (Siemens) | Business-process controls can be monitored continuously | Integrity of the monitoring system itself |
| Botha & Eloff (2001) | Workflow access control | Conceptual model | Static and dynamic separation-of-duties enforcement | Approval semantics of risk assessments |
| Crosby & Wallach (2009) | Secure logging | Data structure and analysis | Efficient tamper-evident logs, provided auditors hold commitments | Business workflows and other failure types |

### 2.3 Research gap

Within the literature reached by our documented search (Section 3), no study examines how the design of a GRC application can itself corrupt the assurance evidence it presents:
- by fabricating values;
- by overwriting decisions;
- by accepting unauthenticated authority;
- by reporting failures as success.

The two relevant streams do not meet. GRC information systems research stops at adoption and value. Mechanism research does not address the evidence that risk and control self-assessment produces: ratings, approvals, appetite exposure and indicator status.

The gap is therefore not a missing mechanism, which we do not claim. It is missing **design knowledge** that maps application failures to corrupted evidence, and that tests principles against a real system.

### 2.4 Conceptual framework

The study links four elements in a chain:
1. **Failure modes** observed in a deployed system (RQ1).
2. **Design principles**, each grounded in a kernel theory above (RQ2).
3. **Mechanisms** that instantiate each principle.
4. **Scenario outcomes** that test whether the failures are prevented (RQ3).

The chain follows the structure of a design theory (Gregor & Jones, 2007). The principles take the aim–mechanism–rationale form proposed by Gregor et al. (2020). Table 2 (Section 4) makes the mapping explicit.

---

**Word count:** ≈ 592 (budget 500–600).

## References cited in this section (APA 7, checked against Crossref)

- Alles, M., Brennan, G., Kogan, A., & Vasarhelyi, M. A. (2006). Continuous monitoring of business process controls: A pilot implementation of a continuous auditing system at Siemens. *International Journal of Accounting Information Systems, 7*(2), 137–161. https://doi.org/10.1016/j.accinf.2005.10.004
- Arena, M., Arnaboldi, M., & Azzone, G. (2010). The organizational dynamics of enterprise risk management. *Accounting, Organizations and Society, 35*(7), 659–675. https://doi.org/10.1016/j.aos.2010.07.003
- Botha, R. A., & Eloff, J. H. P. (2001). Separation of duties for access control enforcement in workflow environments. *IBM Systems Journal, 40*(3), 666–682. https://doi.org/10.1147/sj.403.0666
- Cox, L. A., Jr. (2008). What's wrong with risk matrices? *Risk Analysis, 28*(2), 497–512. https://doi.org/10.1111/j.1539-6924.2008.01030.x
- Crosby, S. A., & Wallach, D. S. (2009). Efficient data structures for tamper-evident logging. In *Proceedings of the 18th USENIX Security Symposium* (pp. 317–334). USENIX Association.
- Gregor, S., Chandra Kruse, L., & Seidel, S. (2020). Research perspectives: The anatomy of a design principle. *Journal of the Association for Information Systems, 21*(6), 1622–1652. https://doi.org/10.17705/1jais.00649
- Gregor, S., & Jones, D. (2007). The anatomy of a design theory. *Journal of the Association for Information Systems, 8*(5), 312–335. https://doi.org/10.17705/1jais.00129
- Meidell, A., & Kaarbøe, K. (2017). How the enterprise risk management function influences decision-making in the organization – A field study of a large, global oil and gas company. *The British Accounting Review, 49*(1), 39–55. https://doi.org/10.1016/j.bar.2016.10.005
- Mikes, A. (2009). Risk management and calculative cultures. *Management Accounting Research, 20*(1), 18–40. https://doi.org/10.1016/j.mar.2008.10.005
- Mikes, A., & Kaplan, R. S. (2015). When one size doesn't fit all: Evolving directions in the research and practice of enterprise risk management. *Journal of Applied Corporate Finance, 27*(1), 37–40. https://doi.org/10.1111/jacf.12102
- Papazafeiropoulou, A., & Spanaki, K. (2016). Understanding governance, risk and compliance information systems (GRC IS): The experts view. *Information Systems Frontiers, 18*(6), 1251–1263. https://doi.org/10.1007/s10796-015-9572-3
- Power, M. (1997). *The audit society: Rituals of verification*. Oxford University Press.
- Power, M. (2009). The risk management of nothing. *Accounting, Organizations and Society, 34*(6–7), 849–855. https://doi.org/10.1016/j.aos.2009.06.001
- Racz, N., Weippl, E., & Seufert, A. (2010). A frame of reference for research of integrated governance, risk and compliance (GRC). In B. De Decker & I. Schaumüller-Bichl (Eds.), *Communications and Multimedia Security* (Lecture Notes in Computer Science, Vol. 6109, pp. 106–117). Springer. https://doi.org/10.1007/978-3-642-13241-4_11
- Saltzer, J. H., & Schroeder, M. D. (1975). The protection of information in computer systems. *Proceedings of the IEEE, 63*(9), 1278–1308. https://doi.org/10.1109/PROC.1975.9939
- Schneier, B., & Kelsey, J. (1999). Secure audit logs to support computer forensics. *ACM Transactions on Information and System Security, 2*(2), 159–176. https://doi.org/10.1145/317087.317089
- Spanaki, K., & Papazafeiropoulou, A. (2016). The implementation of governance, risk, and compliance IS: Adoption lifecycle and enterprise value. *Information Systems Management, 33*(4), 302–315. https://doi.org/10.1080/10580530.2016.1220214
- Vasarhelyi, M. A., Alles, M. G., & Kogan, A. (2004). Principles of analytic monitoring for continuous assurance. *Journal of Emerging Technologies in Accounting, 1*(1), 1–21. https://doi.org/10.2308/jeta.2004.1.1.1

**Notes for you before approving:**
1. **Gate 2 register correction.** The *Information Systems Frontiers* paper is by **Papazafeiropoulou & Spanaki (2016)**: that author order, print year 2016. Gate 2 listed it once as 2015 and once with the authors reversed. Crossref settles it.
2. **Three details to check on the publisher pages before submission:** the Racz et al. volume editors and book title, the Crosby & Wallach proceedings title, and the full first names. Crossref has no record for the USENIX paper, and initials vary between sources.
3. **Your Scopus/WoS search.** The gap claim still depends on the search string from Gate 2 (§A6). If your institution can run it, please do.
