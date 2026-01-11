# Claude Code Instructions

## Versioning

When making meaningful changes to functionality (new features, significant bug fixes, behavior changes):

1. Bump the version in `public/whats-new.txt`
2. Add the new version at the TOP of the file
3. Format: `X.Y:` followed by bullet points describing changes
4. Current version scheme: `0.X` (incrementing minor version)

Example:
```
0.11:
- Description of new feature or change
- Another change in this version

0.10:
- Previous version changes...
```

Do NOT bump version for:
- Code refactoring without behavior changes
- Configuration changes (ports, env vars)
- Documentation updates
- Dependency updates
