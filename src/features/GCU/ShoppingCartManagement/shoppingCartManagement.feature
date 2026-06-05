@shoppingCart
Feature: Shopping Cart API

  @shoppingCart
  Scenario: Create Shopping Cart successfully
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the shoppingCartManagement service
    When I send a POST request to create a shopping cart with valid payload for shoppingCartManagement
    Then the response status should be 201

  @shoppingCart
  Scenario: Create Shopping Cart with invalid payload
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the shoppingCartManagement service
    When I send a POST request to create a shopping cart with invalid payload for shoppingCartManagement
    Then the response status should be 400
    And the response body should contain an error message

  @shoppingCart
  Scenario: List Shopping Cart
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the shoppingCartManagement service
    When I send a GET request to list shopping carts for shoppingCartManagement
    Then the response status should be 200 or 206
    And the response body should be a JSON array

  @shoppingCart
  Scenario: Retrieve Shopping Cart by id
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the shoppingCartManagement service
    When I send a POST request to create a shopping cart with valid payload for shoppingCartManagement
    Then the response status should be 201
    When I send a GET request to retrieve a shopping cart by id for shoppingCartManagement
    Then the response status should be 200 or 206

  @shoppingCart
  Scenario: Update Shopping Cart
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the shoppingCartManagement service
    When I send a POST request to create a shopping cart with valid payload for shoppingCartManagement
    Then the response status should be 201
    When I send a PATCH request to update a shopping cart for shoppingCartManagement
    Then the response status should be 200

  @shoppingCart
  Scenario: Delete Shopping Cart
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the shoppingCartManagement service
    When I send a POST request to create a shopping cart with valid payload for shoppingCartManagement
    Then the response status should be 201
    When I send a DELETE request to delete a shopping cart for shoppingCartManagement
    Then the response status should be 204

  @shoppingCart
  Scenario: Retrieve non-existent Shopping Cart by id
    Given I have authentication credentials for the configured test user
    When I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize the shoppingCartManagement service
    When I send a GET request to retrieve a non-existent shopping cart by id for shoppingCartManagement
    Then the response status should be 404