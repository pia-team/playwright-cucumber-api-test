# playwright-cucumber-api-test — Geliştirme günlüğü

Kullanım: [ortak changelog rehberi](../CHANGELOG.md). Sürümler geliştirme ledger'ına aittir; deploy/paket yayını değildir.
Kayıtlar eklenme sırasıyla tutulur. Minor = yeni yetenek; patch = düzeltme/iyileştirme/bakım.
Başlangıç: `0.0.0` (manifest: `sürüm alanı yok`). Önceki sürümler tahmin edilmemiştir.
Geçmiş: [Git arşivi](docs/changelog/history.md). Release notlarına kendiliğinden dahil edilmez.

<!-- CHANGELOG:BASELINE {"date": "2026-10-22T13:47:26+03:00", "git_head": "4619d9f9ad383c8eab81a33d33f67c94455c60a1", "manifest_version": null, "note": "Ledger starting point only; not a historical release claim", "version": "0.0.0"} -->

<!-- CHANGELOG:ENTRY {"bump": "minor", "date": "2026-10-23T19:53:00+03:00", "evidence": "Stabilization: body-from-file uses Buffer; node --test genericHttp.bodyFromFile + bodyFileAndMultipart.e2e — 12 pass (PDF/PNG byte equality, multipart, JSON/TXT, missing binding).", "id": "2026-10-23-ct-feat-001-wp3-curl-manual-resources", "summary": "API tests load request bodies from Data Center bindings as raw bytes (Buffer) so PDF/PNG/ZIP survive --data-binary @file; multipart uploads still use getFile + postMultipartFile.", "title": "API runner body-from-file step", "version": "0.1.0"} -->
## 0.1.0 — API runner body-from-file step

API tests load request bodies from Data Center bindings as raw bytes (Buffer) so PDF/PNG/ZIP survive --data-binary @file; multipart uploads still use getFile + postMultipartFile.

Kanıt / doğrulama: Stabilization: body-from-file uses Buffer; node --test genericHttp.bodyFromFile + bodyFileAndMultipart.e2e — 12 pass (PDF/PNG byte equality, multipart, JSON/TXT, missing binding).

<!-- CHANGELOG:ENTRY {"bump": "patch", "date": "2026-10-23T20:34:23+03:00", "evidence": "Stabilization: bodyFileAndMultipart.e2e → 11 pass including same-field binary array wire capture (name=\"files\" x2) + single-file regression; postMultipartFiles + Data Center files step", "id": "2026-10-23-ct-feat-001-wp5-openapi-resources", "summary": "Runner keeps testData.getFile and single-file postMultipartFile; adds postMultipartFiles / FormData so OpenAPI binary arrays send multiple parts under the same multipart field name.", "title": "Multipart getFile contract unchanged for OpenAPI", "version": "0.1.1"} -->
## 0.1.1 — Multipart getFile contract unchanged for OpenAPI

Runner keeps testData.getFile and single-file postMultipartFile; adds postMultipartFiles / FormData so OpenAPI binary arrays send multiple parts under the same multipart field name.

Kanıt / doğrulama: Stabilization: bodyFileAndMultipart.e2e → 11 pass including same-field binary array wire capture (name="files" x2) + single-file regression; postMultipartFiles + Data Center files step

<!-- CHANGELOG:ENTRY {"bump": "minor", "date": "2026-10-23T23:52:28+03:00", "evidence": "bodyFileAndMultipart.e2e → 12 pass (file+meta text extras, WP5 multi-file, WP3 regressions)", "id": "2026-10-23-ct-feat-001-wp6-postman-resources", "summary": "Multipart gönderiminde text form alanları extraFields olarak korunur; Postman karma formdata+file senaryoları wire üzerinde doğrulanır.", "title": "Multipart text extras for Postman forms", "version": "0.2.0"} -->
## 0.2.0 — Multipart text extras for Postman forms

Multipart gönderiminde text form alanları extraFields olarak korunur; Postman karma formdata+file senaryoları wire üzerinde doğrulanır.

Kanıt / doğrulama: bodyFileAndMultipart.e2e → 12 pass (file+meta text extras, WP5 multi-file, WP3 regressions)

<!-- CHANGELOG:ENTRY {"bump": "minor", "date": "2026-10-24T00:12:20+03:00", "evidence": "bodyFileAndMultipart.e2e → 12 pass (missing-on-disk PREFLIGHT message)", "id": "2026-10-24-ct-feat-001-wp7-run-preflight", "summary": "API runner testData.getFile, manifest localPath’i workdir dışında ise veya checksum uyuşmazsa PREFLIGHT hatası verir; sessiz fallback yoktur.", "title": "Manifest path and checksum checks in testData.getFile", "version": "0.3.0"} -->
## 0.3.0 — Manifest path and checksum checks in testData.getFile

API runner testData.getFile, manifest localPath’i workdir dışında ise veya checksum uyuşmazsa PREFLIGHT hatası verir; sessiz fallback yoktur.

Kanıt / doğrulama: bodyFileAndMultipart.e2e → 12 pass (missing-on-disk PREFLIGHT message)

