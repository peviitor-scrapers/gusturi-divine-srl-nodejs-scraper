# Robots.txt Analysis — ANOFM

Sursa: https://mediere.anofm.ro/robots.txt

## Reguli

```
User-agent: *
Allow: /
```

## Interpretare

ANOFM permite accesul tuturor crawler-elor pe întreg site-ul.

## Recomandare

ANOFM API-ul public este singura sursă de date pentru acest scraper. Folosim endpoint-ul POST `/api/entity/vw_public_job_posting` pentru a căuta job-uri după CIF-ul companiei. Comportamentul este politicos (rate limiting, User-Agent standard).
