import dslResolve from "./dsl-resolver";
import {
  createElement,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
// @ts-ignore
import * as R from 'ramda';
// type
import type { DslJson } from "./dsl-resolver";

type AssignmentOperator = "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "<<=" | ">>=" | ">>>=";
type UnaryOperator = "-" | "+" | "!" | "~" | "typeof" | "void" | "delete";
type BinaryOperator = "==" | "!=" | "===" | "!==" | "<" | "<=" | ">" | ">=" | "<<" | ">>" | ">>>" | "+" | "-" | "*" | "/" | "%" | "|" | "^" | "&" | "in" | "instanceof";
type UpdateOperator = "++" | "--";
type LogicalOperator = "||" | "&&";

// window对象的平替
const wind = {
  performance,
  atob,
  clearInterval,
  clearTimeout,
  setInterval,
  setTimeout,
  Component,
  Behavior,
  requirePlugin,
  global,
  wx,
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
  constructor(parentGlobal?: any) {
    Object.defineProperty(this.global, '__parent__', {
      value: parentGlobal || wind,
      writable: false,
    });
  }
  global: any = {
    __returnObject__: null,
    __isBreak__: false,
    __isContinute__: false
  };
  // 常量
  const(key: string, valueDsl: DslJson | DslJson[]) {
    Object.defineProperty(this.global, key, {
      value: this.getValue(valueDsl),
      writable: false,
    });
  }
  // 获取值
  getValue(valueDsl: DslJson | DslJson[]) {
    const isMemberExpression = R.is(Array, valueDsl);
    const keyPath = (
      !isMemberExpression ?
        [] :
        (valueDsl as DslJson[]).map(item => dslResolve(item, this))
    );
    return !isMemberExpression ? dslResolve(valueDsl as DslJson, this) : this.getObjMember(keyPath);
  }
  // let
  let(key: string, valueDsl: DslJson | DslJson[]) {
    Object.defineProperty(this.global, key, {
      value: this.getValue(valueDsl),
      writable: true,
    });
  }
  // var
  var(key: string, valueDsl: DslJson | DslJson[]) {
    this.let(key, valueDsl);
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
    let value:any = this.global[key];
    if (!this.global.hasOwnProperty(key)) {
      // 当前作用域找不到，往上找
      let parent = this.global.__parent__;
      while(Boolean(parent)) {
        if (parent.hasOwnProperty(key)) {
          value = parent[key];
          break;
        }
        parent = parent.__parent__;
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
    value?: any,
    operator?: AssignmentOperator,
    type: 'get' | 'assign' | 'dissocPath' = 'get'
  ) {
    if (!keyPathOfDsl.length) {
      throw new Error(`赋值失败: keyPathOfDsl为空数组`);
    }
    const keyPath = keyPathOfDsl.map(item => dslResolve(item, this)) as string[];
    let objectLiteral: Object | null = null;
    // 表示对象的根名称
    const [firstKey] = keyPath;
    if (R.is(Object, firstKey)) {
      // 表示对象是字面量
      objectLiteral = firstKey as Object;
      keyPath.shift(); // 去除第一个元素
    }
    const parentKeyPath = [...keyPath];
    const lastKey = parentKeyPath.pop();
    const lensPath = R.lensPath(keyPath);
    // 目标作用域
    let targetScope: Object | null = null;
    if (objectLiteral) {
      // 表示对象是字面量
      targetScope = objectLiteral;
    } else {
      if (this.global.hasOwnProperty(firstKey)) {
        // 当前作用域下
        targetScope = this.global;
      } else {
        // 当前作用域找不到，往上找
        let parent = this.global.__parent__;
        while(Boolean(parent)) {
          if (parent.hasOwnProperty(firstKey)) {
            // 找到作用域
            targetScope = parent;
            break;
          }
          parent = parent.__parent__;
        }
      }
    }
    if (targetScope) {
      if (type === 'assign' && R.hasPath(parentKeyPath, targetScope)) {
        // parentKeyPath 找得到，执行赋值
        return R.set(
          lensPath,
          this.getResultByOperator(
            R.view(lensPath, targetScope),
            value,
            operator
          ),
          targetScope
        );
      }
      if (type === 'dissocPath' && R.hasPath(parentKeyPath, targetScope)) {
        // parentKeyPath 找得到，删除指定属性
        return R.dissocPath(keyPath, targetScope);
      }
      if (type === 'get' && R.hasPath(keyPath, targetScope)) {
        // keyPath 找得到，返回结果
        return R.view(lensPath, targetScope);
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
  assignLet(keyPathOfDsl: (string | DslJson)[], value?: any, operator?: AssignmentOperator) {
    return this.getOrAssignOrDissocPath(keyPathOfDsl, value, operator, 'assign');
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
    this.global.__returnObject__ = {
      result: dslResolve(dslJson, this)
    };
  }
  // break
  callBreak() {
    this.global.__isBreak__ = true;
  }
  // continute
  callContinute() {
    this.global.__isContinute__ = true;
  }
  // 一元运算
  callUnary(operator: UnaryOperator, valueDsl: DslJson | DslJson[]) {
    const isMemberExpression = R.is(Array, valueDsl);
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
    let member = this.getObjMember((R.is(Array, argument) ? argument : [argument]) as DslJson[]) as number;
    switch(operator) {
      case "++":
        return prefix ? ++member : member++;
      case "--":
        return prefix ? --member : member--;
      default:
        throw new Error(`无效的运算符: ${operator}`);
    }
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
      if (this.global.__isBreak__) {
        this.global.__isBreak__ = false;
        break;
      }
      if (this.global.__isContinute__) {
        this.global.__isContinute__ = false;
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
    body,
    update
  ) {
    for(dslResolve(init, this); this.getValue(test); dslResolve(update, this)) {
      dslResolve(body, this);
      if (this.global.__isBreak__) {
        this.global.__isBreak__ = false;
        break;
      }
      if (this.global.__isContinute__) {
        this.global.__isContinute__ = false;
        continue;
      }
    }
  }

  // for...in
  callForIn(leftDsl: DslJson | DslJson[], rightDsl: DslJson | DslJson[], body) {
    const targetObj = this.getValue(rightDsl);
    const isMemberExpression = R.is(Array, leftDsl);
    for(const item in targetObj) {
      if (isMemberExpression) {
        // 赋值表达式
        this.assignLet(leftDsl as DslJson[], item);
      } else if (rightDsl?.[0]?.value?.[0]) {
        // 声明语句
        rightDsl[0].value[0].value = {
          type: 'literal',
          value: item
        };
      }
      dslResolve(body, this);
      if (this.global.__isBreak__) {
        this.global.__isBreak__ = false;
        break;
      }
      if (this.global.__isContinute__) {
        this.global.__isContinute__ = false;
        continue;
      }
    }
  }

  // 销毁
  destroy() {
    this.global = {
      __returnObject__: null,
      __isBreak__: false,
      __isContinute__: false
    };
  }
  // 删除
  delete(key: string, source: any = this.global) {
    delete source[key];
  }
  // 函数体的执行队列
  functionQueue(queue: DslJson[], customize: Customize) {
    // 检查 queue 里面有没有 isAsync
    return new Promise(resolve => {
      this.executeFunctionQueueItem(0, queue, customize, (result) => {
        resolve(result);
      });
    });
  }
  // 按顺序执行函数体
  executeFunctionQueueItem(
    index: number,
    queue: DslJson[],
    customize: Customize,
    final: (result?: any) => void,
  ) {
    const lastIndex = queue.length - 1;
    const item = queue[index];
    const res = dslResolve(item, customize);
    
    if (index >= lastIndex) {
      // 最后一条语句
      final();
    } else {
      const next = () => {
        if (this.global.__returnObject__) {
          // 表示有返回，中断上下文
          const result = this.global.__returnObject__?.result;
          this.global.__returnObject__ = null;
          final(result);
        } else {
          this.executeFunctionQueueItem(index + 1, queue, customize, final);
        }
      };
      if (item.isAwait) {
        (res as Promise<any>).then(() => next());
      } else {
        next();
      }
    }
  }
  // 创建拟函数
  createFunction(
    isAsync: boolean = false,
    params: string[],
    body: DslJson[],
    functionName?: string,
    isBlockStatement = false,
    supportBreak = false,
    supportContinue = false
  ) {
    const parentGlobal = this.global;
    const functionQueue = this.functionQueue.bind(this);
    const anonymousFn = function() {
      const customize = new Customize(parentGlobal);
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
      if (isAsync) {
        // 使用 async 语法糖，需要做同步化特殊处理
        return functionQueue(body, customize);
      } else {
        // 直接返回
        body.some(item => {
          if (item.isAwait) {
            throw new Error('await必须在async函数中');
          }
          dslResolve(item, customize);
          if (customize.global.__returnObject__) {
            // 表示的返回
            return true;
          }
          if (customize.global.__isBreak__) {
            if (
              isBlockStatement && (
                supportBreak || customize.global.__parent__.isBlockStatement
              )
            ) {
              // switch 或 循环中断
              if (!supportBreak) {
                // 向上传递
                customize.global.__parent__.__isBreak__ = true;
                customize.global.__isBreak__ = false;
              }
              return true;
            }
            customize.global.__isBreak__ = false;
            throw new Error('Uncaught SyntaxError: Illegal break statement');
          }
          if (customize.global.__isContinute__) {
            if (
              isBlockStatement && (
                supportContinue || customize.global.__parent__.isBlockStatement
              )
            ) {
              // 循环跳过
              if (!supportContinue) {
                // 向上传递
                customize.global.__parent__.__isContinute__ = true;
                customize.global.__isContinute__ = false;
              }
              return true;
            }
            customize.global.__isContinute__ = false;
            throw new Error('Uncaught SyntaxError: Illegal continute statement');
          }
          return false;
        });
        const result = customize.global.__returnObject__?.result;
        if (!isBlockStatement) {
          if (customize.global.__returnObject__) {
            customize.global.__returnObject__ = null;
            return result;
          }
        } else if (customize.global.__returnObject__) {
          // blockStatement 向上传
          customize.global.__parent__.__returnObject__ = {
            result
          };
          // 清除
          customize.global.__returnObject__ = null;
        }
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
      false,
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
  callIfElse(condition: boolean, onTrue: Function, onFail: Function) {
    return R.ifElse(R.__, onTrue, onFail)(condition);
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
    const params = (paramsDsl || []).map(item => dslResolve(item, this));
    if (R.is(Function, callee)) {
      // 函数类型
      return isClass ? new callee(...params) : callee(...params);
    }
    // 表示类型出错
    throw new Error(`非函数类型： ${callee}`);
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
    testList.some(({ test, index }) => {
      // test === null 表示 default 分支
      if (test === null || test === discriminant) {
        for(let i = index; i < testList.length; ++i) {
          const body = caseClauseList[i];
          // 创建一个 block 执行
          this.callBlockStatement(body, true);
          if (this.global.__isBreak__) {
            // case 执行了 break
            this.global.__isBreak__ = false;
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

  /** react 相关接口 */
  // 渲染函数
  createElement = createElement;
  useState = useState;
  useEffect = useEffect;
  useMemo = useMemo;
  useLayoutEffect = useLayoutEffect;
  useRef = useRef;
  useCallback = useCallback;
  // 微信对象
  wx = wx;
  /**
   * 注册方法或成员，非全局性的。只在上下文生效，相当于 const 的别名
   */
  register(key: string, value: any) {
    this.const(key, value);
  }
}

// 用户自定义的方法
export const userDefineFns: Record<string, Function> = {};

/**
 * 提供给开发注册新方法的入口，通过此入口注册的方法是全局性的
 */
export const setUserDefineFns = (defineFns: Record<string, Function>) => {
  Object.assign(userDefineFns, defineFns);
};
