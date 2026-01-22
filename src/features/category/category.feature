Feature: Category API

  @getCategoryList
  Scenario: Get category list
    Given I have authentication credentials for user "orbitant"
    And I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize category service with authorization token
    When I send a GET request to the category endpoint
    Then the response status should be 200
    And the response should contain category data

  Scenario: Get category list with valid headers
    Given I have authentication credentials for user "orbitant"
    And I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize category service with authorization token
    And I set the required headers
    When I send a GET request to the category endpoint
    Then the response status should be 200
    And the response content type should be "application/json"

  Scenario: Get category list with different user
    Given I have authentication credentials for user "{string}"
    And I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize category service with authorization token
    When I send a GET request to the category endpoint
    Then the response status should be 200
    And the response should contain category data
