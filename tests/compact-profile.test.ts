import { describe, it, expect } from "vitest";
import CompactProfile, {
  parse,
  parseAs,
  stringify,
  encodetags,
  types,
} from "../src/CompactProfile.js";

/* ------------------------------------------------------------------ */
/* parse: 基础类型解析                                                 */
/* ------------------------------------------------------------------ */
describe("parse – primitives", () => {
  it("parses integers and floats", () => {
    expect(parse("a=1,b=-2,c=3.14")).toEqual({ a: 1, b: -2, c: 3.14 });
  });

  it("does not support leading-dot floats like `.5` (documented limitation)", () => {
    // 运行时数字语法要求整数部分；`.5` 解析为 undefined 而非报错
    expect((parse("d=.5") as Record<string, unknown>).d).toBeUndefined();
  });

  it("parses booleans / null / undefined", () => {
    expect(parse("a=true,b=false,c=null,d=undefined")).toEqual({
      a: true,
      b: false,
      c: null,
      d: undefined,
    });
  });

  it("parses quoted strings with escapes", () => {
    expect(parse(`a='hello',b="world",c='line\\nbreak'`)).toEqual({
      a: "hello",
      b: "world",
      c: "line\nbreak",
    });
  });

  it("keeps unquoted identifiers as pointers (undefined when unknown)", () => {
    const r = parse("a=b") as Record<string, unknown>;
    expect(r.a).toBeUndefined();
  });

  it("handles empty input", () => {
    expect(parse("")).toEqual({});
  });
});

/* ------------------------------------------------------------------ */
/* parse: 运算与表达式                                                  */
/* ------------------------------------------------------------------ */
describe("parse – expressions", () => {
  it("evaluates arithmetic with precedence", () => {
    expect(parse("r=1+2*3,u=(1+2)*3,v=7%2")).toMatchObject({
      r: 7,
      u: 9,
      v: 1,
    });
  });

  it("evaluates comparison / logical / bitwise ops", () => {
    expect(
      parse("a=1<2,b=true&&false,c=true||false,d=5&3,e=5|3,f=5^3,h=1<<3"),
    ).toEqual({
      a: true,
      b: false,
      c: true,
      d: 1,
      e: 7,
      f: 6,
      h: 8,
    });
  });

  it("does not support unary `~` bitwise NOT (documented limitation)", () => {
    // 语法表未收录 ~，运行时解析为 undefined 而非报错
    expect((parse("g=~5") as Record<string, unknown>).g).toBeUndefined();
  });

  it("short-circuits logical ops returning raw values", () => {
    expect(parse(`a=0||'x',b=1&&'y'`)).toEqual({ a: "x", b: "y" });
  });

  it("evaluates ternary operator", () => {
    expect(parse("a=1>0?'yes':'no',b=0?'x':'y'")).toEqual({
      a: "yes",
      b: "y",
    });
  });

  it("evaluates if/elif/else conditionals", () => {
    const src = `
      x=2,
      label=if(x==1)'one' elif(x==2)'two' else 'other'
    `;
    expect(parse(src)).toMatchObject({ label: "two" });
  });

  it("supports variable references within scope (no forward refs)", () => {
    expect(parse("a=1,b=a+1")).toEqual({ a: 1, b: 2 });
    const r = parse("a=b,b=2") as Record<string, unknown>;
    expect(r.a).toBeUndefined();
    expect(r.b).toBe(2);
  });

  it("supports member access on parsed objects", () => {
    expect(parse("p={x=1,y=2},q=p.x")).toEqual({ p: { x: 1, y: 2 }, q: 1 });
  });
});