<!-- CHANGELOG:ENTRY {"bump": "patch", "date": "2026-10-24T00:25:21+03:00", "evidence": "bodyFileAndMultipart.e2e 12 pass + genericHttp.bodyFromFile 3 pass; test:unit 159/162 (3 unrelated OUT OF SCOPE)", "id": "2026-10-24-ct-feat-001-wp8-release-readiness", "summary": "CT-FEAT-001 WP8: API multipart/body-from-file ve getFile contract testleri yeşil; tam test:unit içindeki 3 ilgisiz hata kapsam dışı raporlandı.", "title": "Unified Test Resources WP8 release readiness", "version": "0.3.1"} -->
## 0.3.1 — Unified Test Resources WP8 release readiness

CT-FEAT-001 WP8: API multipart/body-from-file ve getFile contract testleri yeşil; tam test:unit içindeki 3 ilgisiz hata kapsam dışı raporlandı.

Kanıt / doğrulama: bodyFileAndMultipart.e2e 12 pass + genericHttp.bodyFromFile 3 pass; test:unit 159/162 (3 unrelated OUT OF SCOPE)

<!-- CHANGELOG:ENTRY {"bump": "patch", "date": "2026-10-27T00:24:23+03:00", "evidence": "tests/tokenCurlAuth.test.ts → 3/3 pass (local mock HTTP).", "id": "2026-10-27-enh004-token-curl-credential", "summary": "TOKEN_CURL credential ile Bearer yeniden üretimi ve {{username}}/{{password}} binding; secret/token loglanmaz.", "title": "API runner TOKEN_CURL reacquire and placeholders", "version": "0.3.2"} -->
## 0.3.2 — API runner TOKEN_CURL reacquire and placeholders

TOKEN_CURL credential ile Bearer yeniden üretimi ve {{username}}/{{password}} binding; secret/token loglanmaz.

Kanıt / doğrulama: tests/tokenCurlAuth.test.ts → 3/3 pass (local mock HTTP).

<!-- CHANGELOG:ENTRY {"bump": "patch", "date": "2026-10-27T00:35:55+03:00", "evidence": "tests/keycloakAuth.test.ts + authResolution + tokenCurlAuth → 36/36 pass (local mock HTTP; no live IdP).", "id": "2026-10-27-bug010-keycloak-client-secret-realm", "summary": "API KEYCLOAK password-grant artık confidential client_secret gönderir; token URL Credential realm’ini korur (Preview ile uyumlu).", "title": "KEYCLOAK client_secret and dynamic realm token URL", "version": "0.3.3"} -->
## 0.3.3 — KEYCLOAK client_secret and dynamic realm token URL

API KEYCLOAK password-grant artık confidential client_secret gönderir; token URL Credential realm’ini korur (Preview ile uyumlu).

Kanıt / doğrulama: tests/keycloakAuth.test.ts + authResolution + tokenCurlAuth → 36/36 pass (local mock HTTP; no live IdP).

<!-- CHANGELOG:ENTRY {"bump": "minor", "date": "2026-10-29T22:14:50+03:00", "evidence": "node --test tests/authTokenRecovery.test.ts tests/jobTokenCache.test.ts → 29/29 PASS; canlı IdP yok.", "id": "2026-10-29-pkg5-phase2-credentials-curl-token", "summary": "Bilinmeyen TTL token’ları senaryo sınırında yeniden kullanılmaz; beklenmeyen 401’de TOKEN_CURL tek reacquire (POST replay yok); beklenen 401/403 ve düz 403 refresh yok.", "title": "Paket 5 Faz 2: unknown-TTL senaryo sınırı ve TOKEN_CURL 401 recovery", "version": "0.4.0"} -->
## 0.4.0 — Paket 5 Faz 2: unknown-TTL senaryo sınırı ve TOKEN_CURL 401 recovery

Bilinmeyen TTL token’ları senaryo sınırında yeniden kullanılmaz; beklenmeyen 401’de TOKEN_CURL tek reacquire (POST replay yok); beklenen 401/403 ve düz 403 refresh yok.

Kanıt / doğrulama: node --test tests/authTokenRecovery.test.ts tests/jobTokenCache.test.ts → 29/29 PASS; canlı IdP yok.

<!-- CHANGELOG:ENTRY {"bump": "patch", "date": "2026-10-29T22:31:10+03:00", "evidence": "node --test tests/jobTokenCache.test.ts tests/authTokenRecovery.test.ts → 30/30 PASS.", "id": "2026-10-29-pkg5-phase2-final-verification", "summary": "Suite paralel feature’larda farklı job+credential kimliklerinin token cache’i paylaşmadığı hedefli testle doğrulandı.", "title": "Paket 5 Faz 2 final verification: suite paralel credential token izolasyonu", "version": "0.4.1"} -->
## 0.4.1 — Paket 5 Faz 2 final verification: suite paralel credential token izolasyonu

Suite paralel feature’larda farklı job+credential kimliklerinin token cache’i paylaşmadığı hedefli testle doğrulandı.

Kanıt / doğrulama: node --test tests/jobTokenCache.test.ts tests/authTokenRecovery.test.ts → 30/30 PASS.

