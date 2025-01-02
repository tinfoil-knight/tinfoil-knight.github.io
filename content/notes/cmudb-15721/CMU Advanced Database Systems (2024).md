---
tags:
  - db
from: Andy Pavlo
---

## 1: Modern OLAP Databases
Date: 12/08/24
### Background
- 1990s - Data Cubes
	- DBMS would maintain multi-dimensional arrays as pre-computed aggregation to speed up queries (think of these as materialized views).
		- Periodically refreshed.
		- Cubes had to be specified ahead of time.
	- Were often introduces in existing operational DBMSs originally designed to operate on row-oriented data.
	- Eg: Microsoft SQL Server, Sybase, Teradata, Informix, IBM DB2.
		- Teradata was one of the first OLAP systems.
- 2000s - Data Warehouses
	- Monolithic DBMSs designed to efficiently execute OLAP workloads using column-oriented data.
	- Many systems started as Postgres forks and changed the storage and execution engine for columnar data.
	- Used proprietary encoding / formats for storing data.
	- Eg: Netezza, Paraccel, MonetDB, Greenplum, Datallegro, Vertica
		- Paraccel is the system AWS Redshift is based on.
		- MonetDB was written at CWI. DuckDB is derived from MonetDB.
- 2010s - Shared-Disk Engines
	- Relied on distributed storage (object stores) instead of using a custom storage manager.
	- Earlier generation managed data files themselves.
	- Newer systems allow external entities to add new data files to storage w/o enforcing schema (lakehouse architecture[^1]). 
	- Eg: Hive, Drill, Druid, Databricks, Snowflake, Redshift, Spark, Trino, Pinot, BigQuery
- 2020s - Lakehouse Systems
	- Middleware for data lakes that adds support for better schema control / versioning with transactional CRUD operations.
		- Store changes in row-oriented log-structured files w/ indexes.
		- Periodically compact recently added data into read-only columnar files.
	- Eg: Databricks, Apache Hudi, Iceberg, Snowflake, Google Napa .
- Some observations from the Lakehouse paper
	- People want to execute more than just SQL on data.
		- There are extensions that allow writing UDFs but most people aren't using that. ML workloads have different access patterns.
	- Decoupling data storage from DBMS reduces ingest/egress barriers.
	- Most data is unstructured (videos, images etc.) / semi-structured (JSON, CSV etc.).
