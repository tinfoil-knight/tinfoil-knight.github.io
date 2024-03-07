---
tags:
  - db
  - talks
created: 2024-02-29
source: https://www.youtube.com/watch?v=drgriZCRyrQ
origin: Ben Johnson <benbjohnson>
publish: true
---
- Ben is the author of [Litestream](https://github.com/benbjohnson/litestream) & the key-value store [BoltDB](https://github.com/boltdb/bolt).
- What Litestream Does
	- Streaming replication for SQLite
	- Backs up to S3, network disks, SFTP etc.
	- Adds high durability to a single node deployment

## SQLite Review
- SQLite Internal Structure
	- Physical Layout: Fixed size pages in a file (usually 4KiB but can be changed)
	- Logical Layout: B+ Tree
- Early SQLite
	- Had a transaction mechanism called rollback journal. If you wanted to make a change in the DB transactionally, you'd copy out the older version of the page to a file called the rollback journal & you'd make changes inside the DB. If anything fails, just copy back the file from the rollback journal.
	- Bad concurrency. Single writer OR multiple readers.
- Modern SQLite
	- WAL added in 2010.
		- Improved read concurrency, performance.
		- Single writer AND multiple readers. Multiple versions of pages exist. Each reader gets its own snapshot at the point-in-time it started.
		- Serializable isolation.

## How Litestream Works
- Only works with SQLite WAL mode.
- SQLite's WAL journaling mode writes new pages to a "-wal" file.
- If a query starts after a page has been modified by some txn then that page will be read from the WAL & the rest of the pages (which aren't modified by the point the query started) will be read from the DB.
- SQLite Checkpointing : When WAL grows too large, latest versions of pages are written back to the DB.
	- By default the WAL gets upto 4MB before checkpointing.
- Litestream checks the WAL continuously (every second) & copied out segments to a shadow WAL. Use some kind of checksum to verify consistency of data. Also detects when the WAL checkpoints & truncates and then creates a new shadow WAL. 
- Shadow WAL acts as the staging area to push out later to durable storage periodically (default is 10s but can be configured).
- Q/A: Do you batch when copying to S3 or copying as is?
	- We take a chunk of the subset of WAL to copy to S3. We might concatenate some chunks but we're not really batching.
- Litestream also pushes the snapshot of the whole DB separate from the WAL file everyday so that once you've a snapshot you only need to replay the WAL files that occurred after that.
	- You can do a point-in-time recovery for any period after the last snapshot until the next snapshot is created.
- Data window loss is around 1s. (if you configure Litestream to copy to S3 every second)
- Q/A: Can pages be split across the WAL segments?
	- No. The segments always contain full txns. so you won't have a txn. split across segments. All the pages are within those txns.
- Q/A: The logical tree contain ptrs or page addresses. When these pages are moved to S3, how is the SQLite DB restored from this backup?
	- The page ptrs within the BTree are ptrs to page number & not to a specific version of a page. When you restore from S3, you copy the pages into the same position in the DB.

## Failure Modes
- Data Loss Window
	- Litestream uses async replication & will lose up to X seconds of data during catastrophic failure where X is the configured sync interval.
	- Makes attempt to push to durable storage on clean shutdown. 
- Restore
	- WAL is replicated as-is w/ no compaction. More WAL segments means longer restore times.
	- WAL downloaded in parallel from S3.
	- LZ4 compressed.
	- Increasing snapshot frequency improves restore performance.
- Multiple instances can corrupt
	- Litestream is single-instance only
	- Replicating from multiple sources to a single path will corrupt backups because each instance will delete the other instance's data.
	- In cases like blue-green deployment (where 2 versions of an app are running for sometime), data can get corrupted.
- Restarting your instance
	- Will incur downtime
	- Restarts are less common for older VPS models but more common for ephemeral models like FlyIO, K8s.

> Sidenote: Costs (with S3)
> - AWS S3 ingress is free.
> - PUT requests are 0.005$ / 1000 req.
> - Replicating every second costs $13 / month & every 10 seconds costs $1.30/month.

## LiteFS
- People wanted realtime read replication & high availability. So, they made LiteFS.
- LiteFS is a Distributed File System for SQLite databases.
- FUSE-based.
- Cluster of nodes share the same SQLite data.
- Single-writer elected via Consul lease.
- Instant point-in-time restores.
- Why FUSE?
	- SQLite has a virtual file system but requires user intervention (load an extension every session before use).
	- FUSE allows fine grained control which lets them do things like prevent writes of read replicas, redirect writes etc.
	- Multi-process support.
- Why cluster SQLite?
	- Improve availability esp. during deploys
	- Replicate to edge
- Leader Election via Lease (and not Raft)
	- Ben wrote the initial raft library for etcd but wanted to keep Litestream simple.
	- Raft has strict distributed consensus guarantees which isn't required for all applications.
	- Consul Lease allows for loose membership.
	- Rolling DB checksum tracked at every txn.
		- Uses XOR CRC64 with the old checksum of the page & add in the new one.
		- Fast to compute & provided constant integrity checking.
		- Allows for mostly monotonic txn ID.
		- If a primary (w/ a txn that hasn't been pushed to replicas) goes down & another node comes up then you've some divergence b/w nodes. The checksum helps realise the divergence & reset state. (Some data is lost but the DB isn't corrupted)
- Instant Point-inTime Restore
	- Introduces Lite Transaction (LTX) file format instead of raw WAL.
	- LTX files are compactable from multiple streams.
		- Durable storage can be rolled up into higher level LTX files.
	- Can use this to have a staging area for every PR.
- Alternatives
	- Regular Backups w/ cron (can be done in addition w/ Litestreams)
	- Raft-based replication tools: rqlite, dqlite
		- Better consistency & durability guarantees but more complex to set up & maintain.
	- VFS-based Replication: verneuil, LiteReplica,
		- Implemented via virtual file system within SQLite
		- Must be compiled/linked into the application
	- Postgres & MySQL

## Q/A
- How big can the DB be for these tools to work well?
	- Targeting around 1-10GB DBs.
- Litestream is blindly copying pages w/o parsing them. Have you thought about some optimizations you could do?
	- Litestream does parse the WAL file. There's a header for the whole WAL & one for each frame which is used to delineate txn. 
	- We could do Change Data Capture (CDC).
- How much load does running Litestream add onto a machine?
	- Not much really. Most of the pages are recent & will be in the page cache. Analysis is pretty minimal since the WAL is mostly copied so it doesn't require much processing time.