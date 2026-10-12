Feature: Runtime UUID in query parameters

  @api @generic-http
  Scenario: generated UUID is sent as query id
    Given the scenario variable "resourceId" is generated as "uuid"
    Given the API chain step "s1" "GET /lookup"
    And the API request uses auth mode "NONE"
    And the API request query parameters are
      | id | {{resourceId}} |
      | limit | 10 |
    When the user sends a GET request to "/lookup"
    And API step "s1" "GET /lookup" expects status 200
    And the API response JSON path "$.uuidShape" should eq "true"
    And the API response JSON path "$.limit" should eq "10"