/* ------------------------------------------------------------------ */
/* parse: 嵌套结构                                                     */
/* ------------------------------------------------------------------ */
describe("parse – structures", () => {
  it("parses nested objects and arrays", () => {
    expect(parse("list=[1,2,{x=3}],obj={a={b=1}}")).toEqual({
      list: [1, 2, { x: 3 }],
      obj: { a: { b: 1 } },
    });
  });

  it("wraps fields into array entries in Array mode", () => {
    // README §3.1: Array 模式把每个顶层字段封装为 {key: value} 数组元素
    expect(parse("a=1,b=2", "Array")).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("parses object-array literals inside brackets normally", () => {
    expect(parse("list=[{x=1},{y=2}]")).toEqual({ list: [{ x: 1 }, { y: 2 }] });
  });

  it("supports auto-keys from member access", () => {
    expect(parse("user={name='u'},meta={user.name}")).toEqual({
      user: { name: "u" },
      meta: { name: "u" },
    });
  });
});

/* ------------------------------------------------------------------ */
/* parse: 重复键检测（编译期/运行时一致性修正）                          */
/* ------------------------------------------------------------------ */
describe("parse – duplicate key detection", () => {
  it("throws on duplicate keys at root scope", () => {
    expect(() => parse("a=1,a=2")).toThrow(/duplicate key "a"/);
  });

  it("throws on duplicate keys inside nested object", () => {
    expect(() => parse("p={x=1,x=2}")).toThrow(/duplicate key "x"/);
  });

  it("throws on duplicate auto-keys", () => {
    expect(() => parse("user={name='u'},m={user.name,user.name}")).toThrow(
      /duplicate key/,
    );
  });

  it("allows same key name in different scopes", () => {
    expect(parse("p={x=1},q={x=2}")).toEqual({ p: { x: 1 }, q: { x: 2 } });
  });

  it("does not treat == / != comparisons as duplicates", () => {
    expect(parse("eq=(1==1),ne=(1!=2)")).toEqual({ eq: true, ne: true });
  });
});

/* ------------------------------------------------------------------ */
/* stringify                                                              */
/* ------------------------------------------------------------------ */
describe("stringify", () => {
  it("stringifies primitives and strings with quotes", () => {
    expect(stringify({ a: 1, b: true, c: null, d: "hi" })).toBe(
      "a=1,b=true,c=null,d='hi'",
    );
  });

  it("escapes special characters in strings and round-trips", () => {
    const out = stringify({ s: "ok\nnext" });
    expect(out).toContain("\\n");
    expect(parse(out)).toEqual({ s: "ok\nnext" });
  });

  it("round-trips nested structures", () => {
    const obj = { a: 1, list: [1, 2, { x: 3 }], obj: { b: { c: "z" } } };
    expect(parse(stringify(obj))).toEqual(obj);
  });

  it("formats output with indentation", () => {
    const pretty = stringify({ a: 1, p: { x: 1 } }, { format: true, indent: 2 });
    expect(pretty).toContain("\n");
    // 美化输出仍可被重新解析
    expect(parse(pretty)).toEqual({ a: 1, p: { x: 1 } });
  });
});

/* ------------------------------------------------------------------ */
/* encodetags                                                          */
/* ------------------------------------------------------------------ */
describe("encodetags", () => {
  it("interpolates JS values into the text before encoding", () => {
    const name = "'Ann'"; // string 插值不加引号 → 需自带引号才是字面量
    const ages = [1, 2];
    const r = encodetags`name=${name},ages=${ages}`;
    expect(r).toEqual({ name: "Ann", ages: [1, 2] });
  });

  it("treats bare interpolated string as a reference/expression", () => {
    const undef = "nothing"; // 未定义标识符 → undefined（引用语义）
    expect((encodetags`a=${undef}` as Record<string, unknown>).a).toBeUndefined();
    const one = "1"; // 表达式插值 → 求值为数字
    expect(encodetags`a=${one}`).toMatchObject({ a: 1 });
  });
});

/* ------------------------------------------------------------------ */
/* 别名与导出兼容                                                        */
/* ------------------------------------------------------------------ */
describe("exports & aliases", () => {
  it("named exports match static members on the default export", () => {
    const C = CompactProfile as unknown as Record<string, unknown>;
    expect(C.parse).toBe(parse);
    expect(C.parseAs).toBe(parseAs);
    expect(C.stringify).toBe(stringify);
    expect(C.encodetags).toBe(encodetags);
  });

  it("types constant table is frozen", () => {
    expect(Object.isFrozen(types)).toBe(true);
  });

  it("default export passes instanceof check", () => {
    expect(new CompactProfile() instanceof CompactProfile).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* 编译期类型推导（type-level tests，由 tsc --noEmit 校验）               */
/*                                                                     */
/* 注意：parse 的字面量推导重载要求显式传入第二个类型参数 "Object"       */
/* （T 无法从入参推断，缺省会匹配到宽松重载）。                          */
/* 推导结果为逐字段交叉类型 `{a:1} & {b:"x"}`，属性访问与补全不受影响。   */
/* ------------------------------------------------------------------ */
type Expect<T extends true> = T;
type Equal<A, B> =
  (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2
    ? true
    : false;

// 字面量输入应推导出精确字段类型（交叉形式）
type T1 = Expect<
  Equal<ReturnType<typeof parse<"a=1,b='x'", "Object">>, { a: 1 } & { b: "x" }>
>;

// 无重复键的合法文本不应触发 DuplicateKeyError
type T2 = ReturnType<typeof parse<"a=1,b=2", "Object">>;
type T3 = Expect<Equal<T2, { a: 1 } & { b: 2 }>>;

// 重复键文本应推导出错误标记类型
type TDup = ReturnType<typeof parse<"a=1,a=2", "Object">>;
type HasDupMarker = TDup extends { __compactProfileError: string } ? true : false;
type T4 = Expect<Equal<HasDupMarker, true>>;

// 宽 string 入参退化为宽松记录类型（运行时用 String() 包装避免字面量收窄，仅做类型层面推导）
declare const wideText: string;
type WideResult = ReturnType<typeof parse<string, "Object">>;
type T5 = Expect<WideResult extends Record<string, unknown> ? true : false>;

// 保留类型引用，避免 unused 报错
export type _TypeTests = [T1, T3, T4, T5];

it("compile-time type-level assertions are checked by tsc", () => {
  expect(true).toBe(true);
});
