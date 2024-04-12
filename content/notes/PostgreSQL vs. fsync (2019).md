---
tags:
  - db
  - talks
created: 2024-07-24
source: https://www.youtube.com/watch?v=1VWIGBQLtxo
origin: Tomas Vondra
publish: true
rating: 3
---
Tomas is a long-time Postgres contributor (and now committer). Has been working with pg for 20 years.

## How pg handles durability?

```
[ Shared Buffers (managed by PG) ]            [ WAL buffers ]

[ Page Cache (kernel managed) ]

[ Data Files ] | [ WAL (uses direct IO, no page cache) ]
```

- Any changes (Insert / Update / Delete) are written to the WAL using the very small WAL buffer through direct IO.
- Changes are then done in the shared buffers.
- On commit, only the transaction log is flushed.
- Process for checkpointing (happens regularly)
	- Get current WAL position
	- Write data to page cache
	- Call fsync on all files
	- Delete unnecessary WAL

What if there's an error?
- on write
	- possible but not common since the copy is in memory and we can repeat the write from the original copy
- on fsync
	- can happen quite easily due to interaction w/ drives, SAN (storage area network) etc.
	- managed by kernel (pg doesn't have any copies)
	- can't retry since page cache is managed by the kernel

## Past Expectations

### Expectation 1
If there's an error during fsync, the next fsync call will try to flush the data from page cache again.

Reality
- The first fsync can fail with an error and data is discarded from page cache. The next fsync doesn't even try to flush this data again.
- The exact behavior depends on the filesystem.
	- ext4 leaves "dirty" data in page cache but the page gets marked as "clean" i.e. unless the data is modified again, it won't be written again making failures unpredictable
	- xfs & btrfs throws away the data but the page is marked as not up to date (this behavior is better but not POSIX compliant)


### Expectation 2
There may be multiple file descriptors (fd) per file possibly from multiple processes. If the fsync fails in one process, the failure is reported in other processes too. (Eg. someone connects and calls fsync from the console on a running database)

Reality
- Only the first process (initializing the fsync) gets the error.
- File may be closed/opened independently i.e. the other process may not see the file descriptor w/ the error.
- Behavior also depends on kernel version
	- up to 4.13, some errors may be quietly ignored
	- 2016 - first process calling fsync gets the error, other processes get nothing
	- 2017 - both processes get error, newly opened descriptors get nothing
	- 2018 - both processes get error, newly opened descriptor only gets it when no one saw it yet
- The reliable way to receive the error is to keep the oldest file descriptor around.
- But, pg didn't do this so far. It has a small cache for file descriptors (so when one process closes the file descriptor and another process needs the file, it won't need to do a system call)
- Behavior not limited to Linux
	- BSD systems behave similarly (with the exception of FreeBSD/Illumos using ZFS)

## Why did it take so long?

**Why not an issue in the past?**
- Storage was specifically designed for DBs.
- You built locally connected drives with a RAID controller with write cache and a small battery. It was really reliable.
- Failures were obvious since the system crashed.
- I/O errors were permanent rather than transient.

**Why a problem now?**
- SAN, EBS, NFS
- Thin provisioning (using virtualization to give appearance of having more resources than available)
- Transient I/O errors are more common due to thin provisioning and ENOSPC (no space on drive error)
- Was not noticed earlier.
	- Mis-attributed to other causes like NFS
	- Plenty of other sources of data corruption fixed

> Other DBs (like Oracle) manage cache internally and don't use the kernel page cache unlike pg.

**How to fix the issue?**
- Modify the kernel
	- Not relevant in the short / mid-term since changing fsync and page cache to retry would take a lot of effort.
	- Pushback from kerne; developer community.
	- Many systems have been running old kernel versions for a long time and would be reluctant to update.
- Trigger PANIC in pg
	- Make sure we get the error correctly.
	- Trigger Panic (crash) and recovery from WAL
	- Has been implemented in pg now. See https://wiki.postgresql.org/wiki/Fsync_Errors

Q/A
- Would using a pluggable storage engine prevented this error?
	- No. Pluggable storage engines also use buffered IO w/ the kernel page cache.


Appendix
- https://www.postgresql.org/message-id/flat/CAMsr%2BYHh%2B5Oq4xziwwoEfhoTZgr07vdGG%2Bhu%3D1adXx59aTeaoQ%40mail.gmail.com
- https://www.postgresql.org/message-id/flat/20180427222842.in2e4mibx45zdth5%40alap3.anarazel.de
- https://lwn.net/Articles/752063/
- https://lwn.net/Articles/724307/
- https://www.pgcon.org/2018/schedule/events/1270.en.html
	- https://www.youtube.com/watch?v=74c19hwY2oE&ab_channel=PGCon
	- https://docs.google.com/presentation/d/1D6wTVgLK701CDzUJ3iwcnp5tVwbSlzCd5aPJAdLbq8Q/edit#slide=id.p
