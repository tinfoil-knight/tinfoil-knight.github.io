---
tags:
  - db
  - talks
  - cmudb-seminar
created: 2024-08-08
source: https://www.youtube.com/watch?v=FCs7Dz8hgjQ
from: Adam Kocoloski
publish: true
rating: 4
---
Adam is an IBM Fellow working on cloud file systems. Co-founder of Cloudant (based on Apache CouchDB) which was acquired by IBM.

CouchDB
- Document Store: JSON documents with primary keys
- Built in change feeds
- Event-drive
- Active-active replication
- Async Materialized View Maintenance
- Written in Erlang
- Secondary indexes are maintained async

## Copy-on-Write Storage
- Uses a BTree-like data structure internally.
- Append only on disk
	- write document, updated leaf node, path up to the root.
	- then do an fsync followed by writing the header and another fsync for durable storage.
- Snapshot isolation is straight-forward
	- Reader grabs the last header that they can observe in that file and use whatever the header points to for all subsequent operations.
	- Any concurrent writes will happen after that point in file and won't be observed by the reader with that header.
- Crash recovery is simpler
	- Just seek backward to find last committed header. Truncate everything after the last committed header.
	- Every prefix of a DB file is itself a valid DB.
- Files becomes bloated over time and require regular compaction.
	- Get all entries accessible by latest DB header, write to a new file and then drop the old one.

Q/A
- Is there a BTree per table or is it per database?
	- CouchDB doesn't have tables. Just databases w/ documents in them. No native joins b/w databases.
-  Are secondary indexes just B+ trees updating async?
	- Yeah. There are 2 indexes that are maintained atomically on write. Everything else is async.
	- The other atomically maintained index is for all documents that ever existed ordered by most recent update.

## Change Feeds
- The atomically maintained most recent update index is used for:
	- Compaction
	- Materialized Views
	- Replication
- Exposed via a JSON endpoint
	- Doesn't require persistent connectivity. Just need to remember the last sequence number used.
- Q/A
	- Is this index compacted?
		- Yes. But tombstone entries for deletion aren't removed.
		- All other extra metadata is removed. (For eg: if a document is updated/deleted later on, you wouldn't get the older update if you didn't request the document before compaction happened)

## View Engine
- Only way to index documents by user defined attributes in CouchDB 1.x.
- User supplied JS function executes in a sandboxed context.
- Maintenance is async using change feed.
	- If you query a view, CouchDB will refresh it automatically.
```javascript
// Eg: map function
function (doc) {
	if (doc.type == "post"){
		emit([doc._id, doc.created_at])
	} else if (doc.type == "comment"){
		emit([doc.parent_id, doc.created_at])
	}
}

// DB
{
	_id: "p1"
	type: "post"
	created_at: "2009/01/30 08:04:11"
	content: "Hello World ..."
}

{
	_id: "c1"
	parent_id: "p1"
	type: "comment"
	created_at: "2009/01/30 12:30:15"
	content: "Amazing blog"
}

{
	_id: "c2"
	parent_id: "p1"
	type: "comment"
	created_at: "2009/01/30 12:50:00"
	content: "Insightful post"
}
```
- How it works?
	- Create a special class of document called a design document which has one or more JS functions insides that creates views.
	- JS functions get executed against all documents in the DB. The functions can choose to emit 0 or 1 key-value pair for each document that they process.
- Can be used to create indexes, mimic joins, perform aggregations etc.
- View is stored using a BTree.
	- Aggregations are stored in the inner nodes of the tree.
	- In the main indexes of the DB, only basic statistics is stored. Not user controlled.
	- In the view engine, user can specify custom statistics that need to be maintained. Some functions like sum, count, min, max, approx distinct count are built-in. JS functions can be used to define custom stats. (reduce function)
- Views are maintained incrementally.

```javascript
// Eg:

// map function
emit([dt.year, dt.month, dt.date], doc.total_sale)

// reduce function
reduce:_sum

// query
_view/by_date?startkey=[2010, 1, 1]&endkey=[2010, 2, 1]
```


Q/A
- Does the BTree-like data structure have variable node sizes?
	- Yeah. The chunking function on the nodes won't have the same no. of children everytime.
	- If the aggregation gets too large,  you end up with a tall BTree as a result.

## Replication
- You can setup active-passive replication using change feeds.
- But CouchDB also supports active-active replication.
- People take a replication of a database and then take the second instance into a disconnected environment. Eg. airline infotainment systems
	- The disconnected system might also take updates in its disconnected state.
