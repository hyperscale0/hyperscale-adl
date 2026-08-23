# Security policy

## Reporting a vulnerability

Report privately through GitHub: open the **Security** tab of this repository
and choose **Report a vulnerability**. That opens a private advisory only the
maintainers can read.

Do not open a public issue for a vulnerability, and do not include credentials
or production data in a report.

What helps: the version, what an attacker gains, and the smallest reproduction
you have. A declaration that triggers the bug is ideal, with every locator
value removed.

We acknowledge reports within three working days and tell you what we intend
to do. Fixes ship on the current alpha line; there are no backports before
1.0.0.

## Scope

This package validates declarations. It performs no network calls, reads no
credentials, and executes nothing an adapter author does not import
themselves. Reports about the runtime that executes adapters belong to the
platform, not here.

`ProviderCredentialReference` stores locators only, never secret values. A
declaration carrying a real credential is a mistake in that repository, not a
vulnerability in this one, but tell us if ADL made it easy.
