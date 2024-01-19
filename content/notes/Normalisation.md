---
tags:
  - db
---
[https://youtu.be/GFQaEYEc8_8](https://youtu.be/GFQaEYEc8_8)  

First NF (1NF)  
- Using row order to convey information isn't permitted.  
- Mixing data types within the same column isn't permitted.  
- Having a table without a primary key isn't permitted.  
- Repeating groups aren't permitted.  
  
Second NF (2NF)  
- Each non-key attribute must depend on the entire primary key.  
  
Third NF (3NF)  
- Every non-key attribute in the table should fully depend on the key, the whole key and nothing but the key.  
- 3NF tables are usually also in Boyce Codd Normal Form  
  
4NF  
- Non-trivial multi-valued dependencies on a non-key aren't allowed.  
- A multi-valued dependency is considered trivial if the attributes in the relation make up all attributes in the table.  
  
5NF  
- Tables shouldn't be able to be logically thought of as being the result of joining other tables together (provided that the other tables don't have the same key)  
  
Note: The explanations were done loosely for ease of understanding.