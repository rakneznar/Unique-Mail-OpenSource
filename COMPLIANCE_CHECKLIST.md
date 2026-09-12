# Publication compliance checklist

Engineering review date: 12 September 2026. This is not legal advice.

## Must be completed before commercial EU/German publication

- [ ] Complete the publisher identity: legal name, legal form, authorized representative, full service address, register and number, VAT/business identification number where applicable, and supervisory authority where applicable. Germany's DDG section 5 requires these details to be directly and permanently accessible for relevant commercial digital services.
- [ ] Complete the controller information and privacy notice: purposes, legal bases, recipients, international transfers, concrete retention periods, data-subject rights, and competent supervisory authority under GDPR Articles 13 and 14.
- [ ] Decide and publish the consumer dispute-resolution statement required by VSBG sections 36 and 37 when applicable.
- [ ] Define sales terms, price/tax information, cancellation rights, warranty/support terms, and distribution-platform disclosures if the software is sold to consumers.
- [ ] Establish a Cyber Resilience Act process: vulnerability intake, security updates, support period, software bill of materials, technical documentation, conformity assessment, EU declaration of conformity, CE marking, and incident/vulnerability reporting. Regulation (EU) 2024/2847 generally applies from 11 December 2027; Article 14 reporting applies from 11 September 2026 and Chapter IV market-surveillance provisions from 11 June 2026. Determine with counsel whether the free/open-source exception applies to the exact distribution model.
- [ ] Because the stated publisher address is outside the EU, determine whether an EU authorized representative/importer and related product labeling are required.
- [ ] Obtain a trusted Windows code-signing certificate and sign release artifacts. The build process creates installers but does not prove Microsoft Store certification.
- [ ] Perform trademark/name clearance for "Unique Mail" and verify rights to every bundled logo and visual asset.
- [ ] Conduct a security review covering credential lifecycle, local cache protection, update signature/integrity verification, HTML mail isolation, remote-content privacy, dependency vulnerabilities, and the weak minimum app-lock password.
- [ ] Add reproducible release records: source revision, dependency/SBOM snapshot, third-party notices, checksums, supported versions, and vulnerability-handling contacts.
- [ ] Check accessibility requirements for the chosen sales/distribution model, including the German BFSG where applicable.

## Implemented or documented in this repository

- [x] No advertising or analytics dependency is configured.
- [x] Credentials are stored separately through Electron `safeStorage` instead of plaintext application settings.
- [x] Network recipients and optional AI/feedback flows are described in `PRIVACY.md`.
- [x] A private security contact and basic disclosure policy are documented in `SECURITY.md`.
- [x] Package metadata names the source repository and Apache-2.0 project license.
- [x] Third-party runtime packages are listed in `THIRD_PARTY_NOTICES.txt`; Electron also bundles its Electron and Chromium license files.

## Primary references

- German DDG section 5: https://www.gesetze-im-internet.de/ddg/__5.html
- GDPR, including Articles 13, 14, and 32: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- German VSBG section 36: https://www.gesetze-im-internet.de/vsbg/__36.html
- Cyber Resilience Act, Regulation (EU) 2024/2847: https://eur-lex.europa.eu/eli/reg/2024/2847/oj/eng