<!-- CHANGELOG:ENTRY {"bump": "minor", "date": "2026-10-29T22:41:32+03:00", "evidence": "mimeType.test.ts 3/3 PASS; ApiClient.options + genericHttp OPTIONS; runner-templates/api mirror.", "id": "2026-10-29-pkg5-phase3-unified-api-generation", "summary": "API runner OPTIONS metodunu destekler; multipart dosyalarda explicit MIME korunur, bilinmeyenlerde güvenli fallback kullanılır.", "title": "OPTIONS + multipart MIME for unified API runner", "version": "0.5.0"} -->
## 0.5.0 — OPTIONS + multipart MIME for unified API runner

API runner OPTIONS metodunu destekler; multipart dosyalarda explicit MIME korunur, bilinmeyenlerde güvenli fallback kullanılır.

Kanıt / doğrulama: mimeType.test.ts 3/3 PASS; ApiClient.options + genericHttp OPTIONS; runner-templates/api mirror.

<!-- CHANGELOG:ENTRY {"bump": "patch", "date": "2026-10-29T22:52:24+03:00", "evidence": "assertionChecks.test.ts 20/20 PASS (Phase 3 final verification block dahil).", "id": "2026-10-29-pkg5-phase3-final-verification", "summary": "API runner assertion FAIL (JSONPath/body/header/status) ve scenario-blocking davranış hedefli testlerle doğrulandı; yanlış PASS iddiası yok.", "title": "Assertion FAIL reliability targeted tests", "version": "0.5.1"} -->
## 0.5.1 — Assertion FAIL reliability targeted tests

API runner assertion FAIL (JSONPath/body/header/status) ve scenario-blocking davranış hedefli testlerle doğrulandı; yanlış PASS iddiası yok.

Kanıt / doğrulama: assertionChecks.test.ts 20/20 PASS (Phase 3 final verification block dahil).

<!-- CHANGELOG:ENTRY {"bump": "minor", "date": "2026-10-29T23:44:58+03:00", "evidence": "flowResponseBuffer.ts,flow-capture.step.ts,genericHttp.step.ts", "id": "pkg6-phase2-schedule-flow-consistency", "summary": "HTTP responses buffered with method/URL; capture fail-closed on missing/ambiguous matches instead of last-body silent win.", "title": "Deterministic API Flow capture buffer", "version": "0.6.0"} -->
## 0.6.0 — Deterministic API Flow capture buffer

HTTP responses buffered with method/URL; capture fail-closed on missing/ambiguous matches instead of last-body silent win.

Kanıt / doğrulama: flowResponseBuffer.ts,flow-capture.step.ts,genericHttp.step.ts

<!-- CHANGELOG:ENTRY {"bump": "minor", "date": "2026-10-30T16:03:32+03:00", "evidence": "genericHttp.step.ts: loaded from Data Center config … key …; birim/E2E koşulmadı.", "id": "2026-10-30-dc-phase1-config", "summary": "API runner, Data Center CONFIG anahtarını senaryo değişkenine yükleyebilir.", "title": "CONFIG anahtarından senaryo değişkeni yükleme adımı", "version": "0.7.0"} -->
## 0.7.0 — CONFIG anahtarından senaryo değişkeni yükleme adımı

API runner, Data Center CONFIG anahtarını senaryo değişkenine yükleyebilir.

Kanıt / doğrulama: genericHttp.step.ts: loaded from Data Center config … key …; birim/E2E koşulmadı.

<!-- CHANGELOG:ENTRY {"bump": "minor", "date": "2026-10-30T18:20:16+03:00", "evidence": "tests/step-event.test.ts 1/1 PASS; canlı API E2E UNVERIFIED.", "id": "2026-10-30-pkg8-phase2-step-state-hybrid-preview", "summary": "API runner structured step event marker üretir; soft-fail UI FAILED reason taşır, Cucumber sonucu bozulmaz.", "title": "API structured step markers with soft-fail reason", "version": "0.8.0"} -->
## 0.8.0 — API structured step markers with soft-fail reason

API runner structured step event marker üretir; soft-fail UI FAILED reason taşır, Cucumber sonucu bozulmaz.

Kanıt / doğrulama: tests/step-event.test.ts 1/1 PASS; canlı API E2E UNVERIFIED.

<!-- CHANGELOG:ENTRY {"bump": "patch", "date": "2026-10-30T22:46:53+03:00", "evidence": "src/core/hooks/stepHooks.ts; tests/allureReporter.e2e.test.ts; node --test allureReporter.e2e.test.ts → 2 pass", "id": "pkg9-closure-allure-reporter", "summary": "API cucumber step hooks load under ts-node; allureReporter e2e creates allure-results and job HTML without typecheck abort.", "title": "Allure reporter e2e load and artifacts", "version": "0.8.1"} -->
## 0.8.1 — Allure reporter e2e load and artifacts

API cucumber step hooks load under ts-node; allureReporter e2e creates allure-results and job HTML without typecheck abort.

Kanıt / doğrulama: src/core/hooks/stepHooks.ts; tests/allureReporter.e2e.test.ts; node --test allureReporter.e2e.test.ts → 2 pass
