import dslResolve from "./dsl-resolver";
// @ts-ignore
import * as _ from 'lodash-es';
// type
import type { DslJson } from "./dsl-resolver";

type AssignmentOperator = "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "<<=" | ">>=" | ">>>=";
type UnaryOperator = "-" | "+" | "!" | "~" | "typeof" | "void" | "delete";
type BinaryOperator = "==" | "!=" | "===" | "!==" | "<" | "<=" | ">" | ">=" | "<<" | ">>" | ">>>" | "+" | "-" | "*" | "/" | "%" | "|" | "^" | "&" | "in" | "instanceof";
type UpdateOperator = "++" | "--";
type LogicalOperator = "||" | "&&";

// window对象的平替
const wind = {
  __parentVarScope__: global,
  _, // lodash
  /**
   * 以下是微信的全局对象或方法
  */
  wx,
  performance,
  atob,
  clearInterval,
  clearTimeout,
  setInterval,
  setTimeout,
  Component,
  Behavior,
  requirePlugin,
  global: {}, // 屏蔽 global
  Page,
  App,
  getApp,
  getCurrentPages,
  require,
  Infinity,
  Array,
  ArrayBuffer,
  BigInt,
  Boolean,
  DataView,
  Date,
  Error,
  EvalError,
  Float32Array,
  Float64Array,
  Function,
  Int8Array,
  Int16Array,
  Int32Array,
  Intl,
  JSON,
  Map,
  Math,
  NaN,
  Number,
  Object,
  Promise,
  Proxy,
  RangeError,
  ReferenceError,
  Reflect,
  RegExp,
  Set,
  String,
  Symbol,
  SyntaxError,
  TextDecoder,
  TextEncoder,
  TypeError,
  URIError,
  URL,
  Uint8Array,
  Uint8ClampedArray,
  Uint16Array,
  Uint32Array,
  WeakMap,
  WeakSet,
  console,
  decodeURI,
  decodeURIComponent,
  encodeURI,
  encodeURIComponent,
  escape,
  eval,
  globalThis,
  isFinite,
  isNaN,
  parseFloat,
  parseInt,
  undefined,
  unescape
};

