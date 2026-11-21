# Store Publishing Checklist (Stage 6)
## Both
- [ ] Version name/code bumped; release notes written
- [ ] Privacy policy URL live; account-deletion flow present if accounts exist (both stores require it)
- [ ] Permissions justified; only used permissions requested
- [ ] Icons, screenshots for required device sizes, feature graphic (Play), descriptions, keywords, support URL
## Android (Google Play Console)
- [ ] AAB built with release signing (upload key held by company, Play App Signing enabled)
- [ ] Target SDK meets current Play requirement (verify at time of release)
- [ ] Data safety form, content rating, target audience completed
- [ ] Internal → closed testing track before production (new personal accounts need the closed-test period)
## iOS (App Store Connect)
- [ ] Built with the Xcode/SDK version Apple currently requires (verify at time of release)
- [ ] Signing via company Apple Developer team; provisioning profiles valid
- [ ] Privacy manifest + App Privacy answers; export compliance
- [ ] TestFlight internal → external testing; review notes + demo account for reviewers
## Gate
- [ ] **CEO explicit authorization for public submission recorded**
- [ ] Submission status reported only from what the console actually shows
