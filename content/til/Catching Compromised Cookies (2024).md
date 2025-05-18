---
tags:
  - til
created: 2025-02-13
source: https://slack.engineering/catching-compromised-cookies/
from: Ryan Slama, Oliver Grubin, Grace Li
publish: true
---
_session forking_ : cookie being used from more than one device at the same time

- initial approach
	- match last access timestamp
		- can't know which forked session is legitimate, only that session is forked
		- false positive in some cases (eg: client didn't receive the cookie after the server has generated it and registered the new timestamp)
	- match ip address too
		- if last timestamp is different but ip address is same then the request is likely from the same client
		- reduced false positives from only matching last access timestamp
- better approach
	- only update timestamp when it's confirmed that the client has stored the new cookie
	- how?
		- 2-phased approach ; each request is idempotent
		- to update the session cookie, send a separate "session candidate" cookie
		- if client makes a request with the session candidate cookie then its upgraded to the session cookie
	- aside: in case of a race condition (client sends a group of requests in quick succession), the db is updated for the first request that comes in & the timestamp value is ignored for other requests since the timestamp was set recently
- further
	- they use device and network information now too in addition to timestamp
	- risk level is categorized into different levels (low, mid, high) & high level events send an alert
	- perf: if last access timestamp in the cookie is recent, db is not checked for it to avoid too many reads (if the session was forked, they would've already detected it)