// 自定义的方法
export default class Customize {
  constructor(parentVarScope?: any) {
    Object.defineProperty(this.varScope, '__parentVarScope__', {
      value: parentVarScope || wind,
      writable: false,
    });
  }
  varScope: any = {
    __returnObject__: null,
    __isBreak__: false,
    __isContinute__: false
  };
  // 常量
  const(key: string, valueDsl: DslJson | DslJson[]) {
    if (this.varScope.hasOwnProperty(key)) {
      throw new Error('Uncaught TypeError: Assignment to constant variable.');
    }
    Object.defineProperty(this.varScope, key, {
      value: this.getValue(valueDsl),
      writable: true, // 小程序环境中：writable 取 false，那么 enumerable 也一定是 false
      enumerable: true
    });
  }
  // 获取值
  getValue(valueDsl: DslJson | DslJson[]) {
    const isMemberExpression = _.isArray(valueDsl);
    const keyPath = (
      !isMemberExpression ?
        [] :
        (valueDsl as DslJson[]).map(item => dslResolve(item, this))
    );
    return !isMemberExpression ? dslResolve(valueDsl as DslJson, this) : this.getObjMember(keyPath);
  }
  // let
  let(key: string, valueDsl: DslJson | DslJson[], isVarKind: boolean = false) {
    if (this.varScope.hasOwnProperty(key)) {
      if (isVarKind) {
        this.varScope[key] = this.getValue(valueDsl);
      } else {
        throw new Error(`VM9688:1 Uncaught SyntaxError: Identifier '${key}' has already been declared`);
      }
    } else {
      Object.defineProperty(this.varScope, key, {
        value: this.getValue(valueDsl),
        writable: true,
        enumerable: true
      });
    }
  }
  // var
  var(key: string, valueDsl: DslJson | DslJson[]) {
    this.let(key, valueDsl, true);
  }
  // 批量
  batchConst(list: { key: string, value: any }[]) {
    list.forEach(({ key, value }) => this.const(key, value))
  }
  batchVar(list: { key: string, value: any }[]) {
    list.forEach(({ key, value }) => this.var(key, value))
  }
  batchLet(list: { key: string, value: any }[]) {
    this.batchVar(list);
  }
  batchDeclaration(kind: 'var' | 'let' | 'const', list: { key: string, value: any }[]) {
    switch(kind) {
      case "var":
        this.batchVar(list);
        break;
      case "let":
        this.batchLet(list);
        break;
      case "const":
        this.batchConst(list);
    }
  }
  // 取值
  getConst(key: string) {
    let value:any = this.varScope[key];
    if (!this.varScope.hasOwnProperty(key)) {
      // 当前作用域找不到，往上找
      let parent = this.varScope.__parentVarScope__;
      while(Boolean(parent)) {
        if (parent.hasOwnProperty(key)) {
          value = parent[key];
          break;
        }
        parent = parent.__parentVarScope__;
      }
    }
    return value;
  }
  getLet(key: string) {
    return this.getConst(key);
  }
  getVar(key: string) {
    return this.getConst(key);
  }
  getFunction(key: string, params?: any[]) {
    const fun = this.getConst(key);
    return fun?.(...(params || []));
  }
  // 获取形参 ---- 等同于 getLet
  getArg(key: string) {
    return this.getLet(key);
  }
  // 获取对象的成员
  getObjMember(keyPathOfDsl: (string | DslJson)[]) {
    return this.getOrAssignOrDissocPath(keyPathOfDsl);
  }
  // 取值、赋值与删除对象成员 
  getOrAssignOrDissocPath(
    keyPathOfDsl: (string | DslJson)[],
    valueDsl?: DslJson | DslJson[],
    operator?: AssignmentOperator,
    type: 'get' | 'assign' | 'dissocPath' = 'get'
  ) {
    if (!keyPathOfDsl.length) {
      throw new Error(`赋值失败: keyPathOfDsl为空数组`);
    }
    const value = valueDsl && this.getValue(valueDsl);
    const keyPath = keyPathOfDsl.map(item => dslResolve(item, this)) as string[];
    let objectLiteral: Object | null = null;
    // 表示对象的根名称
    const [firstKey] = keyPath;
    if (_.isObject(firstKey)) {
      // 表示对象是字面量
      objectLiteral = firstKey as Object;
      keyPath.shift(); // 去除第一个元素
    }
    const parentKeyPath = [...keyPath];
    const lastKey = parentKeyPath.pop();
    // 目标作用域
    let targetScope: Object | null = null;
    if (objectLiteral) {
      // 表示对象是字面量
      targetScope = objectLiteral;
    } else {
      if (_.hasIn(this.varScope, firstKey)) {
        // 当前作用域下
        targetScope = this.varScope;
      } else {
        // 当前作用域找不到，往上找
        let parent = this.varScope.__parentVarScope__;
        while(Boolean(parent)) {
          if (_.hasIn(parent, firstKey)) {
            // 找到作用域
            targetScope = parent;
            break;
          }
          parent = parent.__parentVarScope__;
        }
      }
    }
    if (targetScope) {
      const parent = parentKeyPath.length ? _.get(targetScope, parentKeyPath) : targetScope;
      if (
        type === 'assign' && (
          !parentKeyPath.length || _.hasIn(targetScope, parentKeyPath)
        )
      ) {
        // 执行赋值
        const result = this.getResultByOperator(
          _.get(targetScope, keyPath),
          value,
          operator
        );
        return parent[lastKey!] = result;
      }
      if (
        type === 'dissocPath' &&
        (
          !parentKeyPath.length || _.hasIn(targetScope, parentKeyPath)
        )
      ) {
        // 删除指定属性
        return delete parent[lastKey!];
      }
      if (type === 'get' && _.hasIn(targetScope, keyPath)) {
        // keyPath 找得到，返回结果
        let result = _.get(targetScope, keyPath);
        // 绑定 this 指针
        if (_.isFunction(result)) {
          result = result.bind(parent);
        }
        return result;
      }
    } else {
      // 执行到这里，表示出错了
      if (type === 'assign') {
        throw new Error(`赋值失败：keyPath - ${keyPath} 找不到`);
      } else {
        throw new Error(`对象${parentKeyPath.join('.')}不存在成员：${lastKey}`);
      }
    }
  }
  assignLet(keyPathOfDsl: (string | DslJson)[], valueDsl?: DslJson | DslJson[], operator?: AssignmentOperator) {
    return this.getOrAssignOrDissocPath(keyPathOfDsl, valueDsl, operator, 'assign');
  }
  // 按操作符赋值
  getResultByOperator(leftValue: any, rightValue: any, operator: AssignmentOperator = '=') {
    switch(operator) {
      case "=":
        return rightValue;
      case "+=":
        return leftValue + rightValue;
      case "-=":
        return leftValue - rightValue;
        break;
      case "*=":
        return leftValue * rightValue;
      case "/=":
        return leftValue / rightValue;
      case "%=":
        return leftValue % rightValue;
      case "<<=":
        return leftValue << rightValue;
      case ">>=":
        return leftValue >> rightValue;
      case ">>>=":
        return leftValue >>> rightValue;
      default:
    }
  }
  setLet(key: string, value?: any) {
    return this.assignLet([key], value);
  }
  // 返回值
  callReturn(dslJson: DslJson) {
    // 标记已经返回
    this.varScope.__returnObject__ = {
      result: dslResolve(dslJson, this)
    };
  }
  // break
  callBreak() {
    this.varScope.__isBreak__ = true;
  }
  // continute
  callContinute() {
    this.varScope.__isContinute__ = true;
  }
  // 一元运算
  callUnary(operator: UnaryOperator, valueDsl: DslJson | DslJson[]) {
    const isMemberExpression = _.isArray(valueDsl);
    const keyPath = (
      !isMemberExpression ?
        [] :
        (valueDsl as DslJson[]).map(item => dslResolve(item, this))
    );
    const value = !isMemberExpression ? dslResolve(valueDsl as DslJson, this) : this.getObjMember(keyPath);
    switch(operator) {
      case "-":
        return -value;
      case "+":
        return +value;
      case "!":
        return !value;
      case "~":
        return ~value;
      case "typeof":
        return typeof value;
      case "void":
        return void value;
      case "delete":
        if (isMemberExpression) {
          return this.getOrAssignOrDissocPath(keyPath, null, undefined, 'dissocPath');
        }
        // 不会报错，但是不会删除成员
        return false;
      default:
        throw new Error(`未知的一元运算符：${operator}`);
    }
  }
  // 二元运算
  callBinary(leftDsl: DslJson | DslJson[], operator: BinaryOperator, rightDsl: DslJson | DslJson[]) {
    const left = this.getValue(leftDsl);
    const right = this.getValue(rightDsl);
    switch(operator) {
      case "==":
        return left == right;
      case "!=":
        return left != right;
      case "===":
        return left === right;
      case "!==":
        return left !== right;
      case "<":
        return left < right;
      case "<=":
        return left <= right;
      case ">":
        return left > right;
      case ">=":
        return left >= right;
      case "<<":
        return left << right;
      case ">>":
        return left >> right;
      case ">>>":
        return left >>> right;
      case "+":
        return left + right;
      case "-":
        return left - right;
      case "*":
        return left * right;
      case "/":
        return left / right;
      case "%":
        return left % right;
      case "|":
        return left | right;
      case "^":
        return left ^ right;
      case "&":
        return left & right;
      case "in":
        return left in right;
      case "instanceof":
        return left instanceof right;
      default:
        throw new Error(`未知的二元运算符：${operator}`);
    }
  }
  // 更新
  callUpdate(operator: UpdateOperator, argument: DslJson | DslJson[], prefix: boolean) {
    const keyPathDsl = (_.isArray(argument) ? argument : [argument]) as DslJson[];
    const oldValue = this.getObjMember(keyPathDsl) as number;
    this.assignLet(keyPathDsl, 1 as any, operator === '++' ? '+=' : '-=');
    const newValue = this.getObjMember(keyPathDsl) as number;
    return prefix ? newValue : oldValue;
  }
  // 逻辑运算
  callLogical(leftDsl: DslJson | DslJson[], operator: LogicalOperator, rightDsl: DslJson | DslJson[]) {
    const left = this.getValue(leftDsl);
    const right = this.getValue(rightDsl);
    switch(operator) {
      case "||":
        return left || right;
      case "&&":
        return left && right;
    }
  }
  // 抛锚
  callThrow(argument: DslJson | DslJson[]) {
    throw this.getValue(argument);
  }
  // while
  callWhile(test: DslJson | DslJson[], body: DslJson) {
    while(this.getValue(test)) {
      dslResolve(body, this);
      if (this.varScope.__isBreak__) {
        this.varScope.__isBreak__ = false;
        break;
      }
      if (this.varScope.__isContinute__) {
        this.varScope.__isContinute__ = false;
        continue;
      }
    }
  }