- Recent trend in the last decade is the breakout of OLAP DBMS components into standalone services and libraries:
	- System Catalogs
	- Intermediate Representation
	- Query Optimizers
		- [Calcite](https://calcite.apache.org/)
		- [Orca](https://15721.courses.cs.cmu.edu/spring2016/papers/p337-soliman.pdf)
			- [Integrating the Orca Optimizer into MySQL](https://openproceedings.org/2022/conf/edbt/paper-87.pdf)
	- File Format / Access Libraries
	- Execution Engines / Fabrics
### Architecture Overview
![[Pasted image 20240812033557.png]]
### Distributed Query Execution
- Query plan should ideally be a DAG of physical operators.
	- Tree-like plans cause problems with nested queries or subqueries since we might want to re-write or re-use computation from one part of the query for another query but you can't do that in a tree.
	- Apache Datafusion uses a tree-based plan.
- For each operator, the DBMS considers where input is coming from and where to send output ahead of time so that it knows how to orchestrate and schedule the query.

![[Pasted image 20240812033650.png]]

Unit of work for worker nodes is going to be pipeline. We stop at the pipeline breaker and distribute data around as needed.
- By shuffling nodes: Hash data based on some partitioning key and distribute them across nodes.
	- Not all OLAP systems do this. BigQuery, Dremel do.
	- (optionally) Pipeline breakers can also decide whether additional capacity is needed or some change needs to be done in the query plan.

#### Data Categories
- Persistent Data
	- "Source of record" for the DB.
	- Modern systems assume that these data files are immutable but can support updates by rewriting them.
		- Files on an object store like S3 can't be modified for just a specific byte-range and requires updating the entire thing.
- Intermediate Data
	- Short-lived artifacts produced by query operators during execution & then consumed by other operators.
	- Practically, the amount of intermediate data that a query generates has little to no correlation to amount of persistent data that it reads or the execution time.

#### Distributed System Architecture
A distributed DBMS's system arch. specifies the location of DB's persistent data files. This affects how nodes coordinate with each other and where they retrieve/store objects in the DB.

Two approaches (not mutually exclusive):
- Push Query to Data
	- Made sense in old days when disc and networking was very slow. Network isn't necessarily that much slower than disk nowadays. 
	- Object stores allow a very limited set of operation (get, put, delete) that aren't enough for query execution.
		- Cloud-vendors have some support[^2] for SELECT-like operator on file contents.
	- Q/A: Do you always want to do predicate-pushdown if its available?
		- No. Because the block of data you need might be used over and over again for a bunch of queries. It'd be faster and cheaper to get and cache the block.
- Pull Data to Query
	- Necessary when there is no compute resources available where persistent data files are located.

Architectures
- Shared-Nothing
	- Each DBMS instance has its own CPU, memory and locally-attached disk.
	- Nodes only communicate w/ each other via network.
	- DB is partitioned into disjoint subsets across nodes.
		- Adding/removing a node requires physically shuffling data b/w nodes (in a transactional manner using the catalog).
	- Since data is local, it can be accessed using the POSIX API
-  Shared-Disk
	- Each node accesses a single logical disk via an interconnect but has its own private memory and ephemeral storage.
	- Must send messages b/w nodes to learn about their current state.
	- Accesses data using user-space API
	- You'd still use a catalog service to assign compute nodes to different parts of storage.
		- Snowflake uses consistent hashing to avoid reshuffling data too much.

Shared Disk Implementations
- Traditionally, the storage layer in shared-disk DBMSs were dedicate on-prem NAS. Eg: Oracle Exadata.
- Cloud object stores are now the prevailing storage target for modern OLAP DBMSs because they're "infinitely" scalable.

Object Stores
- Partition the DB's tables (persistent data) into large, immutable files stored in an object store.
	- All attributes for a tuple are stored in the same file in a columnar layout (PAX).
	- Header (/footer) contains meta-data about columnar offsets, compression schemes, indexes and zone maps.
- DB retrieves a block's header to determine what byte range it needs to retrieve (if any).

## 2 : Data Formats & Encoding Part 1
Date: 22/08/24

Reminder
- OLAP workloads perform sequential scans on large segments of read-only data.
- OLTP workloads use indexes to find individual tuples w/o performing sequential scans.
	- Tree-based indexes (B+ Tress) are meant for queries w/ low selectivity predicates.

Sequential Scan Optimizations
- Data Encoding / Compression
- Prefetching (not part of this course)
- Parallelization
	- Run Different queries at the same time and different tasks/fragments of a query. Cross different threads, processes, nodes.
- Clustering / Sorting
	- Reordering data for faster queries.
- Late Materialization
- Materialized Views / Result Caching (not part of this course)
- Data Skipping
- Data Parallelization / Vectorization
	- Use things like SIMD to process multiple items at the same time.
- Code Specialization / Compilation
	- Instead of the execution engine interpreting a known query, generate and compile code and run that.
 
### Storage Models
A DBMS's storage model specifies how it physically organizes tuples on disk and in memory.

Choices
- N-ary Storage Model (NSM)
	- Stores almost all the attributes for a single tuple contiguously in a single page.
		- Some systems store large variable length attributes separately.
	- Ideal for OLTP workloads where txns tend to access individual entities and there are insert-heavy workloads.
		- Uses the tuple-at-a-time iterator (volcano) processing model.
	- Page sizes are typically a multiple of 4KB hardware pages.
	- Eg: Postgres, MySQL
- Decomposition Storage Model (DSM)
	- Stores a single attribute for all tuples contiguously in a block of data.
	- Ideal for OLAP workloads where read-only queries perform large scans over a subset of the table's attributes.
		- Uses a batched vectorized processing model.
	- File sizes are larger (100s of MBs) but it may organize tuples within the file into smaller groups.
	- Physical Organization
		- Attributes and meta-data (like nulls) are stored in separate arrays of fixed length values.
			- Most systems identify unique physical tuples using offsets into these arrays.
		- Maintain a separate file per attribute w/ a dedicates header area for meta-data about entire column.
	- Tuple Identification
		- Fixed-length Offsets
			- Each value is the same length for an attribute. Jump to offset to find a tuple.
			- Need to convert variable-length data into fixed-length values. ???
			- Parquet, ORC use fixed-length offsets. This is the more common and recommended choice. (Note: Parquet, ORC use PAX)
		- Embedded Tuple Ids
			- Each value is stored w/ its tuple id in a column.
			- Need auxiliary data structures to find offset within a column for a given tuple id.
			- Usually done in systems that were initially a row store but wanted to add some column store functionalities.
	- Handling variable-length data
		- Padding is wasteful for large attributes.
		- Better approach is to use dictionary compression to convert repetitive variable-length data into fixed length values (typically 32-bit integers)
			- Just a map from integer to the original value. Only the integer needs to be stored. Saves space when there are a lot of repeated values.
		- Doesn't handle semi-structured data.
	- Observation
		- OLAP queries usually involve multiple columns. At some point during query execution, the DBMS must get other columns and stitch the original tuple back together.
		- We need columnar scheme that stores attributes separately but keeps the data for each tuple physically close to each other.
- Hybrid Storage Model (PAX)
	- Partition Attributes Across (PAX) is a hybrid storage model that vertically partitions attributes within a database page.
	- Get benefit of faster processing on columnar storage and retain spatial locality benefits of row storage.
	- Physical Organization
		- Horizontally partition data into row groups. Then vertically partition their attributes into column chunks.
		- Global meta-data directory contains offsets to the file's row groups.
			- Stored in footer if file is immutable (Parquet, Orc).
		- Each row group contains its own meta-data header about its contents.

### Persistent Data Formats
Observation
- Most DBMSs use a proprietary on-disk binary file format for persistent data. The only way to share data b/w these systems is to convert data into a common text-based format like CSV, JSON or XML.
- There are open-source binary file formats that make it easier to access data across systems. Libraries provided an interior interface to retrieve batched columns from files.
- Open source data formats
	- HDF5 (1998) : Multi-dimensional arrays for scientific workloads
	- Apache Avro (2009): Row-oriented format for Hadoop to replace [SequenceFiles](https://cwiki.apache.org/confluence/display/HADOOP2/sequencefile)
	- Apache Parquet (2013): Compressed columnar storage from Cloudera/Twitter for Impala
	- Apache ORC (2013): Compressed columnar storage from FB for Apache Hive
	- Apache CarbonData (2016): Compressed columnar storage with indexes from Huawei
	- Apache Arrow (2016): In-memory compressed columnar storage from Pandas/Dremio
	- Newer format
		- Nimble/Alpha (2004) : https://github.com/facebookincubator/nimble

Format Design Decisions
- File Meta-Data
	- Files are self contained to increase portability.
	- Each file maintains global meta-data (usually in its footer) about its contents. Eg:
		- Table Schema (Eg. Thrift, Protobuf)
		- Row Group Offsets / Length
		- Tuple Counts / Zone Maps
	- Tidbit: Oracle maintains self-contained files (but mostly for disaster recovery).
- Format Layout
	- Most common formats use the PAX storage model.
	- Size of row groups varies per implementation:
		- Parquet: Number of tuples (eg. 1 million)
			- Zonemaps might be less helpful with large ranges.
			- Large row-groups can consume a lot of memory.
			- Guaranteed to have enough data for vectorization.
		- Orc: Physical Storage Size (eg. 250MB)
	- Sidenote: You can get specific byte-range of an object from S3.
- Type System
	- Defines the data types that the format supports.
		- Physical: Low-level byte representation (eg. IEEE-754)
		- Logical: Auxiliary types that map to physical types
	- Eg:
		- Parquet: Minimal physical types. Logical types provide annotation that describe interpretation of primitive type data.
		- Orc: More complete set of physical types.
- Encoding Schemes
	- Specifies how the format stores the bytes for contiguous or related data.
	- Can apply multiple encoding schemes on top of each other to further improve compression.
	- Eg: Dictionary Encoding, Run-Length Encoding (RLE), Bitpacking, Delta Encoding, Frame-of-Reference (FOR)
	- Dictionary Compression
		- The format must handle when the no. of distinct values (NDV) in a column chunk is too large.
			- Parquet has a max dictionary size of 1MB.
			- ORC precomputes NDV and disables if too large.
		- You don't need to use a hash-table. You can just store a sorted or unsorted array of strings and then refer to positions of the item or byte offset of the item.
			- Arrow does this.
	- Design Decisions
		- Eligible Data Types
			- Parquet: All data types
			- Orc: Only strings
			- In Andy's analysis, compressing all data types was better.
		- Compress Encoded Data
			- Parquet: RLE + Bitpacking
			- Orc: RLE, Delta Encoding, Bitpacking, FOR
		- Expose Dictionary
			- Why? Do evaluation directly on compressed data by compressing your predicate and comparing it w/ the compressed data rather than decompressing everything first.
			- Parquet and ORC don't do this.
- Block Compression
	- Compress data using a general-purpose algorithm . Scope of compression is only based on the data provided as input.
	- Eg: LZO (1996), LZ4 (2011), Snappy (2011), Zstd (2015)
	- Parquet and ORC use Snappy by default.[^3]
	- The best algorithm currently is Zstd.
	- Consideration
		- Computational overhead
		- Compress vs. decompress speed
			- Since the data is already encoded w/ dictionary encoding, is the overhead during decompression worth it?
			- Can't jump to arbitrary offsets w/o decompressing the whole block.
			- Made sense earlier (2010s) since disk and network were slow.
		- Data opaqueness
- Filters
	- Zone Maps
		- Both Parquet and ORC store zone maps in the header of each row group by default.
		- More effective if values are clustered.
	- Bloom Filters
		- Parquet uses [Split Block Bloom Filters](https://arxiv.org/abs/2101.01719) from Impala.
- Nested Data
	- Approaches
		- Record Shredding / Dremel Model
			- Parquet does this.
		- Length + Presence Encoding
			- ORC does this.

### Lessons & Parting Thoughts
- Dictionary encoding is effective for all data types and not just strings.
- Simplistic encoding schemes are better on modern hardware.
	- Determining which encoding scheme a chunk is using at runtime causes branch mis-predictions.
- Avoid general-purpose block compression.
	- Network/disk are no longer the bottleneck relative to CPU performance.
- Deficiencies w/ Parquet and ORC:
	- No statistics (eg. histograms, sketches)
	- No incremental schema deserialization.
		- If I've 10K columns, I need to deserialize the entire schema first even if I don't need to use all columns.
	- Implementations in various languages aren't at par w/ each other.

[^1]: https://www.cidrdb.org/cidr2021/papers/cidr2021_paper17.pdf
[^2]: AWS S3 added support for the [filtering file contents](https://docs.aws.amazon.com/AmazonS3/latest/userguide/selecting-content-from-objects.html) but it has been deprecated now. Azure also has something similar with it's [Query Blob Contents API](https://learn.microsoft.com/en-us/rest/api/storageservices/query-blob-contents?tabs=microsoft-entra-id).
[^3]: https://parquet.apache.org/docs/file-format/data-pages/compression/#codecs ; https://orc.apache.org/specification/ORCv1/