---
title: 'DX Gallery'
date: '2022-07-03'
layout: ../../layouts/Post.astro
draft: true
---

> This is a collection of experiences with developer tools, libraries, programming languages etc. that stood out to me.

## Errors : [Go](https://go.dev/)

```go
i, err := strconv.Atoi("42")
if err != nil {
    fmt.Printf("couldn't convert number: %v\n", err)
    return
}
fmt.Println("Converted integer:", i)
```

While it's way more verbose than just throwing code under large try-catch blocks, this explicitness of getting a result or an error always forces you think about different logical flows and handle as many known errors as possible.

When writing simple one-off scripts, you can ignore the errors by doing this:

```go
i, _ := strconv.Atoi("abc")
```

Ref: [Errors | A Tour of Go](https://go.dev/tour/methods/19)

---

## Framework Onboarding : [Astro](https://astro.build/)

Astro is a static site builder.

Their landing page has a prominent CTA that takes you to a page with a hand-picked set of examples linked to sites that allow you to edit & see changes live.

??? **image missing here**

Most frameworks have a examples or showcase gallery hidden littered with random sites. Those sites don't really tell you much about the capabilities of the framework.
I can build that same site with vanilla JS if I wanted to.

Astro's examples page really allowed me to see how the codebase would look like for different sites and allowed me to change things & interact with them without cloning some repo & installing a ton on dependencies to just end up deleting it a few minutes later.
