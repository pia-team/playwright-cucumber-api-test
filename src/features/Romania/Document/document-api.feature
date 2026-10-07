@document-api @smoke
Feature: Document Management API

  Scenario: Create document success
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the document-api service
    When I send a POST request to create a document for document-api
    Then the response status should be 201
    And the response body should contain id for document-api

  Scenario: Create document negative - missing required name
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the document-api service
    When I send a POST request to create a document with missing name for document-api
    Then the response status should be 400
    And the response body should contain an error message

  Scenario: List documents
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the document-api service
    When I send a GET request to list documents for document-api
    Then the response status should be 200 or 206
    And the response body should be a JSON array

  Scenario: Get document by id
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the document-api service
    And I have a created document id for document-api
    When I send a GET request to retrieve a document by id for document-api
    Then the response status should be 200
    And the response body should contain id for document-api

  Scenario: Update document via PATCH
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the document-api service
    And I have a created document id for document-api
    When I send a PATCH request to update a document for document-api
    Then the response status should be 200
    And the response body should contain updated name for document-api

  Scenario: Delete document
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the document-api service
    And I have a created document id for document-api
    When I send a DELETE request to delete a document for document-api
    Then the response status should be 204

  Scenario: Get document by id returns 404 for non-existent
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the document-api service
    When I send a GET request to retrieve a non-existent document for document-api
    Then the response status should be 404
    And the response body should contain an error message

  Scenario: Create attachment success
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the document-api service
    When I send a POST request to create an attachment for document-api
    Then the response status should be 201
    And the response body should contain id for document-api

  Scenario: Create attachment negative - missing required fields
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the document-api service
    When I send a POST request to create an attachment with missing required fields for document-api
    Then the response status should be 400
    And the response body should contain an error message

  Scenario: List attachments
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the document-api service
    When I send a GET request to list attachments for document-api
    Then the response status should be 200 or 206
    And the response body should be a JSON array

  Scenario: Get attachment by id
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the document-api service
    And I have a created attachment id for document-api
    When I send a GET request to retrieve an attachment by id for document-api
    Then the response status should be 200
    And the response body should contain id for document-api

  Scenario: Update attachment via PATCH
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the document-api service
    And I have a created attachment id for document-api
    When I send a PATCH request to update an attachment for document-api
    Then the response status should be 200
    And the response body should contain updated name for document-api

  Scenario: Delete attachment
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the document-api service
    And I have a created attachment id for document-api
    When I send a DELETE request to delete an attachment for document-api
    Then the response status should be 204

  Scenario: Get attachment by id returns 404 for non-existent
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the document-api service
    When I send a GET request to retrieve a non-existent attachment for document-api
    Then the response status should be 404
    And the response body should contain an error message