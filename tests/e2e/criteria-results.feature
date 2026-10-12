@e2e-criteria
Feature: Approved criteria keep running after a failure

  @api @generic-http
  Scenario: missing taxNumber fails and a filled list still passes
    Given the API request uses auth mode "NONE"
    When the user sends a GET request to "/users"
    And criterion "a1" holds: "Response içinde taxNumber bulunmalı"
      """
      {"id":"a1","description":"Response içinde taxNumber bulunmalı","type":"field_exists","path":"$.taxNumber","operator":"exists"}
      """
    And criterion "a2" holds: "users dolu olmalı"
      """
      {"id":"a2","description":"users dolu olmalı","type":"non_empty","path":"$.users","operator":"non_empty"}
      """
    Then the API response status should be 200
