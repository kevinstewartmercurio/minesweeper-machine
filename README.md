# Minesweeper Machine
[![image](https://img.shields.io/badge/bun-282a36?style=for-the-badge&logo=bun&logoColor=fbf0df)](https://bun.com/docs)
[![image](https://img.shields.io/badge/Playwright-45ba4b?style=for-the-badge&logo=Playwright&logoColor=white)](https://playwright.dev/)

A program that implements a human's approach to Minesweeper.

## Prerequisites
This project was built using [Bun](https://bun.com/docs) v1.3.6 and [Playwright](https://playwright.dev/) v1.57.0.

To install Bun, follow their [installation documentation](https://bun.com/docs).

The `@playwright/test` package will be installed as a project dependency but in order to give Playwright access to the Chromium browser run:
```bash
bunx playwright install
```

## Installation
Install project dependencies with:
```bash
bun install
```

Then run with:
```bash
bun index.ts
```

## Flags
Default behavior:
```bash
bun index.s --headless=false --verbose=false --size=sm --difficulty=expert
```

| **Flag**       | **Values**                         | **Description**                                           |
|----------------|------------------------------------|-----------------------------------------------------------|
| `--headless`   | `true`,`false`                     | Runs the browser in headless mode without user interface. |
| `--verbose`    | `true`,`false`                     | Logs flags applied and squares opened during each phase.  |
| `--size`       | `sm`,`md`,`lg`                     | Adjusts browser viewport size.                            |
| `--difficulty` | `beginner`,`intermediate`,`expert` | Sets game difficulty.                                     |
