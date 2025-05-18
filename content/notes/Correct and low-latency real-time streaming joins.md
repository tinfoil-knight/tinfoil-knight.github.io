---
created: 2025-02-20
tags:
  - nyc-systems
  - talks
from: Neil Ramaswamy
source: https://www.youtube.com/watch?v=I6MJqNAM2qU
rating: 3.5
---
Neil Ramaswamy works on the streaming team at Databricks.

The world is becoming real-time. 
- Consumers want
	- Their maps app to show the current traffic conditions
	- Their short-form video to adapt to their current interests
- Enterprises want:
	- The current conversion rate of an ad campaign (eg. for optimizing Black Friday ads during a Black Friday sale)

Historical solutions
- Repeated batch jobs
	- Don't have strong delivery semantics (process something exactly once)
	- Don't handle out-of-order events
- Bespoke jobs
	- Aren't declarative ; are inaccessible to non-programmers
	- Development cycles are way longer

Streaming SQL
- SQL over constantly incoming data.
- A streaming SQL query specifies:
	- Source (eg. Kafka, S3 bucket)
	- SQL operators
	- Sink (eg. Kafka, S3)
- Engine executes query by repeatedly reading from source, applying operators and writing to sink.
- Benefits
	- Distributed
	- Declarative (anyone who knows some SQL can write queries)
	- Strong delivery semantics
	- Handles out-of-order events predictably

Agenda
- Streaming Aggregations
	- A Naive Aggregation
	- Understanding Delays
	- A Smarter Aggregation
- Streaming Joins
	- Inner Joins
	- Outer Joins

## Streaming Aggregations

Aggregate: 100s window count.
- no. of events that fall b/w 100 & 200, 200 & 300 and so on..

### A Naive Aggregation
- We use timestamps on the events.
- As events come in, you store them in some intermediate state, wait till the window is over and then take an aggregate over the window and emit it downstream.
	- How do you know if the window is over? When an event that falls into next window comes in.
- But, how to deal w/ out-of-order data?
- When do you emit results?
	- Option 1: Every time the result changes
		- Pros
			- Results are always up to date
		- Cons
			- Downstream consumers must know these semantics (eg. billing)
			- Could need to keep all record in state indefinitely (for calculating median, UDFs, etc.)
	- Option 2 : Only once, after waiting for some time
		- Pros
			- Can perform state eviction (from buffer) after "some" time
			- Downstream consumers see a canonical answer, not "refinements"
		- Cons
			- If "some" time is too long, you'll have excessively high latency

### Understanding Delays

> **A Fundamental Tradeoff in Streaming Systems**
> - If streaming SQL operators don't wait very long, you'll have:
> 	- Low latency, little state but low completeness
> - If streaming SQL operators wait too long, you'll have
> 	- High latency, huge state but high completeness

Insight: Delays aren't arbitrary
- Delays from a source usually follow some distribution .
- By choosing how much much delay we've, we configure the completeness that we get.

![[Pasted image 20250220204738.png]]


### A Smarter Aggregation
- Suppose we know the source has generated a record w/ timestamp 250. And we've chosen the delay that we'd like to wait, so anything created before the delay would've arrived before 250 was generated.
- Watermark of a Stream: min. timestamp the stream expects to see
	- Anything less than the watermark must've already arrived.

![[Pasted image 20250220205230.png]]

- We wait for out-of-order records up to the watermark. Aggregation is calculated when the watermark goes past the boundary (200 in this case) and an event arrives beyond the boundary.
- If we receive records that are too late (post aggregation of window), they're ignored.
- SQL Operators (such as aggregations) use the definition of the watermark to:
	- compute and emit a result
	- clear out intermediary state

> **True/False**
> For a streaming agg., any record stored in state w/ a timestamp less than the watermark is aggregated & evicted. Ans -> False.
	- Myth: a stream removes all records in state less than its watermark.
	- Fact 1: a stream will not acknowledge new records before its watermark
	- Fact 2 : operators leverage Fact 1 to implement their semantics 


## Streaming Joins
- Example use-case: Join ad-clicks & product-purchase stream together.
	- User scrolls an ad on FB, goes to a product page and makes a purchase. FB wants to tell the advertisers things like what % of ad-click resulted in somebody buying, how long it took b/w click and purchase.
- Keep in mind
	- Inner joins emit (L, R) for all left and right rows (L, R) that satisfy the condition.
	- Data on either side can come out-of-order.
	- We need to evict state to avoid infinite state growth.

### Inner Joins
```sql
INNER JOIN ON L.id == R.id
```
![[Pasted image 20250222212809.png]]
- As the 2 "A" events arrive on R, we emit them downstream since they satisfy the join condition w/ the "A" in L.
- When can records be evicted? Since the "A" in L can join w/ any A in R, if there's no limit, we'd need to wait eternally and wouldn't be able to evict the records.
- The click on "A" can join w/ any future purchase of "A".
- To remove the click "A", we need a way to time-bound the join condition so that we don't join w/ any future purchase "A".

State removal for inner joins
```sql
INNER JOIN ON L.id == R.id AND R.ts < L.ts + 100
```

![[Pasted image 20250222213031.png]]
- We don't join the "A" in R at 500 since it doesn't satisfy the join condition. Anything till timestamp 400 satisfies the join condition for the first "A" in L.
- Resume at: https://youtu.be/I6MJqNAM2qU?si=Fg0hk6HopEFWob0t&t=1371
### Outer Joins


## Appendix
- [Interactive "slides" for lecturing about aggregations and joins in streaming SQL systems](https://github.com/neilramaswamy/interactive-streaming)
- UDF : User Defined Functions
- 
