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
