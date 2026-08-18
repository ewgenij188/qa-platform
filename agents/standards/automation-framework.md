# Automation Framework Standard

## Purpose

The automation framework must provide:

- Fast feedback
- High maintainability
- Low flakiness
- Easy onboarding
- CI/CD compatibility
- Parallel execution support

---

# Technology Stack

## Language

- Java 25

## Build Tool

- Maven

## Test Framework

- JUnit 5

## UI Automation

Preferred order:

1. Selenide
2. Playwright Java
3. Selenium WebDriver

## API Automation

- RestAssured
- Jackson
- Lombok

## Reporting

- Allure Report

---

# Project Structure

src/test/java

├── tests
├── pages
├── api
├── models
├── data
├── utils
├── config
├── assertions
├── listeners
└── integrations

---

# Design Principles

- SOLID
- DRY
- KISS
- YAGNI

---

# Test Design

Every test must follow:

Arrange
Act
Assert

Example:

1. Prepare data
2. Perform action
3. Verify outcome

---

# Logging

Required:

- API requests
- API responses
- Important business actions
- Failures

Do not log:

- Passwords
- Secrets
- Tokens

---

# Stability Rules

Avoid:

- Thread.sleep()
- Hardcoded waits
- Shared test data

Prefer:

- Explicit waits
- Dynamic test data
- Independent tests

---

# CI Requirements

Tests must:

- Run in parallel
- Run headless
- Be independent
- Produce Allure results