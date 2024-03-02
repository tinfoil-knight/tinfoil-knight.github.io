---
tags:
  - cpp
publish: false
---
Note: Was mainly working with C++17
## Templates
- `template <>` 
```c++
// Creating specialized templated functions, that do different things for different types.
// Take the following example, which prints the type if its a float type, but just prints hello world for all other types.

template <typename T> void print_msg() {
	std::cout << "Hello world!\n";
}

// Specialized templated function, specialized on the float type.
template <> void print_msg<float>() {
	std::cout << "print_msg called with float type!\n";
}
```
- `template<class T>` vs. `template<typename T>`
	- https://mariusbancila.ro/blog/2021/03/15/typename-or-class/
- Template parameters don't have to be types. They can also be values.
```c++
template<int T>
class Bar {
	public:
		Bar() {}
		void print_int() {
			std::cout << "print int: " << T << std::endl;
		}
};

int main(){
	Bar<150> f;
	std::cout << "Calling print_int on Bar<150> f: ";
	f.print_int();
	return 0;
}
```

## OOP
- `explicit` keyword in constructors

## Smart Pointers & Memory Management
- Read
	- [Modern C++ Tutorial / Chapter 05 / Smart Pointers and Memory Management](https://github.com/changkun/modern-cpp-tutorial/blob/master/book/en-us/05-pointers.md)
- rvalue : expression that represents a temporary object or a value that is not associated with a specific, modifiable location in memory.
	- eg: `42` in  `x = 42` is an rvalue
- You can convert a `unique_ptr` to a `shared_ptr` but not vice versa.
- `auto x = std::make_shared<T>(std::unique_ptr<T>)` tries to create a new T object using the `unique_ptr` as a parameter which will lead to an error if T's constructor isn't designed to accept a `unique_ptr`. 
	- You can use direct init here instead: `shared_ptr<T> x = unique_ptr<T>`
	- The `unique_ptr` can only transfer ownership directly like this when it's an rvalue.
- Moving the values of a vector to another empties the vector but you can still insert new elements & use the old vector.
	- Should you though?
- `&` before a variable or argument refers to reference. `&&` refers to rvalue reference.
- Moving values to a rvalue reference doesn't change the owner.
- Passing a rvalue reference to a function that doesn't "move" the parameter, doesn't change the owner of the rvalue.
- Taking in a rvalue argument & using move avoids the need to deep copy.
		- How?
- A `unique_ptr` can be passed using a reference to a function & be read or mutated without changing it's ownership.
- Passing a `shared_ptr` by reference to another function doesn't increase the reference count. (Passing as value does increase the ref count though)
- Copies of `shared_ptr` refer to the same object instance.
- You can check whether a smart pointer is empty or not by just checking if they're truthy. Eg: `ptr ? "not empty" : "empty"`

### Examples
```cpp
#include <memory>
#include <iostream>

class Person {
	public:
		Person(const std::string& name) : name(name) {};
		
		void introduce() const {
			std::cout << "Hi, I'm " << name << std::endl;
		}
	
	private:
		std::string name;

};

  

int main()
{
	Person* rawPtr = nullptr;
	{
	std::shared_ptr<Person> personSharedPtr = std::make_shared<Person>("John");
	
	// Getting a raw pointer from the shared_ptr
	rawPtr = personSharedPtr.get();
	}
	// shared_ptr goes out of scope, and the Person object is destructed when the last shared_ptr owning it is destroyed
	
	// Accessing the object using the raw pointer
	if (rawPtr) {
		rawPtr->introduce();
		// Accessing *rawPtr after personSharedPtr is destructed leads to undefined behavior
	}
	
	return 0;
}
```


## Sync & Threads
- You can use a [condition variable](https://en.cppreference.com/w/cpp/thread/condition_variable) to block a thread on a shared condition. `wait` takes an acquired lock, releases it & then suspends the thread. When the thread is awakened (using `notify` etc.) then the awakened thread tries to re-acquire the lock & check if the condition is true. If the lock is acquired & the condition is true, the thread proceeds with further execution.


## Misc
- [Incompatibilities Between ISO C and ISO C++](http://david.tribble.com/text/cdiffs.htm#C99-vs-CPP98)
- RAII
	- https://en.cppreference.com/w/cpp/language/raii
	- Destructor of a class instance is called even after it is moved when the instance goes out of scope. You need to handle the case for `nullptr` & not call `delete` on null values.
- `T*` vs `T&`
	- [What are the differences between a pointer variable and a reference variable?](https://stackoverflow.com/questions/57483/what-are-the-differences-between-a-pointer-variable-and-a-reference-variable)
	- [What is the difference between a pointer and a reference?](https://www.cs.odu.edu/~zeil/cs333/f13/Public/faq/faq-htmlsu18.html)
- The auto keyword defaults to copying objects. Use `auto&` to avoid this.
```c++
std::vector<int> int_values = {1, 2, 3, 4};
auto copy_int_values = int_values; // deep-copies
auto& ref_int_values = int_values; // doesn't deep-copy
```

- Copy Construction `a(val)` vs. Copy Assignment `a = val`
- Optional values (using `std::optional`) don't need to be wrapped explicitly.
