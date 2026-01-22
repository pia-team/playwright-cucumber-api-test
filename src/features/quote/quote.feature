Feature: Quote Management API

  Background:
    Given I have authentication credentials for user "orbitant"
    And I send a POST request to get access token
    And I have a valid authorization token from the response
    And I initialize quote service with authorization token

  @quote @getQuoteList
  Scenario: Successfully retrieve a list of quotes
    When I send a GET request to the list quotes endpoint
    Then the response status should be 200
    And the response should be a valid list of quotes

  @quote @createQuote
  Scenario: Successfully create a new quote
    When I send a POST request to create a quote with valid data
    Then the response status should be 201
    And the response should contain a valid created quote

  @quote @createQuoteError
  Scenario: Fail to create a new quote with invalid data
    When I send a POST request to create a quote with an empty body
    Then the response status should be 400
    And the response should contain an error message

  @quote @getQuoteById
  Scenario: Successfully retrieve a quote by its ID
    # This scenario requires a quote to exist. We create one first.
    Given I send a POST request to create a quote with valid data
    When I send a GET request to retrieve the quote by its created ID
    Then the response status should be 200
    And the response should contain the correct quote details

  @quote @getQuoteByIdNotFound
  Scenario: Fail to retrieve a quote with a non-existent ID
    When I send a GET request to the retrieve quote endpoint with id "nonexistent-id"
    Then the response status should be 404

  @quote @patchQuote
  Scenario: Successfully patch an existing quote
    Given I send a POST request to create a quote with valid data
    When I send a PATCH request to update the quote's description
    Then the response status should be 200
    And the response should contain the updated quote description

  @quote @deleteQuote
  Scenario: Successfully delete a quote
    Given I send a POST request to create a quote with valid data
    When I send a DELETE request for the created quote
    Then the response status should be 204
    And I send a GET request to retrieve the quote by its created ID
    Then the response status should be 404