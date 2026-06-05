@agreementManagement
Feature: Agreement Management API

  @agreementManagement
  Scenario: Create Agreement Specification successfully
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the agreementManagement service
    When I send a POST request to create an agreement specification with valid payload for agreementManagement
    Then the response status should be 201
    And the response body should contain id

  @agreementManagement
  Scenario: Create Agreement Specification missing attachment fails
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the agreementManagement service
    When I send a POST request to create an agreement specification with missing attachment for agreementManagement
    Then the response status should be 400
    And the response body should contain an error message

  @agreementManagement
  Scenario: Create Agreement Specification missing name fails
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the agreementManagement service
    When I send a POST request to create an agreement specification with missing name for agreementManagement
    Then the response status should be 400
    And the response body should contain an error message

  @agreementManagement
  Scenario: List Agreement Specification
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the agreementManagement service
    When I send a GET request to list agreement specifications for agreementManagement
    Then the response status should be 200 or 206
    And the response body should be a JSON array

  @agreementManagement
  Scenario: Retrieve Agreement Specification by id
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the agreementManagement service
    Given I have created an agreement specification for agreementManagement
    When I send a GET request to retrieve the agreement specification by id for agreementManagement
    Then the response status should be 200 or 206

  @agreementManagement
  Scenario: Update Agreement Specification
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the agreementManagement service
    Given I have created an agreement specification for agreementManagement
    When I send a PATCH request to update the agreement specification for agreementManagement
    Then the response status should be 200

  @agreementManagement
  Scenario: Delete Agreement Specification
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the agreementManagement service
    Given I have created an agreement specification for agreementManagement
    When I send a DELETE request to delete the agreement specification by id for agreementManagement
    Then the response status should be 204

  @agreementManagement
  Scenario: Retrieve non-existent Agreement Specification by id
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the agreementManagement service
    When I send a GET request to retrieve a non-existent agreement specification by id for agreementManagement
    Then the response status should be 404

  @agreementManagement
  Scenario: Create Agreement successfully
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the agreementManagement service
    Given I have a valid agreement specification and an individual party for agreementManagement
    When I send a POST request to create an agreement with valid payload for agreementManagement
    Then the response status should be 201
    And the response body should contain id

  @agreementManagement
  Scenario: Create Agreement missing agreementItem fails
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the agreementManagement service
    Given I have a valid agreement specification and an individual party for agreementManagement
    When I send a POST request to create an agreement with missing agreementItem for agreementManagement
    Then the response status should be 400
    And the response body should contain an error message

  @agreementManagement
  Scenario: Create Agreement missing agreementType fails
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the agreementManagement service
    Given I have a valid agreement specification and an individual party for agreementManagement
    When I send a POST request to create an agreement with missing agreementType for agreementManagement
    Then the response status should be 400
    And the response body should contain an error message

  @agreementManagement
  Scenario: Create Agreement missing engagedParty fails
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the agreementManagement service
    Given I have a valid agreement specification and an individual party for agreementManagement
    When I send a POST request to create an agreement with missing engagedParty for agreementManagement
    Then the response status should be 400
    And the response body should contain an error message

  @agreementManagement
  Scenario: Create Agreement missing name fails
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the agreementManagement service
    Given I have a valid agreement specification and an individual party for agreementManagement
    When I send a POST request to create an agreement with missing name for agreementManagement
    Then the response status should be 400
    And the response body should contain an error message

  @agreementManagement
  Scenario: List Agreement
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the agreementManagement service
    When I send a GET request to list agreements for agreementManagement
    Then the response status should be 200 or 206
    And the response body should be a JSON array

  @agreementManagement
  Scenario: Retrieve Agreement by id
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the agreementManagement service
    Given I have created an agreement for agreementManagement
    When I send a GET request to retrieve the agreement by id for agreementManagement
    Then the response status should be 200 or 206

  @agreementManagement
  Scenario: Update Agreement
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the agreementManagement service
    Given I have created an agreement for agreementManagement
    When I send a PATCH request to update the agreement for agreementManagement
    Then the response status should be 200

  @agreementManagement
  Scenario: Delete Agreement
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the agreementManagement service
    Given I have created an agreement for agreementManagement
    When I send a DELETE request to delete the agreement by id for agreementManagement
    Then the response status should be 204

  @agreementManagement
  Scenario: Retrieve non-existent Agreement by id
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the agreementManagement service
    When I send a GET request to retrieve a non-existent agreement by id for agreementManagement
    Then the response status should be 404