- Servers can disconnect for long periods of time. Writes can land in multiple locations. No edit should get lost.

### Revision Tracking: Hash History Forests
- Each document maintains its own revision history.
- Revision ids are deterministically generated from contents of the document (including previous revision id)
- No notion of actor like you'd get in a [vector clock](https://en.wikipedia.org/wiki/Vector_clock) or a [dotted version vector](https://dl.acm.org/doi/10.1145/2332432.2332497)
- No actual merge operation. Only one branch of history is kept alive. Update is submitted to one edit branch and other branches are marked as deleted.
- Only the last N entries are kept but no branch is ever discarded.
	- N = 1000 by default
	- Since servers can disconnect for long periods of time, you can get a spurious conflict and when you do replication, there's no way to link together larger edit histories and the disconnected document will appear to be a sibling of the original one. ???
	- Q/A: Is the cleanup of history done on a dedicated background thread or is it cooperative?
		- Cleanup of the bodies of documents is a background thread (happens during compaction).
		- Cleanup of metadata (revision history information) happens on connect.
- All "leaf" revision contents are preserved for user-driven resolution.
	- Final entry of each edit branch is always preserved.
## Clustering
- Was initially implemented in 2.x
- Databases are split into shards.
- Shards are replicated across nodes.
- Documents are mapped to shards using consistent hashing on document id.
- Each replica independently chooses whether to commit and update.
	- How?
- Secondary indexes built local to each shard. Coordinator needs to check in with every shard to gather the final result.
	- Since there's no quorum on secondary indexes, a replica with stale data might respond.
- Q/A: What's the worst behavior you've observed?
	- We keep patching the systems to avoid incorrect behaviors. Replicas that have been down for a period of time knows that its not up to date and opts out of responding to requests.
- Issues w/ this old Clustering Design (from 2.0 - 3.1.1)
	- Query scaling
		- Low throughput for global query processing even with a lot of computing resources
	- Lagging / non-monotonic index reads (for secondary indexes)
	- Replayed change feeds
		- The sequence index is not necessarily identical amongst all the replicas of an individual shard. Updates can get applied out of order.
		- Updates won't be missed but users can see an update more than once.
	- Unavoidable edit conflicts
		- For concurrent writers modifying the same piece of data
- Attempts at fixing
	- Tried to work on a Raft-style consensus mechanism among individual replicas of individual shards.
	- Wanted to preserve existing API, have a reliable solution, support scaling up and down.
	- Explored integration with FoundationDB.
- With FoundationDB : Consistency at Scale
	- FDB provides strict serializability in the underlying K-V store.
	- Edit conflicts for apps targeting a single CouchDB instance were eliminated (considering a single cloud region).
	- Helped refocus CouchDB's active-active replication on cross-region, hybrid and multi-cloud use cases.
	- Distributed txns. in FDB enable secondary indexes (for views, search, query) to scale alongside primary data without sacrificing consistency.
	- Change feed is provides a totally ordered, sortable list of edited documents. Rewinds (update can re-appear in the feed) are eliminated.
		- FDB allows adding the version stamp into your key at commit time which allows having an ordered list of updates.

> FDB integration was later abandoned due to sponsorship issues from IBM. See https://lists.apache.org/thread/9gby4nr209qc4dzf2hh6xqb0cn1439b.

Q/A
- In terms of market, why do you think MongoDB and CouchDB succeeded while other NoSQL DBs like Rethink failed? Why do you think Mongo has the larger "mindshare"?
	- We tried offering DB-as-a-service very early on and didn't focus on any other distribution mechanism which helped since people wanted to offload DB admin work.
	- Mongo had a really large DX team (much larger than core DB) and had a lot of client libraries for every new framework. CouchDB neglected this since they though that HTTP and JSON was enough.
- If you had to write CouchDB from start again, would you go with Erlang?
	- Erlang's process isolation and runtime debugging abilities were helpful as a startup shipping untested DB versions every week.
	- Hiring was an issue. The community is doing interesting things now (like Elixir) and there are other production users (like WhatsApp).
	- I would probably use it again but write more lower level stuff in Rust.
- What's the  biggest engineering challenge you're facing at CouchDB now?
	- Too lax about limits on things like max txn. duration, size of individual fields etc.
	- Now, there are users who exceed these limits but their data is already in production so hardening those limits is difficult.
## Appendix
- [Introduction to Views — Apache CouchDB](https://docs.couchdb.org/en/stable/ddocs/views/intro.html)
- Source: https://github.com/apache/couchdb