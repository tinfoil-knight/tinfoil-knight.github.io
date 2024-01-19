---
tags:
  - db
created: 2024-11-02
---

Written By: #AlexPetrov
Created At: 02/11/23

> The most significant distinctions between database systems are concentrated around two aspects: how they store and how they distribute the data. The book is arranged into parts that discuss the subsystems and components responsible for storage (Part I) and distribution (Part II).

> Note to Self: These notes were taken when I was doing the CMU DB course so they only include things which piqued my interest (or reminded me something I forgot) so these notes aren't exhaustive. 
# Part 1 : Storage Engines

## 1 : Introduction & Overview
Dt: 02.11.23
![[Pasted image 20231102145145.png]]

- Query Optimizer for a distributed DB can also use data placement (which nodes in the cluster hold the data and the costs associated with its transfer) to determine the best query plan.
- Transaction manager maintains a logically consistent state while the lock manager maintains the physical data integrity.
- Access Methods (storage structures) : Heap files, BTrees, LSM Trees etc. that manage access & organizing data on disk.

- In-memory DBMS are also called main memory DBMS.
- Durability for in-memory disks
	- Some ways to increase RAM durability
		- Battery backed RAM
		- Uninterrupted power supplies
			- How?
	- Disk backups using some kind of log and a backup copy
		- Backup copy helps avoid replaying the entire log on startup for recovery.
		- Operations to backup copy are often async & applied in batches to reduce I/O.
		- **Checkpointing** : After applying a batch of log records, a DB snapshot can be created & all log contents upto this point can be discarded to save space & lower recovery times.
- "It is unfair to say that the in-memory database is the equivalent of an on-disk database with a huge page cache. Even though pages are cached in memory, serialization format and data layout incur additional overhead and do not permit the same degree of optimization that in-memory stores can achieve."
	- Don't Redis (and other in-memory DBs) have their own serialization format?
	- "additional overhead" doesn't really seem like a good reason to think of in-memory stores differently

- C-Store is an open source predecessor to Vertica <- Check out source code for C-Store 

- Wide Column Stores (not column oriented DBs)
	- Best for storing data retrieved by a key or a sequence of keys
	- Logical Structure: multidimensional map (just think of a nested map)
	- Physical Structure
		- Columns are grouped into column families (usually storing data of the same type)
		- Inside each column family, data is stored row-wise.
	- Eg: HBase, BigTable

- Data Files (/primary files)
	- Store data records
	- Can be implemented as
		- index-organized tables (IOT)
			- Stores data records in the index itself. Records are stored in key order.
				- What's the point? If we're bloating the index & storing all the data there then do we even have an index?
		- heap-organized tables (heap files)
			- Record not required to follow any particular order & usually placed in write order.
		- hash-organized tables (hashed files)
			- Records stores in buckets. Hash value of key determines which bucket a record belongs to. Records can be stored in append order or sorted by key.
- Index Files
	- Structure that organizes data records for efficient retrieval.
	- Clustered : Order of data records follows search key order.
	- Storage engines can create implicit primary key if not specified (eg. MySQL InnoDB adds a auto-incr column)

- An index can refer to the data record directly (through file offset) or via the primary key index.
	- Using file offset would require us to update the ptr for the primary & all the secondary indexes. It has less disk seeks though.
	- MySQL InnoDB uses primary keys for indirection in it's secondary indexes.
	- Hybrid: Store both file offsets & primary keys. Only use the index when the offset isn't valid & update it every time the index is accessed.
		- How do you decide if the offset is valid? Doesn't data shift around on deletion?

- Main concepts distinguishing storage structures
	- Buffering (things like in-memory buffer for BTrees or two-component LSM Trees)
	- Immutability (of files)
	- Ordering (of physical records as per key order)

## 2 : B-Tree Basics
Dt: 12.11.23
- Storage engines allow multiple versions of the same record to be present in the database (eg: multi-version concurrency control, slotted page organization)
- Assumption (for this chapter): Each key is associated w/ 1 data record which has a unique location.
- Problems with a balanced binary search tree:
	- Low fanout (max. allowed no. of children per node): frequent balancing, relocating nodes etc.
	- Locality (elements added in random): no guarantee that a new node is close to its parent i.e. node child ptrs may span across several disk pages
	- Tree Height: only 2 children per node so height is a large
