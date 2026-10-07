@party_role
Feature: Party Role API

  Scenario: Create Role Type successfully
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the party_role service
    When I create a role type with valid payload for party_role
    Then the response status should be 201
    And the response body should contain id for party_role

  Scenario: Create Role Type missing name fails
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the party_role service
    When I create a role type missing name for party_role
    Then the response status should be 400
    And the response body should contain an error message

  Scenario: List Role Type
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the party_role service
    When I send a GET request to list role types for party_role
    Then the response status should be 200 or 206
    And the response body should be a JSON array

  Scenario: Retrieve Role Type by id
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the party_role service
    When I create a role type with valid payload for party_role
    And I retrieve a role type by id for party_role
    Then the response status should be 200 or 206
    And the response body should contain id for party_role

  Scenario: Update Role Type
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the party_role service
    When I create a role type with valid payload for party_role
    And I update a role type by id for party_role
    Then the response status should be 200
    And the response body should contain id for party_role

  Scenario: Delete Role Type
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the party_role service
    When I create a role type with valid payload for party_role
    And I delete a role type by id for party_role
    Then the response status should be 204

  Scenario: Retrieve non-existent Role Type by id
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the party_role service
    When I retrieve a non-existent role type by id for party_role
    Then the response status should be 404
    And the response body should contain an error message

  Scenario: Create Party Role successfully
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the party_role service
    When I create a party role with valid payload for party_role
    Then the response status should be 201
    And the response body should contain id for party_role

  Scenario: Create Party Role missing engagedParty fails
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the party_role service
    When I create a party role missing engagedParty for party_role
    Then the response status should be 400
    And the response body should contain an error message

  Scenario: Create Party Role missing name fails
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the party_role service
    When I create a party role missing name for party_role
    Then the response status should be 400
    And the response body should contain an error message

  Scenario: Create Party Role missing roleType fails
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the party_role service
    When I create a party role missing roleType for party_role
    Then the response status should be 400
    And the response body should contain an error message

  Scenario: List Party Role
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the party_role service
    When I send a GET request to list party roles for party_role
    Then the response status should be 200 or 206
    And the response body should be a JSON array

  Scenario: Retrieve Party Role by id
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the party_role service
    When I create a party role with valid payload for party_role
    And I retrieve a party role by id for party_role
    Then the response status should be 200 or 206
    And the response body should contain id for party_role

  Scenario: Update Party Role
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the party_role service
    When I create a party role with valid payload for party_role
    And I update a party role by id for party_role
    Then the response status should be 200
    And the response body should contain id for party_role

  Scenario: Delete Party Role
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the party_role service
    When I create a party role with valid payload for party_role
    And I delete a party role by id for party_role
    Then the response status should be 204

  Scenario: Retrieve non-existent Party Role by id
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the party_role service
    When I retrieve a non-existent party role by id for party_role
    Then the response status should be 404
    And the response body should contain an error message