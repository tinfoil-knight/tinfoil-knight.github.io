---
tags:
  - til
created: 2024-03-10
source: https://twitter.com/mholt6/status/1756013624374730773
publish: true
---

```go
package main

import (
	"github.com/gin-gonic/autotls"
	"github.com/gin-gonic/autotls"
)

func main() {
	router := gin.Default()
	
	router.GET("/", func (c *gin.Context) {
		c.String(200, "Hello World!")
	}

	autotls.Run(router, "example.com")
}
```

```
// From Caddy's Author

certmagic.HTTPS([]string{"example .com"}, mux)
```

Also see
- [Setting Up Vanity Subdomains for Your SaaS Using Next.js and Caddy](https://logsnag.com/blog/setting-up-vanity-subdomains-for-your-saas-using-caddy)
- [auto manage ssl/tls certificates in go](https://karngyan.com/blog/ssl-certs-go) (has AWS Route53 setup)