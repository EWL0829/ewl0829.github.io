---
layout: post
title: 2023-10-20-type-challenges-easy
subtitle: subtitle
date: 2023-10-20 11:4
author: EWL
header-img: img/home-bg-art.jpg
catalog: true
tags:
  - type-challenges
  - typescript
---

#### easy01-MyPick

**题目**

Implement the built-in `Pick<T, K>` generic without using it.

Constructs a type by picking the set of properties `K` from `T`

For example:
```typescript
interface Todo {
  title: string
  description: string
  completed: boolean
}

type TodoPreview = MyPick<Todo, 'title' | 'completed'>

const todo: TodoPreview = {
    title: 'Clean room',
    completed: false,
}
```

**解法**
```typescript
type MyPick<T, K extends keyof T> = {
  [key in K]: T[K]
}
```

**分析**
理解题目中的要求，`MyPick`要求返回一个对象类型，且对象类型中的属性名属于泛型T中的一部分，并且属性值类型也必须对应了泛型T中该属性名对应的类型。因此，首先推导一下，属性名
K应当限制为T的属性名的一个子集，所以在`MyPick`中需要限制一下 `K extends keyof T`，其次，返回对象类型中的属性名属于K，则`[key in K]`满足这个要求，且属性值只需要找
到T中对应属性名的属性值类型即可，所以`T[K]`是满足要求的，最终得到了这样的结果。

**关键字**
- keyof
- extends
- in

keyof作用于对象类型，用于获取该对象类型所有的属性名集合。
```typescript
type Obj = { x: number; y: string; z: boolean; };
type K = keyof Obj; // type K = 'x' | 'y' | 'z'

type AnotherObj = { [key: string]: number };
type P = keyof AnotherObj; // type P = string | number; 由于obj[0]和obj['0']是相同的，隐式转换的锅，所以这里的key即使被声明为了string类型，也仍然会补充返回一个number类型

type Arrayish = { [n: number]: unknown };
type A = keyof Arrayish; // type A = number;
```

extends在ts中主要有2种用法接口继承以及条件判断，掘金上有一篇很不错的[文章](https://juejin.cn/post/6998736350841143326)，这里做一下记录即可，不再展开说明

in关键字就很好理解了，in作用于联合类型或者枚举类型
```typescript
// 联合类型
type Property = 'name' | 'age' | 'phoneNum';
type PropertyObject = {
  [key in Property]: string;
}

// 枚举类型
enum Letter {
  A,
  B,
  C,
}
type LetterMap = {
  [key in Letter]: string;
}
```



#### easy02-Readonly

**题目**
Implement the built-in Readonly<T> generic without using it.

Constructs a type with all properties of T set to readonly, meaning the properties of the constructed type cannot be reassigned.

For example:
```typescript
interface Todo {
  title: string
  description: string
}

const todo: MyReadonly<Todo> = {
  title: "Hey",
  description: "foobar"
}

todo.title = "Hello" // Error: cannot reassign a readonly property
todo.description = "barFoo" // Error: cannot reassign a readonly property
```

**解法**
```typescript
type MyReadonly<T> = {
  readonly [key in keyof T]: T[key]
};
```

**分析**
这个题目的关键点在于需要理解ts中的readonly修饰词，可以参考[官网文档](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-func.html#readonly-and-const)
，该修饰词可以类比到js中的const关键字。


#### easy03-Tuple to Object

**题目**
Given an array, transform it into an object type and the key/value must be in the provided array.

For example:
```typescript
const tuple = ['tesla', 'model 3', 'model X', 'model Y'] as const

type result = TupleToObject<typeof tuple> // expected { 'tesla': 'tesla', 'model 3': 'model 3', 'model X': 'model X', 'model Y': 'model Y'}
```

**解法**
```typescript
type TupleToObject<T> = {
  [key in T]: T[key]
};
```

**分析**
这个题目的关键点在于需要理解ts中的readonly修饰词，可以参考[官网文档](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-func.html#readonly-and-const)
，该修饰词可以类比到js中的const关键字。






