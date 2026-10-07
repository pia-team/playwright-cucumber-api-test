@resource_inventory @smoke
Feature: Resource Inventory API

  Scenario: Create Bulk Resource Create successfully
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the resource_inventory service
    When I send a POST request to create an Bulk Resource Create for resource_inventory
    Then the response status should be 201

  Scenario: Create Bulk Resource Create missing baseResource fails
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the resource_inventory service
    When I send a POST request to create an Bulk Resource Create missing required field baseResource for resource_inventory
    Then the response status should be 400
    And the response body should contain an error message for resource_inventory

  Scenario: Create Bulk Resource Create missing bulkCharacteristic fails
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the resource_inventory service
    When I send a POST request to create an Bulk Resource Create missing required field bulkCharacteristic for resource_inventory
    Then the response status should be 400
    And the response body should contain an error message for resource_inventory

  Scenario: Create Bulk Resource Create missing itemCount fails
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the resource_inventory service
    When I send a POST request to create an Bulk Resource Create missing required field itemCount for resource_inventory
    Then the response status should be 400
    And the response body should contain an error message for resource_inventory

  Scenario: Create Bulk Resource Status Update successfully
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the resource_inventory service
    When I send a POST request to create an Bulk Resource Status Update for resource_inventory
    Then the response status should be 201

  Scenario: Create Bulk Resource Status Update missing itemCount fails
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the resource_inventory service
    When I send a POST request to create an Bulk Resource Status Update missing required field itemCount for resource_inventory
    Then the response status should be 400
    And the response body should contain an error message for resource_inventory

  Scenario: Create Resource successfully
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the resource_inventory service
    When I send a POST request to create an Resource for resource_inventory
    Then the response status should be 201

  Scenario: Create Resource with invalid payload
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the resource_inventory service
    When I send a POST request to create an Resource missing required field name for resource_inventory
    Then the response status should be 400
    And the response body should contain an error message for resource_inventory

  Scenario: List Resource
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the resource_inventory service
    When I send a GET request to list Resource for resource_inventory
    Then the response status should be 200 or 206
    And the response body should be a JSON array

  Scenario: Retrieve Resource by id
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the resource_inventory service
    When I send a POST request to create an Resource for resource_inventory
    And I send a GET request to retrieve an Resource by id for resource_inventory
    Then the response status should be 200 or 206

  Scenario: Update Resource
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the resource_inventory service
    When I send a POST request to create an Resource for resource_inventory
    And I send a PATCH request to update an Resource for resource_inventory
    Then the response status should be 200

  Scenario: Delete Resource
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the resource_inventory service
    When I send a POST request to create an Resource for resource_inventory
    And I send a DELETE request to delete an Resource for resource_inventory
    Then the response status should be 204

  Scenario: Retrieve non-existent Resource by id
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the resource_inventory service
    When I send a GET request to retrieve non-existent Resource by id for resource_inventory
    Then the response status should be 404