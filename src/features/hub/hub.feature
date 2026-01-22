Feature: Hub API for Event Listeners

  Background:
    Given I have authentication credentials for user "orbitant"
    And I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize hub service with authorization token

  @hub @getListeners
  Scenario: Successfully retrieve a list of registered listeners
    When I send a GET request to the list listeners endpoint
    Then the response status should be 200
    And the response should contain a valid list of listeners

  @hub @registerListener
  Scenario: Successfully register a new listener
    When I send a POST request to register a listener with a valid callback
    Then the response status should be 201
    And the response should contain the registered listener details

  @hub @registerListenerError
  Scenario: Fail to register a listener without a callback URL
    When I send a POST request to register a listener with an empty body
    Then the response status should be 400
    And the response should contain an error message

  @hub @unregisterListener
  Scenario: Successfully unregister an existing listener
    Given I send a POST request to register a listener with a valid callback
    When I send a DELETE request for the created listener
    Then the response status should be 204