  // doWhile
  callDoWhile(test: DslJson | DslJson[], body: DslJson) {
    dslResolve(body, this);
    this.callWhile(test, body);
  }

  // for
  callFor(
    init: DslJson,
    test: DslJson | DslJson[],
    update,
    body
  ) {
    for(dslResolve(init, this); this.getValue(test); dslResolve(update, this)) {
      dslResolve(body, this);
      if (this.varScope.__isBreak__) {
        this.varScope.__isBreak__ = false;
        break;
      }
      if (this.varScope.__isContinute__) {
        this.varScope.__isContinute__ = false;
        continue;
      }
    }
  }

  // for...in
  callForIn(leftDsl: DslJson | DslJson[], rightDsl: DslJson | DslJson[], body: DslJson) {
    const targetObj = this.getValue(rightDsl);
    const isMemberExpression = _.isArray(leftDsl);
    for(const item in targetObj) {
      if (isMemberExpression) {
        // 赋值表达式
        this.assignLet(leftDsl as DslJson[], item as any);
      } else if ((leftDsl as DslJson)?.value?.[1]?.[0]) {
        // 声明语句
        (leftDsl as DslJson).value[1][0].value = {
          type: 'literal',
          value: item
        };
        dslResolve(leftDsl as DslJson, this);
      }
      dslResolve(body, this);
      if (this.varScope.__isBreak__) {
        this.varScope.__isBreak__ = false;
        break;
      }
      if (this.varScope.__isContinute__) {
        this.varScope.__isContinute__ = false;
        continue;
      }
    }
  }

