# compact-profile

[![npm version](https://img.shields.io/npm/v/compact-profile.svg)](https://www.npmjs.com/package/compact-profile)
[![npm downloads](https://img.shields.io/npm/dm/compact-profile.svg)](https://www.npmjs.com/package/compact-profile)
[![license](https://img.shields.io/npm/l/compact-profile.svg)](https://github.com/Deepl-ysp/compact-profile/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/Deepl-ysp/compact-profile.svg)](https://github.com/Deepl-ysp/compact-profile)

# CompactProfile 使用文档 / CompactProfile User Guide

## 1. 简介 / Introduction

CompactProfile 是一个紧凑的配置描述语言。把 `key=value` 格式的文本解析成 JS 对象，也能把对象序列化回文本。

CompactProfile is a compact configuration description language. It parses `key=value` text into JS objects, and can also serialize objects back into text.

三个核心能力 / Three core capabilities:

- `parse` — 文本 → JS 对象（含求值）/ text → JS object (with evaluation)
- `stringify` — JS 对象 → 文本 / JS object → text
- `encodetags` — 模板字符串标签，把 JS 值直接嵌入文本 / template string tag, embeds JS values directly into text

最外层不需要花括号 / The outermost braces are not required:

```
host='localhost',port=8080,debug=true
```

---

## 2. 快速开始 / Quick Start

```js
import CompactProfile, { parse, stringify, encodetags } from './cp.js';

// 文本 → 对象 / text → object
parse(`host='localhost',port=8080,debug=true`);
// { host: 'localhost', port: 8080, debug: true }

// 对象 → 文本 / object → text
stringify({ host: 'localhost', port: 8080, debug: true });
// "host='localhost',port=8080,debug=true"

// 格式化输出 / formatted output
stringify({ host: 'localhost', port: 8080 }, { format: true });
// host='localhost',
// port=8080

// 标签函数 / tag function
const host = 'localhost';
encodetags`host='${host}',port=8080`;
// { host: 'localhost', port: 8080 }
```

---

## 3. API

### 3.1 `parse(text, type?)`

把文本解析并求值为 JS 对象。

Parses the text and evaluates it into a JS object.

| 参数 / Parameter | 类型 / Type | 默认 / Default | 说明 / Description |
|---|---|---|---|
| `text` | `string` | — | 字段串，最外层不需要 `{}` / Field string; the outermost `{}` is not required |
| `type` | `"Object" \| "Array"` | `"Object"` | 输出封装形式 / Output container form |

```js
parse(`a=1,b=2`);
// { a: 1, b: 2 }

parse(`a=1,b=2`, types.Array);
// [{ a: 1 }, { b: 2 }]
```

### 3.2 `stringify(obj, options?)`

把对象或数组序列化为文本。

Serializes an object or array into text.

| 参数 / Parameter | 类型 / Type | 默认 / Default | 说明 / Description |
|---|---|---|---|
| `obj` | `object \| array` | — | 待序列化的值 / Value to serialize |
| `options.format` | `boolean` | `false` | 是否格式化输出 / Whether to format the output |
| `options.indent` | `number` | `2` | 缩进空格数，仅 `format=true` 有效 / Indent width, only effective when `format=true` |

`options` 也可以传 `boolean`，等价于 `{ format: boolean }`。

`options` can also be a `boolean`, equivalent to `{ format: boolean }`.

```js
stringify({ a: 1, b: { c: 2 } });
// "a=1,b={c=2}"

stringify({ a: 1, b: { c: 2 } }, { format: true });
// a=1,
// b={
//   c=2
// }

stringify({ a: 1, b: { c: 2 } }, { format: true, indent: 4 });
// a=1,
// b={
//     c=2
// }
```

### 3.3 `` encodetags`...` ``

标签函数。把 JS 值插值到文本中，再解析。

Tag function. Interpolates JS values into text, then parses it.

| 插值类型 / Interpolated type | 拼接形式 / Concatenation form |
|---|---|
| 数字 / 布尔 · Number / Boolean | `String(v)` |
| 字符串 · String | `String(v)`（**不加引号**，会被当引用）/ (**no quotes added**; treated as a reference) |
| 数组 · Array | `[a,b,c]` |
| 对象 · Object | `{k=v,k=v}` |
| `null` / `undefined` | `"null"` / `"undefined"` |

```js
const name = 'Alice';
const age = 30;
encodetags`name='${name}',age=${age}`;
// { name: 'Alice', age: 30 }
```

字符串插值要**自己加引号**：`'${name}'`。

String interpolation requires **adding quotes yourself**: `'${name}'`.

### 3.4 `types`

节点类型常量表。

Node type constants table.

```js
types.String        // 'String'
types.Integer       // 'Integer'
types.Float         // 'Float'
types.Boolean       // 'Boolean'
types.Null          // 'Null'
types.Undefined     // 'Undefined'
types.Array         // 'Array'
types.Object        // 'Object'
types.Pointer       // 'Pointer'
types.MemberAccess  // 'MemberAccess'
types.Ternary       // 'Expression TernaryOperation'
types.Conditional   // 'Expression ConditionalOperation'
types.Logical       // 'Expression Logical'
types.Comparison    // 'Expression Comparison'
types.Spaceship     // 'Expression SpaceshipOperation'
types.Bitwise       // 'Expression BitwiseOperation'
types.FormulaAdd    // 'Formula Add'
```

---

## 4. 数据类型 / Data Types

### 4.1 字符串 / Strings

单引号或双引号都可以。

Single or double quotes both work.

```js
parse(`title='Hello World'`);
// { title: 'Hello World' }

parse(`title="Hello World"`);
// { title: 'Hello World' }
```

两种引号内部可以互相包含 / The two quote styles can contain each other:

```js
parse(`msg="It's fine"`);
// { msg: "It's fine" }

parse(`msg='Say "hi"'`);
// { msg: 'Say "hi"' }
```

### 4.2 数字 / Numbers

**整数 / Integers**

```js
parse(`count=42,offset=-7`);
// { count: 42, offset: -7 }
```

**浮点数 / Floats**

```js
parse(`pi=3.14159,ratio=0.75`);
// { pi: 3.14159, ratio: 0.75 }
```

**科学计数法 / Scientific notation**

```js
parse(`distance=1.5e8,threshold=2.5e-3`);
// { distance: 150000000, threshold: 0.0025 }
```

### 4.3 布尔 / Booleans

```js
parse(`enabled=true,archived=false`);
// { enabled: true, archived: false }
```

### 4.4 `null` 与 `undefined` / `null` and `undefined`

两者是独立字面量。

Both are distinct literals.

```js
parse(`middleName=null,deletedAt=undefined`);
// { middleName: null, deletedAt: undefined }
```

区别：`null` 保留在 JSON 里，`undefined` 在 JSON 序列化时被丢弃。

Difference: `null` is preserved in JSON, while `undefined` is dropped during JSON serialization.

```js
JSON.stringify(parse(`a=null,b=undefined`));
// '{"a":null}'
```

### 4.5 引用 / References

直接用标识符引用前面定义过的值。

Use an identifier directly to reference a previously defined value.

```js
parse(`base=100,max=base*2`);
// { base: 100, max: 200 }

parse(`host='localhost',url='http://'+host`);
// { host: 'localhost', url: 'http://localhost' }
```

未定义的引用返回 `undefined` / An undefined reference returns `undefined`:

```js
parse(`x=missing`);
// { x: undefined }
```

### 4.6 成员访问 / Member Access

用 `.` 访问对象属性，支持多级。

Use `.` to access object properties; multiple levels are supported.

```js
parse(`user={name='Alice',age=30},n=user.name`);
// { user: { name: 'Alice', age: 30 }, n: 'Alice' }

parse(`a={b={c=1}},x=a.b.c`);
// { a: { b: { c: 1 } }, x: 1 }
```

---

## 5. 复合类型 / Compound Types

### 5.1 数组 / Arrays

方括号，元素逗号分隔，可混类型、可嵌套。

Square brackets, comma-separated elements, mixed types and nesting allowed.

```js
parse(`tags=[1,2,3]`);
// { tags: [1, 2, 3] }

parse(`mixed=[1,'two',true,null]`);
// { mixed: [1, 'two', true, null] }

parse(`matrix=[[1,2],[3,4]]`);
// { matrix: [[1, 2], [3, 4]] }

parse(`empty=[]`);
// { empty: [] }
```

### 5.2 对象 / Objects

花括号。内部字段有两种写法。

Curly braces. Fields inside can be written in two ways.

**显式键 `key=value` / Explicit key `key=value`**

```js
parse(`point={x=10,y=20}`);
// { point: { x: 10, y: 20 } }

parse(`user={name='Alice',age=30,active=true}`);
// { user: { name: 'Alice', age: 30, active: true } }
```

**自动键（直接写表达式）/ Auto key (write the expression directly)**

键取表达式**最左标识符链的最后一段**。

The key is taken from **the last segment of the leftmost identifier chain** of the expression.

```js
parse(`name='Alice',user={name}`);
// { name: 'Alice', user: { name: 'Alice' } }

parse(`point={x=1,y=2},copy={point.x,point.y}`);
// { point: { x: 1, y: 2 }, copy: { x: 1, y: 2 } }
```

字面量（数字、字符串、布尔、null、undefined）没有标识符，走占位键 `_0`、`_1`（按下标）：

Literals (number, string, boolean, null, undefined) have no identifier, so they use placeholder keys `_0`, `_1` (by index):

```js
parse(`values={1,2,3}`);
// { values: { _0: 1, _1: 2, _2: 3 } }

parse(`mixed={42,'hi',true,null}`);
// { mixed: { _0: 42, _1: 'hi', _2: true, _3: null } }
```

混合 / Mixed:

```js
parse(`x=10,y=20,data={x,y,x+y,100}`);
// { x: 10, y: 20, data: { x: 10, y: 20, _2: 30, _3: 100 } }
```

注意 `_2` 是因为下标按字段顺序递增，`x+y` 是第 3 个字段。

Note that `_2` appears because the index increments in field order, and `x+y` is the 3rd field.

### 5.3 对象内作用域 / Scoping Inside Objects

对象内字段按**定义顺序**依次可见，从内向外查找。

Fields inside an object become visible in **definition order**, and lookup proceeds from inner to outer scope.

```js
parse(`
  base=100,
  config={
    min=base,
    max=base+50
  }
`);
// { base: 100, config: { min: 100, max: 150 } }
```

内层字段名遮蔽外层时，后面的字段看到的是内层值：

When an inner field name shadows an outer one, later fields see the inner value:

```js
parse(`
  value='outer',
  wrap={
    value='inner',
    copy=value
  }
`);
// { value: 'outer', wrap: { value: 'inner', copy: 'inner' } }
```

想在内层引用外层，把引用写在遮蔽之前：

To reference the outer value from inside, place the reference before the shadowing:

```js
parse(`
  value='outer',
  wrap={
    copy=value,
    value='inner'
  }
`);
// { value: 'outer', wrap: { copy: 'outer', value: 'inner' } }
```

---

## 6. 表达式 / Expressions

### 6.1 算术 / Arithmetic

`+` `-` `*` `/` `%`，优先级与 JS 一致。

`+` `-` `*` `/` `%`, with the same precedence as JS.

```js
parse(`sum=1+2+3`);
// { sum: 6 }

parse(`result=2+3*4`);
// { result: 14 }

parse(`remainder=17%5`);
// { remainder: 2 }

parse(`price=19.99,quantity=3,total=price*quantity`);
// { price: 19.99, quantity: 3, total: 59.97 }
```

### 6.2 一元负号 / Unary Minus

```js
parse(`temp=-5`);
// { temp: -5 }

parse(`expr=-(3+4)`);
// { expr: -7 }

parse(`product=2*-3`);
// { product: -6 }
```

### 6.3 比较 / Comparison

`===` `!==` `==` `!=` `>` `<` `>=` `<=`，返回布尔值。

`===` `!==` `==` `!=` `>` `<` `>=` `<=`, returning a boolean.

```js
parse(`age=25,isAdult=age>=18`);
// { age: 25, isAdult: true }

parse(`same=1===1,diff=1!==2`);
// { same: true, diff: true }

parse(`loose=1=='1',strict=1==='1'`);
// { loose: true, strict: false }
```

### 6.4 飞船运算符 / Spaceship Operator

`<=>` 返回 `-1` / `0` / `1`。

`<=>` returns `-1` / `0` / `1`.

```js
parse(`a=1<=>2,b=5<=>5,c=9<=>2`);
// { a: -1, b: 0, c: 1 }
```

### 6.5 逻辑 / Logical

`&&` `||`，短路求值，返回参与运算的实际值。

`&&` `||`, short-circuit evaluated, returning the actual operand value.

```js
parse(`a=true&&false`);
// { a: false }

parse(`b=false||true`);
// { b: true }

parse(`x=0||'default'`);
// { x: 'default' }

parse(`y='first'&&'second'`);
// { y: 'second' }
```

### 6.6 位运算 / Bitwise

`|` `^` `&` `<<` `>>` `>>>`

```js
parse(`a=12&10`);      // 1100 & 1010 = 1000 = 8
// { a: 8 }

parse(`b=12|10`);      // 1100 | 1010 = 1110 = 14
// { b: 14 }

parse(`c=12^10`);      // 1100 ^ 1010 = 0110 = 6
// { c: 6 }

parse(`d=1<<4`);       // 16
// { d: 16 }

parse(`e=256>>2`);     // 64
// { e: 64 }

parse(`f=-1>>>28`);    // 15
// { f: 15 }
```

### 6.7 三元 / Ternary

```js
parse(`age=20,status=age>=18?'adult':'minor'`);
// { age: 20, status: 'adult' }

parse(`score=45,grade=score>=60?'pass':'fail'`);
// { score: 45, grade: 'fail' }
```

### 6.8 条件语句 / Conditional Expression

`if(条件) 值 elif(条件) 值 else 值`，条件可省略括号。

`if(condition) value elif(condition) value else value`; parentheses around conditions are optional.

```js
parse(`score=85,grade=if(score>=90) 'A' elif(score>=80) 'B' elif(score>=70) 'C' else 'F'`);
// { score: 85, grade: 'B' }

parse(`n=5,type=if n>0 'positive' else 'non-positive'`);
// { n: 5, type: 'positive' }
```

### 6.9 括号 / Parentheses

括号提升优先级。

Parentheses raise precedence.

```js
parse(`a=(2+3)*4`);
// { a: 20 }

parse(`b=2*(3+4)`);
// { b: 14 }

parse(`c=((1+2)*3+4)*2`);
// { c: 26 }
```

---

## 7. 字符串转义 / String Escapes

| 转义 / Escape | 含义 / Meaning |
|---|---|
| `\n` | 换行 / newline |
| `\t` | 制表符 / tab |
| `\r` | 回车 / carriage return |
| `\b` | 退格 / backspace |
| `\f` | 换页 / form feed |
| `\0` | 空字符 / null character |
| `\\` | 反斜杠 / backslash |
| `\'` | 单引号 / single quote |
| `\"` | 双引号 / double quote |
| `\uXXXX` | Unicode 字符 / Unicode character |
| `\xXX` | 十六进制字符 / hexadecimal character |

```js
parse(`text='line1\\nline2'`);
// { text: 'line1\nline2' }

parse(`path='C:\\\\Users\\\\Alice'`);
// { path: 'C:\\Users\\Alice' }

parse(`char='\\u4e2d\\u6587'`);
// { char: '中文' }
```

---

## 8. 综合示例 / Comprehensive Examples

### 8.1 应用配置 / Application Configuration

```js
const config = parse(`
  appName='MyApp',
  version='2.1.0',
  server={
    host='0.0.0.0',
    port=8080,
    tls={
      enabled=true,
      certPath='/etc/ssl/cert.pem'
    }
  },
  database={
    url='postgres://localhost/db',
    poolSize=20,
    timeout=5000
  },
  features=['auth','logging','metrics'],
  debug=server.port>8000
`);
```

结果 / Result:

```js
{
  appName: 'MyApp',
  version: '2.1.0',
  server: {
    host: '0.0.0.0',
    port: 8080,
    tls: {
      enabled: true,
      certPath: '/etc/ssl/cert.pem'
    }
  },
  database: {
    url: 'postgres://localhost/db',
    poolSize: 20,
    timeout: 5000
  },
  features: ['auth', 'logging', 'metrics'],
  debug: true
}
```

### 8.2 电商订单计算 / E-commerce Order Calculation

```js
const order = parse(`
  unitPrice=29.99,
  quantity=3,
  subtotal=unitPrice*quantity,
  taxRate=0.08,
  tax=subtotal*taxRate,
  total=subtotal+tax,
  freeShipping=total>=100,
  shippingCost=freeShipping?0:9.99,
  finalTotal=total+shippingCost
`);
```

结果 / Result:

```js
{
  unitPrice: 29.99,
  quantity: 3,
  subtotal: 89.97,
  taxRate: 0.08,
  tax: 7.1976,
  total: 97.1676,
  freeShipping: false,
  shippingCost: 9.99,
  finalTotal: 107.1576
}
```

### 8.3 用户权限判定 / User Permission Check

```js
const user = parse(`
  user={id=1001,name='Alice',role='admin',level=8},
  minLevel=5,
  canEdit=user.role==='admin'&&user.level>=minLevel,
  canDelete=user.role==='admin',
  canView=user.level>0,
  permissions=[canView,canEdit,canDelete]
`);
```

结果 / Result:

```js
{
  user: { id: 1001, name: 'Alice', role: 'admin', level: 8 },
  minLevel: 5,
  canEdit: true,
  canDelete: true,
  canView: true,
  permissions: [true, true, true]
}
```

### 8.4 位掩码权限 / Bitmask Permissions

```js
const flags = parse(`
  READ=1,
  WRITE=2,
  EXEC=4,
  permission=READ|WRITE,
  allPermissions=READ|WRITE|EXEC,
  canRead=(permission&READ)!==0,
  canExec=(permission&EXEC)!==0
`);
```

结果 / Result:

```js
{
  READ: 1,
  WRITE: 2,
  EXEC: 4,
  permission: 3,
  allPermissions: 7,
  canRead: true,
  canExec: false
}
```

### 8.5 结合 `encodetags` 动态构建 / Dynamic Construction with `encodetags`

```js
const env = 'production';
const port = 443;
const tls = { enabled: true, protocol: 'TLSv1.3' };

const config = encodetags`
  env='${env}',
  port=${port},
  tls=${tls},
  secure=port>=443
`;
// {
//   env: 'production',
//   port: 443,
//   tls: { enabled: true, protocol: 'TLSv1.3' },
//   secure: true
// }
```

### 8.6 往返转换 / Round-trip Conversion

```js
const original = {
  name: 'Alice',
  age: 30,
  address: {
    city: 'Beijing',
    zip: '100000'
  },
  tags: ['admin', 'developer'],
  active: true,
  bio: null
};

const text = stringify(original);
// "name='Alice',age=30,address={city='Beijing',zip='100000'},tags=['admin','developer'],active=true,bio=null"

const restored = parse(text);
// 与 original 深度相等 / deeply equal to original
```

格式化输出 / Formatted output:

```js
stringify(original, { format: true });
// name='Alice',
// age=30,
// address={
//   city='Beijing',
//   zip='100000'
// },
// tags=['admin','developer'],
// active=true,
// bio=null
```

---

## 9. 运算符优先级 / Operator Precedence

从低到高 / From lowest to highest:

| 优先级 / Precedence | 运算符 / Operators |
|---|---|
| 1 | `\|\|` |
| 2 | `&&` |
| 3 | `\|` |
| 4 | `^` |
| 5 | `&` |
| 6 | `===` `!==` `==` `!=` `>` `<` `>=` `<=` `<=>` |
| 7 | `<<` `>>` `>>>` |
| 8 | `+` `-` |
| 9 | `*` `/` `%` |

同级**左结合**。

Same precedence is **left-associative**.

---

## 10. 注意事项 / Notes and Caveats

### 10.1 未定义的引用 / Undefined References

不报错，返回 `undefined` / No error is thrown; returns `undefined`:

```js
parse(`x=missing`);
// { x: undefined }
```

### 10.2 值语义 / Value Semantics

`om=pm` 是**取值快照**，不是引用别名：

`om=pm` is a **value snapshot**, not a reference alias:

```js
parse(`pm={x=1},cc={om=pm},pm2={x=2}`);
// cc.om 是 { x: 1 }，之后修改 pm 不会影响它
// cc.om is { x: 1 }; later modifications to pm do not affect it
```

### 10.3 自动键规则 / Auto-key Rules

- **标识符 / 成员访问** → 取最后一段 / **Identifier / member access** → take the last segment
- **字面量** → 走占位键 `_0`、`_1`（按字段下标）/ **Literal** → use placeholder keys `_0`, `_1` (by field index)

```js
parse(`list={1,2,3}`);
// { list: { _0: 1, _1: 2, _2: 3 } }

parse(`user={name='Alice'},pair={user.name}`);
// { user: {...}, pair: { name: 'Alice' } }
```

同一对象里键名重复时后者覆盖前者：

When key names repeat within the same object, the later one overwrites the earlier one:

```js
parse(`user={name='Alice'},pair={user.name,user.name}`);
// { user: {...}, pair: { name: 'Alice' } }
```

### 10.4 字段顺序 / Field Order

顶层字段按定义顺序求值，后面可引用前面。

Top-level fields are evaluated in definition order; later fields can reference earlier ones.

```js
parse(`a=1,b=a+1,c=b+1`);
// { a: 1, b: 2, c: 3 }
```

反过来拿不到值 / Reversed order yields no value:

```js
parse(`b=a+1,a=1`);
// { b: NaN, a: 1 }
```

### 10.5 字符串插值需要引号 / String Interpolation Needs Quotes

```js
const name = 'Alice';
encodetags`n=${name}`;    // { n: undefined }  —— 被当标识符 / treated as an identifier
encodetags`n='${name}'`;  // { n: 'Alice' }    —— 正确 / correct
```

### 10.6 空容器 / Empty Containers

```js
parse(`a={},b=[]`);
// { a: {}, b: [] }
```

### 10.7 大小写敏感 / Case Sensitivity

`true` `false` `null` `undefined` 必须小写：

`true` `false` `null` `undefined` must be lowercase:

```js
parse(`a=True`);
// { a: undefined } —— True 被当作标识符 / True is treated as an identifier
```

### 10.8 `stringify` 的数组输入 / Array Input for `stringify`

`stringify` 接受数组，展开其中每个对象的键值对：

`stringify` accepts an array and flattens the key-value pairs of each object in it:

```js
stringify([{ a: 1 }, { b: 2 }]);
// "a=1,b=2"
```

数组中的非对象元素被忽略 / Non-object elements in the array are ignored:

```js
stringify([1, 2, 'x']);
// ""
```

---

## 11. 未支持的特性 / Unsupported Features

- 函数调用 `f(x)` / Function calls `f(x)`
- 空值合并 `??` / Nullish coalescing `??`
- 可选链 `?.` / Optional chaining `?.`
- 正则字面量 / Regular expression literals
- 模板字符串 / Template strings
- 赋值运算符 `+=` `-=` 等 / Assignment operators such as `+=` `-=`
- 逗号运算符 / Comma operator
- 二进制 / 八进制字面量（`0b` / `0o`）/ Binary / octal literals (`0b` / `0o`)
- 循环结构 / Loop constructs