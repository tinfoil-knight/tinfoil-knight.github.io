---
tags:
  - til
created: 2024-03-21
---
`git remote set-url origin <url-of-your-fork>`

For pulling code from the upstream `main branch:
`git remote add upstream <url-of-upstream-repo>`

`git fetch upstream`
`git branch --set-upstream-to=upstream/main main`

To push to the `main` branch on your fork, just do this once:
`git push -u origin main`