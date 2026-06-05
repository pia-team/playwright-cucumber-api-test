@quote
Feature: Quote Management API

  Scenario: Create Quote successfully
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the quoteManagement service
    When I create a quote with valid payload for quoteManagement
    Then the response status should be 201
    And the response body should contain an id field for quoteManagement

  Scenario: Create Quote with invalid payload
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the quoteManagement service
    When I create a quote with invalid payload for quoteManagement
    Then the response status should be 400
    And the response body should contain an error message

  Scenario: List Quote
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the quoteManagement service
    When I send a GET request to list quotes for quoteManagement
    Then the response status should be 200 or 206
    And the response body should be a JSON array

  Scenario: Retrieve Quote by id
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the quoteManagement service
    When I create a quote with valid payload for quoteManagement
    When I send a GET request to retrieve the quote by id for quoteManagement
    Then the response status should be 200 or 206
    And the response body should contain the saved id for quoteManagement

  Scenario: Update Quote
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the quoteManagement service
    When I create a quote with valid payload for quoteManagement
    When I send a PATCH request to update the quote for quoteManagement
    Then the response status should be 200

  Scenario: Delete Quote
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the quoteManagement service
    When I create a quote with valid payload for quoteManagement
    When I send a DELETE request to delete the quote for quoteManagement
    Then the response status should be 204

  Scenario: Retrieve non-existent Quote by id
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the quoteManagement service
    When I send a GET request to retrieve a non-existent quote by id for quoteManagement
    Then the response status should be 404