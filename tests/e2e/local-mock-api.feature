@e2e-local-mock
Feature: Local mock API — generic HTTP E2E
  OpenAPI/cURL/manual-style generic HTTP steps against an in-process mock server.
  No AI generation; deterministic auth token → Bearer → protected resource.

  Scenario: GET list users and GET user by id
    Given the API request uses auth mode "NONE"
    When the user sends a GET request to "/users"
    Then the API response status should be 200
    And the API response JSON path "$.users" should exists "true"
    When the user sends a GET request to "/users/1"
    Then the API response status should be 200
    And the API response JSON path "$.name" should eq "Demo User"

  Scenario: POST create user then PATCH and DELETE
    Given the API request uses auth mode "NONE"
    And the API request body is
      """
      {"name":"Alice","email":"alice@example.com"}
      """
    And the API request content type is "application/json"
    When the user sends a POST request to "/users"
    Then the API response status should be 201
    And the API response JSON path "$.id" should exists "true"
    And the user stores the API response JSON path "$.id" as sensitive scenario variable "createdUserId"
    Given the API request uses auth mode "NONE"
    And the API request body is
      """
      {"name":"Alice Updated","email":"alice.updated@example.com"}
      """
    And the API request content type is "application/json"
    When the user sends a PATCH request to "/users/{createdUserId}"
    Then the API response status should be 200
    And the API response JSON path "$.name" should eq "Alice Updated"
    When the user sends a DELETE request to "/users/{createdUserId}"
    Then the API response status should be 204

  Scenario: Auth token extract, Bearer on protected route, evidence redaction
    Given the API request uses auth mode "NONE"
    When the user sends a POST request to "/auth/token"
    Then the API response status should be 200
    And the API response JSON path "$.access_token" should exists "true"
    And the user stores the API response JSON path "$.access_token" as sensitive scenario variable "accessToken"
    Given the API request uses auth mode "NONE"
    And the API request uses Bearer token from scenario variable "accessToken"
    When the user sends a GET request to "/protected"
    Then the API response status should be 200
    And the API response JSON path "$.message" should eq "authorized"
    And the HTTP evidence redaction rules are satisfied for the mock E2E token
