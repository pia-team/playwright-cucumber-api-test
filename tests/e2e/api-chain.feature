Feature: API chain uses the previous response

  @api @generic-http
  Scenario: POST id is used by GET PATCH and DELETE
    Given the API chain step "s1" "POST /customers"
    And the API request uses auth mode "NONE"
    And the API request body is
      """
      {"name":"Test Customer"}
      """
    And the API chain will store response path "$.id"
    When the user sends a POST request to "/customers"
    And criterion "created" holds: "created"
      """
      {"id":"created","description":"created","type":"field_equals","path":"$.step","operator":"eq","expected":"created","stepId":"s1","stepLabel":"POST /customers"}
      """
    And API step "s1" "POST /customers" expects status 201
    And the API response JSON path "$.id" is stored as scenario variable "customerId"
    Given the API chain step "s2" "GET /customers/{{customerId}}"
    And the API request uses auth mode "NONE"
    And the API request headers are
      | X-Customer | {{customerId}} |
    And the API request query parameters are
      | ref | {{customerId}} |
    When the user sends a GET request to "/customers/{{customerId}}"
    And criterion "fetched" holds: "fetched"
      """
      {"id":"fetched","description":"fetched","type":"field_equals","path":"$.step","operator":"eq","expected":"fetched","stepId":"s2","stepLabel":"GET /customers/{{customerId}}"}
      """
    And API step "s2" "GET /customers/{{customerId}}" expects status 200
    Given the API chain step "s3" "PATCH /customers/{{customerId}}"
    And the API request uses auth mode "NONE"
    And the API request body is
      """
      {"name":"Updated","echo":"{{customerId}}"}
      """
    When the user sends a PATCH request to "/customers/{{customerId}}"
    And API step "s3" "PATCH /customers/{{customerId}}" expects status 200
    Given the API chain step "s4" "DELETE /customers/{{customerId}}"
    And the API request uses auth mode "NONE"
    When the user sends a DELETE request to "/customers/{{customerId}}"
    And API step "s4" "DELETE /customers/{{customerId}}" expects status 204

  @api @generic-http
  Scenario: a later store overwrites the same variable
    Given the API chain step "s1" "POST /customers"
    And the API request uses auth mode "NONE"
    And the API request body is
      """
      {"name":"First"}
      """
    And the API chain will store response path "$.id"
    When the user sends a POST request to "/customers"
    And API step "s1" "POST /customers" expects status 201
    And the API response JSON path "$.id" is stored as scenario variable "customerId"
    Given the API chain step "s2" "POST /customers"
    And the API request uses auth mode "NONE"
    And the API request body is
      """
      {"name":"Second"}
      """
    And the API chain will store response path "$.id"
    When the user sends a POST request to "/customers"
    And API step "s2" "POST /customers" expects status 201
    And the API response JSON path "$.id" is stored as scenario variable "customerId"
    Given the API chain step "s3" "GET /customers/{{customerId}}"
    And the API request uses auth mode "NONE"
    When the user sends a GET request to "/customers/{{customerId}}"
    And API step "s3" "GET /customers/{{customerId}}" expects status 200

  @api @generic-http
  Scenario: a stored secret is redacted and still sent
    Given the API chain step "s1" "POST /customers"
    And the API request uses auth mode "NONE"
    And the API request body is
      """
      {"name":"secret"}
      """
    And the API chain will store response path "$.id"
    When the user sends a POST request to "/customers"
    And API step "s1" "POST /customers" expects status 201
    And the API response JSON path "$.id" is stored as scenario variable "customerId"
    Given the API chain step "s2" "GET /customers/{{customerId}}"
    And the API request uses auth mode "NONE"
    When the user sends a GET request to "/customers/{{customerId}}"
    And API step "s2" "GET /customers/{{customerId}}" expects status 200

  @api @generic-http
  Scenario: a missing variable blocks only the dependent request
    Given the API chain step "s1" "GET /customers/{{customerId}}"
    And the API request uses auth mode "NONE"
    When the user sends a GET request to "/customers/{{customerId}}"
    And API step "s1" "GET /customers/{{customerId}}" expects status 200
    Given the API chain step "s2" "GET /users"
    And the API request uses auth mode "NONE"
    When the user sends a GET request to "/users"
    And API step "s2" "GET /users" expects status 200

  @api @generic-http
  Scenario: an invalid JSON path does not store a value
    Given the API chain step "s1" "POST /customers"
    And the API request uses auth mode "NONE"
    And the API request body is
      """
      {"name":"Bad path"}
      """
    When the user sends a POST request to "/customers"
    And API step "s1" "POST /customers" expects status 201
    And the API response JSON path "$.id()" is stored as scenario variable "customerId"
    Given the API chain step "s2" "GET /customers/{{customerId}}"
    And the API request uses auth mode "NONE"
    When the user sends a GET request to "/customers/{{customerId}}"
    And API step "s2" "GET /customers/{{customerId}}" expects status 200

  @api @generic-http
  Scenario: one failed assertion fails the scenario and later requests still run
    Given the API chain step "s1" "POST /customers"
    And the API request uses auth mode "NONE"
    And the API request body is
      """
      {"name":"Fail me"}
      """
    And the API chain will store response path "$.id"
    When the user sends a POST request to "/customers"
    And criterion "missing" holds: "missing"
      """
      {"id":"missing","description":"missing field","type":"field_exists","path":"$.missing","operator":"exists","stepId":"s1","stepLabel":"POST /customers"}
      """
    And API step "s1" "POST /customers" expects status 201
    And the API response JSON path "$.id" is stored as scenario variable "customerId"
    Given the API chain step "s2" "GET /customers/{{customerId}}"
    And the API request uses auth mode "NONE"
    When the user sends a GET request to "/customers/{{customerId}}"
    And API step "s2" "GET /customers/{{customerId}}" expects status 200

  @api @generic-http
  Scenario: a status mismatch blocks a dependent request
    Given the API chain step "s1" "POST /customers"
    And the API request uses auth mode "NONE"
    And the API request body is
      """
      {"name":"Wrong status"}
      """
    And the API chain will store response path "$.id"
    When the user sends a POST request to "/customers"
    And API step "s1" "POST /customers" expects status 500
    And the API response JSON path "$.id" is stored as scenario variable "customerId"
    Given the API chain step "s2" "GET /customers/{{customerId}}"
    And the API request uses auth mode "NONE"
    When the user sends a GET request to "/customers/{{customerId}}"
    And API step "s2" "GET /customers/{{customerId}}" expects status 200
    Given the API chain step "s3" "GET /users"
    And the API request uses auth mode "NONE"
    When the user sends a GET request to "/users"
    And API step "s3" "GET /users" expects status 200

  @api @generic-http
  Scenario: a single request still checks status
    Given the API request uses auth mode "NONE"
    When the user sends a GET request to "/users"
    Then the API response status should be 200
