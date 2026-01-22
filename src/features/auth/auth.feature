Feature: Authentication API

  @getToken
  Scenario: Get access token with default user
    Given I have authentication credentials for user "orbitant"
    When I send a POST request to get access token
    Then the response status should be 200
    And the response should contain access token
    And the token type should be "Bearer"

  @getToken
  Scenario: Get access token with custom user
    Given I have authentication credentials for user "{string}"
    When I send a POST request to get access token
    Then the response status should be 200
    And the response should contain access token
    And the token type should be "Bearer"

  Scenario: Get access token with invalid credentials
    Given I have invalid authentication credentials
    When I send a POST request to get access token
    Then the response status should be 401

  Scenario: Get access token with missing credentials
    Given I have authentication credentials with missing fields
    When I send a POST request to get access token
    Then the response status should be 400
