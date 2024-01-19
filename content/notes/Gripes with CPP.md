---
tags:
  - cpp
---
Note: I mainly use C++17.

- `switch` statement
	- Doesn't allow using non-integral/enum types.
	- Can't have dynamic expressions in cases. Everything needs to be constant.
		- This also means that I can't use the "switch(true)" for evaluating cases.
		- TODO: Add support for a switch statement with dynamic cases. You can use the "match" keyword to create this new kind of switch using if-else statements. Check if there's support for macros.
- Keeping a separate header file just for the sake of import / exports.
	- Can we just write all code in header files itself?
- The compilers don't support complicated builds out of the box & a separate tool is needed for it.