  // 销毁
  destroy() {
    this.varScope = {
      __returnObject__: null,
      __isBreak__: false,
      __isContinute__: false
    };
  }
  // 删除
  delete(key: string, source: any = this.varScope) {
    delete source[key];
  }
  // 创建拟函数
  createFunction(
    params: string[],
    body: DslJson[],
    functionName?: string,
    isBlockStatement = false,
    supportBreak = false,
    supportContinue = false
  ) {
    const parentVarScope = this.varScope;
    // 挂载 isBlockStatement
    Object.assign(parentVarScope, { isBlockStatement });
    const anonymousFn = function() {
      const customize = new Customize(parentVarScope);
      const args = arguments;
      // 在函数上下文挂载 arguments
      customize.const('arguments', {
        type: 'array-literal',
        value: arguments
      });
      // 在函数上下文中挂载 this
      // @ts-ignore
      customize.const('this', this);
      params.forEach((name, index) => {
        // 形参用 let 不用 const
        customize.let(name!, args[index]);
      });
      // 直接返回
      body.some(item => {
        if (!item) return;
        if (item?.isAwait) {
          throw new Error('await必须在async函数中');
        }
        dslResolve(item, customize);
        if (customize.varScope.__returnObject__) {
          // 表示的返回
          return true;
        }
        if (customize.varScope.__isBreak__) {
          if (
            isBlockStatement && (
              supportBreak || parentVarScope.isBlockStatement
            )
          ) {
            // 向上传递
            parentVarScope.__isBreak__ = true;
            // switch 或 循环中断
            if (!supportBreak) {
              customize.varScope.__isBreak__ = false;
            }
            return true;
          }
          customize.varScope.__isBreak__ = false;
          throw new Error('Uncaught SyntaxError: Illegal break statement');
        }
        if (customize.varScope.__isContinute__) {
          if (
            isBlockStatement && (
              supportContinue || parentVarScope.isBlockStatement
            )
          ) {
            // 向上传递
            parentVarScope.__isContinute__ = true;
            // 循环跳过
            if (!supportContinue) {
              customize.varScope.__isContinute__ = false;
            }
            return true;
          }
          customize.varScope.__isContinute__ = false;
          throw new Error('Uncaught SyntaxError: Illegal continute statement');
        }
        return false;
      });
      const result = customize.varScope.__returnObject__?.result;
      if (!isBlockStatement) {
        if (customize.varScope.__returnObject__) {
          customize.varScope.__returnObject__ = null;
          return result;
        }
      } else if (customize.varScope.__returnObject__) {
        // blockStatement 向上传
        customize.varScope.__parentVarScope__.__returnObject__ = {
          result
        };
        // 清除
        customize.varScope.__returnObject__ = null;
      }
    };
    if (functionName) {
      // 有函数名
      this.const(functionName, {
        type: 'literal',
        value: anonymousFn
      });
    }
    return anonymousFn;
  }
  // 创建块作用域
  callBlockStatement(body: DslJson[], supportBreak = false, supportContinue = false) {
    const blockStatementFn = this.createFunction(
      [],
      body,
      undefined,
      true,
      supportBreak,
      supportContinue
    );
    blockStatementFn();
  }
  // ifElse 函数改造
  callIfElse(conditionDsl: DslJson | DslJson[], onTrue: DslJson, onFail: DslJson) {
    if (this.getValue(conditionDsl)) {
      dslResolve(onTrue, this);
    } else {
      dslResolve(onFail, this)
    }
  }
  // 三元运算
  callConditional(conditionDsl: DslJson | DslJson[], onTrueDsl: DslJson, onFailDsl: DslJson) {
    const condition = this.getValue(conditionDsl);
    const onTrue = dslResolve(onTrueDsl, this);
    const onFail = dslResolve(onFailDsl, this);
    return condition ? onTrue() : onFail();
  }
  // new RegExp
  getRegExp(pattern: string, modifiers: string) {
    return new RegExp(pattern, modifiers);
  }
  // new Class
  newClass(calleeDsl: DslJson | DslJson[], paramsDsl?: DslJson[]) {
    return this.callFun(calleeDsl, paramsDsl, true);
  }
  // 调用方法
  callFun(calleeDsl: DslJson | DslJson[], paramsDsl?: DslJson[], isClass = false) {
    const callee = this.getValue(calleeDsl);
    const params = (paramsDsl || []).map(item => {
      return _.isArray(item) ? this.getValue(item) : dslResolve(item, this);
    });
    if (_.isFunction(callee)) {
      // 函数类型
      return isClass ? new callee(...params) : callee(...params);
    }
    // 表示类型出错
    throw new Error(`非函数类型： ${_.isArray(calleeDsl) ? (calleeDsl as DslJson[]).join('.') : calleeDsl}`);
  }
  // tryCatch 语句
  callTryCatch(block: DslJson, handler?: DslJson, finalizer?: DslJson) {
    try {
      dslResolve(block, this);
    } catch (err) {
      if (handler) {
        const catchFun = dslResolve(handler, this);
        catchFun(err);
      }
    } finally {
      finalizer && dslResolve(finalizer, this);
    }
  }
  // switch 语句
  callSwitch(discriminantDsl: DslJson | DslJson[], casesDsl: [DslJson | DslJson[], DslJson[]][]) {
    const discriminant = this.getValue(discriminantDsl);
    // 所有的语句
    const caseClauseList: DslJson[][] = [];
    const testList: any[] = [];
    casesDsl.forEach(caseDsl => {
      const [testDsl, consequentDsl] = caseDsl;
      testList.push(this.getValue(testDsl));
      caseClauseList.push(consequentDsl);
    });
    testList.some((test, index) => {
      // test === null 表示 default 分支
      if (test === null || test === discriminant) {
        for(let i = index; i < testList.length; ++i) {
          const body = caseClauseList[i];
          // 创建一个 block 执行
          this.callBlockStatement(body, true);
          if (this.varScope.__isBreak__) {
            // case 执行了 break
            this.varScope.__isBreak__ = false;
            break;
          }
        }
        return true;
      }
      return false;
    });
  }

  // sequence
  callSequence(dslList: DslJson[]) {
    const lastIndex = dslList.length - 1;
    let result: any;
    for (let i = 0; i <= lastIndex; ++i) {
      result = dslResolve(dslList[i], this);
    }
    return result;
  }

  /**
   * 注册方法或成员，非全局性的。只在上下文生效，相当于 const 的别名
   */
  register(key: string, value: any) {
    this.const(key, value);
  }
}