- Criteria for good on-disk data structure:
	- High fanout : improve locality of the neighbouring keys
	- Low height : reduce no. of seeks during traversal
- SSDs
	- memory cells -> strings (32-64 cells) -> arrays -> pages -> blocks (64-512 pages) -> planes -> dies (1 or more)
	- Page size typically ranges from 2-16Kb.
	- Smallest unit that can be written or read is a page.
	- But, we can only make changes to empty memory cells & the smallest ease entity is a block.
		- Pages in an empty block have to be written sequentially.
	- Flash Translation Layer (FTL)
		- Part of flash memory controller responsible for mapping page IDs to physical locations
		- Also tracks empty, written, discarded pages
		- Responsible for garbage collection (finds blocks to safely erase)
			- If blocks contain live pages, they're relocated and remapped
	- Although there isn't a large difference b/w latency for random & sequential access, there's still some difference caused by doing:
		- pre-fetching
		- reading continuous pages
		- internal parallelism
		- avoiding the negative impact of gc for a random, unaligned write workload
		- writing only full blocks & combining subsequent writes to the same block
	- Sidenote: Since we're accessing data block wise, most OSes have a block device abstraction that hides the internal disk structure & buffers I/O internally.
- B-Trees
	- Keys stored in B-Tree nodes are also called index entries, separator keys or divider cells.
	- Lookup complexity in log(M) where M is the total no. of items in the B-Tree

## 3 : File Formats
Dt: 19.11.23
- Binary Encoding
	- Primitive Types
		- Endianness / Byte Order should be be same for encoding & decoding when working with multi-byte numeric values.
		- RocksDB has platform-specific definitions that help identify the target platform byte order.
			- If platform and value endianness are different then RocksDB reverses the bytes.
		- Primitive types have a fixed size.
	- String & Variable Size Data
		- These types can be serialized as a number (representing length of data) followed by the actual data.
		- For strings, this representation is referred to as USCD String or Pascal String.
		- Alternative: null-terminated string where the reader consumes data byte-wise until the end of string symbol is reached
	- Bit-Packed Data : Boolean, Enums, Flags
- General Principles
	- Usually you start designing a file format by deciding addressing : whether to split into same-sized pages (represented by a single block) OR multiple contiguous blocks
	- File usually starts with a fixed size header & may end with a fixed size trailer. Rest of the file is split into pages.
	- Many data stores have a fixed schema which helps reduce the amount of data that needs to be stored on disk since positional identifiers can be used in case of fixed schemas.
- Page Structure
	- Fixed Size Data Records : BTrees
	- Variable Size Records : Slotted Pages / Slot Directory
		- Problem: Reclaiming space occupied by removed records
		- Rewriting the page and moving the records works but if out of page pointers are using the record offsets then we can't simply move around records.
		- What we need from the page format:
			- Store variable-size records with minimal overhead
			- Reclaim space occupied by removed records
			- Reference records in the page without regard to their exact location
		- Slotted Page is split into sets of pointers and cells (/ slots) residing on different sides of the page.
			- Header is fixed size.
			- Pointer array holds offsets to exact positions where the records are stored.
- Managing Variable Size Data
	- Cell can be marked as deleted when its removed in an in-memory availability list which stores the amount of freed memory & a pointer to the freed value
	- SQLite calls unoccupied segments freeblocks & stores a pointer to the first freeblock in the page header. Also, it stores the total no. of available bytes within a page to check whether or not a new element can fit after defragmenting the page.
	- The first suitable segment OR the best matching (closest in size & fits) segment can be picked. First fit might cause a large overhead though because of remaining space.
	- If there's not enough space after defragmentation, an overflow page is created.
- Versioning
	- Cassandra has different prefixes for different versions.
	- pg has a PG_VERSION file to store the version.
- Checksumming & CRCs
	- Checksum aren't able to detect corruption in multiple bits.
	- CRCs can detect burst errors (when multiple consecutive bits got corrupted)
	- Checksum is written when writing the data to disk & verified during read
	- Usually checksum is calculated on pages & stored in page header