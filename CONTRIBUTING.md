# Contributing

Thank you for your interest in contributing!

## 🌱 This Repo Is a Derived Scraper

This repo is a **derived scraper** — it was generated from the [EPAM Systems International SRL Node.js Scraper](https://github.com/sebiboga/epam-systems-international-srl-nodejs-scraper) template.

This scraper scrapes job listings for **GUSTURI DIVINE S.R.L.** from ANOFM (Agentia Nationala pentru Ocuparea Fortei de Munca) and publishes them to peviitor.ro via the Peviitor API.

## How to contribute

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## Code style

- ES modules (import/export)
- Jest for testing
- No hardcoded company identity — all configuration lives in `scraper/config/company.json`
