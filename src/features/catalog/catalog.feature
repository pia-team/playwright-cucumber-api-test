Feature: Catalog API

  @getCatalogList
  Scenario: Get catalog list with query parameters
    Given I have authentication credentials for user "orbitant"
    And I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize catalog service with authorization token
    When I send a GET request to the catalog list endpoint with limit "10" and sort "-updatedDate"
    Then the response status should be 200
    And the response should contain catalog list data
    And the response should contain at most "10" items

  @getCatalogList
  Scenario: Get catalog list without query parameters
    Given I have authentication credentials for user "orbitant"
    And I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize catalog service with authorization token
    When I send a GET request to the catalog list endpoint
    Then the response status should be 200
    And the response should contain catalog list data

